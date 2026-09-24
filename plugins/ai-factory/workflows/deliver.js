export const meta = {
  name: 'deliver',
  description: 'Implement and verify a task in one worktree, then deliver a GitHub PR or GitLab MR with green CI',
  phases: [
    { title: 'Preflight', model: 'sonnet' },
    { title: 'Implement', model: 'opus' },
    { title: 'Verify', model: 'opus' },
    { title: 'Deliver', model: 'sonnet' },
    { title: 'CI', model: 'sonnet' },
  ],
};

// Two repair rounds follow the initial implementation/verification or CI check.
const MAX_VERIFY_FIXES = 2;
const MAX_CI_FIXES = 2;
// Bound API traffic by poll count, not by elapsed runtime.
const MAX_CI_POLLS = 20;
const CI_POLL_SECONDS = 15;

// Provider-specific mechanics live here. Agents execute these recipes; the
// sandboxed script cannot import a CLI client or run commands itself.
const providers = {
  github: {
    preflight: {
      auth: 'gh auth status --hostname <host>',
      repository: 'gh repo view <host>/<path> --json nameWithOwner,defaultBranchRef,url',
      list: "gh api --hostname <host> --paginate 'repos/<path>/pulls?state=open&per_page=100'",
      notes: 'Use the repository-local PR number as review.number. Confirm source repository, head.ref, and base.ref from the API. Draft PRs must be supported by the repository plan.',
    },
    delivery: {
      inspect: 'gh pr view <number> --repo <host>/<path> --json number,url,body,isDraft,state,headRefName,headRefOid,baseRefName,isCrossRepository',
      list: "gh api --hostname <host> --paginate 'repos/<path>/pulls?state=open&per_page=100'",
      create: 'gh pr create --repo <host>/<path> --head <branch> --base <default> --title <title> --body-file <file> [--draft]',
      updateBody: 'gh pr edit <number> --repo <host>/<path> --body-file <file>',
      draft: 'gh pr ready <number> --repo <host>/<path> --undo',
      ready: 'gh pr ready <number> --repo <host>/<path>',
    },
    ci: {
      head: 'gh pr view <number> --repo <host>/<path> --json headRefOid,statusCheckRollup',
      inspect: 'gh pr checks <number> --repo <host>/<path> --json name,state,bucket,link,workflow',
      failedLogs: 'gh run view <run-id> --repo <host>/<path> --log-failed',
      run: 'gh run view <run-id> --repo <host>/<path> --json headSha,status,conclusion,url,event',
      notes: 'Check all reported checks and legacy statuses, not just --required. Confirm headRefOid equals headSha before and after each observation. Resolve each Actions run from its check link and confirm its headSha. For synthetic merge commits, verify their source-head parent through the API. bucket=pass is green; fail/cancel is failed, pending needs another poll, and skipping or an empty check list is not green. Exit code 8 means pending; parse JSON even on a nonzero exit. External CI may supply only a check link: report that evidence and missing logs without treating missing logs as a pass. Never use --watch.',
    },
  },
  gitlab: {
    preflight: {
      auth: 'glab auth status --hostname <host>',
      repository: 'glab repo view https://<host>/<path> --output json',
      list: 'glab mr list --repo https://<host>/<path> --output json --per-page 100 --page <page>',
      notes: 'Fetch every page. Use the project-local MR iid as review.number. Confirm source_project_id, target_project_id, source_branch, and target_branch.',
    },
    delivery: {
      inspect: 'glab mr view <number> --repo https://<host>/<path> --output json',
      list: 'glab mr list --repo https://<host>/<path> --source-branch <branch> --output json --per-page 100 --page <page>',
      create: 'glab mr create --repo https://<host>/<path> --source-branch <branch> --target-branch <default> --title <title> --description <body> [--draft] --yes',
      updateBody: 'glab mr update <number> --repo https://<host>/<path> --description <body> --yes',
      draft: 'glab mr update <number> --repo https://<host>/<path> --draft --yes',
      ready: 'glab mr update <number> --repo https://<host>/<path> --ready --yes',
    },
    ci: {
      head: 'glab mr view <number> --repo https://<host>/<path> --output json',
      inspect: 'glab ci status --repo https://<host>/<path> --branch <branch> --output json',
      failedLogs: 'glab ci trace <job-id> --repo https://<host>/<path>',
      notes: 'A nonzero exit can mean red CI; inspect JSON before declaring an API error. Match the pipeline SHA to headSha and this MR. Prefer the MR pipeline when both branch and MR pipelines exist; use glab api for MR pipeline metadata as needed. For a merged-results pipeline, verify its source SHA. Running, created, pending, and temporarily absent pipelines consume the poll budget. Required manual, blocked, canceled, or skipped pipelines are not green. Missing CI is not green. Never use --live.',
    },
  },
};

const text = { type: 'string' };
const texts = { type: 'array', items: text };
const boolean = { type: 'boolean' };
const object = properties => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const reviewSchema = object({ number: { type: 'integer', minimum: 1 }, url: text });
const gateSchema = object({
  command: text,
  status: { enum: ['passed', 'failed', 'blocked'] },
  details: text,
});
const implementationSchema = object({
  summary: text,
  gates: { type: 'array', items: gateSchema },
  findings: texts,
});
const preflightSchema = object({
  ready: boolean,
  provider: nullable({ enum: ['github', 'gitlab'] }),
  repository: nullable(object({ host: text, path: text })),
  worktreePath: nullable(text),
  branch: nullable(text),
  defaultBranch: nullable(text),
  task: nullable(text),
  sourcePath: nullable(text),
  review: nullable(reviewSchema),
  fixList: texts,
});
const deliverySchema = object({
  ok: boolean,
  review: nullable(reviewSchema),
  headSha: nullable(text),
  draft: boolean,
  findings: texts,
});
const ciSchema = object({
  status: { enum: ['success', 'failed', 'exhausted', 'unknown'] },
  url: nullable(text),
  findings: texts,
});
const finalSchema = object({
  ok: boolean,
  review: nullable(reviewSchema),
  draft: boolean,
  ci: ciSchema,
  cleanedUp: boolean,
  retainedWorktree: nullable(text),
  findings: texts,
});

// Failed/stopped calls and schema failures must never become a passing verdict.
async function call(prompt, options) {
  try {
    return await agent(prompt, options);
  } catch (error) {
    log(`${options.label} failed: ${String(error)}`);
    return null;
  }
}

function unique(findings) {
  return [...new Set(findings)];
}

function implementationFindings(result) {
  if (!result) return ['The implementer returned no result; implementation and local gates are unconfirmed.'];
  return unique([
    ...result.findings,
    ...result.gates.filter(gate => gate.status !== 'passed')
      .map(gate => `Local gate ${gate.status}: ${gate.command}. ${gate.details}`),
  ]);
}

phase('Preflight');
const preflight = await call(
  `Check this original input and create the run's shared worktree only after all checks pass.\nInput: ${JSON.stringify(args)}\nProvider preflight recipes:\n${JSON.stringify(Object.fromEntries(Object.entries(providers).map(([name, adapter]) => [name, adapter.preflight])))}`,
  {
    agentType: 'ai-factory:preflight-gateway',
    model: 'sonnet',
    effort: 'medium',
    label: 'Preflight',
    schema: preflightSchema,
  },
);
if (preflight?.worktreePath) log(`Run worktree: ${preflight.worktreePath}`);
if (!preflight?.ready || !preflight.worktreePath || !preflight.branch ||
    !preflight.defaultBranch || !preflight.task?.trim() || preflight.fixList.length ||
    !Object.hasOwn(providers, preflight.provider) ||
    !preflight.repository?.host || !preflight.repository.path) {
  const findings = preflight?.fixList.length ? preflight.fixList : [
    'Preflight did not return a complete successful result. Inspect its output for a partially created worktree.',
  ];
  log(`Preflight aborted: ${findings.join('\n')}`);
  return { status: 'aborted', findings, retainedWorktree: preflight?.worktreePath ?? null };
}

// Snapshot spec content here: ignored or external specs need not exist in the worktree.
const context = {
  provider: preflight.provider,
  repository: preflight.repository,
  worktreePath: preflight.worktreePath,
  branch: preflight.branch,
  defaultBranch: preflight.defaultBranch,
  originalInput: args,
  task: preflight.task,
  sourcePath: preflight.sourcePath,
};
const provider = providers[context.provider];
const confinement = `Every Bash call starts with cd to the safely shell-quoted worktreePath followed by &&. Use absolute file paths under that worktree. Never change the user's checkout. Do not ask for input.`;
function prompt(instruction, details = {}, operations = []) {
  const providerCommands = Object.fromEntries(operations.map(name => [name, provider[name]]));
  return `${instruction}\n${confinement}\nRun context and task data:\n${JSON.stringify({ ...context, ...details, providerCommands })}`;
}

async function implement(label, findings, previousResult) {
  return call(prompt('Implement the original task. Address the supplied findings and run local quality gates.', {
    findings, previousResult,
  }), {
    agentType: 'ai-factory:implementer',
    model: 'opus',
    effort: 'high',
    label,
    schema: implementationSchema,
  });
}

let implementation = null;
let unresolved = [];
let review = preflight.review;
let headSha = null;
let ci = { status: 'unknown', url: null, findings: ['CI has not been confirmed.'] };
let delivery = null;

async function deliver(label, findings, draft) {
  const result = await call(prompt('Commit, push, and open or update the review request. Report the actual remote state.', {
    review, implementation, findings, draft,
  }, ['delivery']), {
    agentType: 'ai-factory:deliverer',
    model: 'sonnet',
    effort: 'low',
    label,
    schema: deliverySchema,
  });
  if (result?.review) review = result.review;
  if (result?.headSha) headSha = result.headSha;
  return result;
}

function deliveryFindings(result) {
  if (!result) return ['Delivery returned no result. Recover any review request created for the source branch and mark it draft.'];
  const findings = [...result.findings];
  if (!result.ok || !result.review || !result.headSha) {
    findings.push('Delivery did not confirm a pushed commit and an open review request.');
  }
  return unique(findings);
}

try {
  phase('Implement');
  implementation = await implement('Implement task', [], null);

  phase('Verify');
  for (let round = 0; round <= MAX_VERIFY_FIXES; round += 1) {
    // Always verify, including after a stopped implementer or failed local gates.
    const verification = await call(prompt('Independently inspect the complete diff against the original task. Recheck prior findings.', {
      implementation, priorFindings: unresolved,
    }), {
      agentType: 'ai-factory:verifier',
      model: 'opus',
      effort: 'xhigh',
      label: `Verify ${round + 1}`,
      schema: object({ summary: text, findings: texts }),
    });
    unresolved = unique([
      ...implementationFindings(implementation),
      ...(verification?.findings ?? ['The verifier returned no result; the original task is not independently verified.']),
    ]);
    if (!unresolved.length) break;
    if (round === MAX_VERIFY_FIXES) {
      log(`Verification repair budget exhausted. Delivering a draft with ${unresolved.length} unresolved finding(s).`);
      break;
    }
    implementation = await implement(`Verification repair ${round + 1}`, unresolved, implementation);
  }

  phase('Deliver');
  delivery = await deliver('Deliver review request', unresolved, unresolved.length > 0);
  unresolved = unique([...unresolved, ...deliveryFindings(delivery)]);

  phase('CI');
  if (delivery?.ok && delivery.review && delivery.headSha && !delivery.findings.length) {
    // These findings stay unresolved: CI repair does not run the verifier again.
    const verifiedFindings = [...unresolved];
    for (let round = 0; round <= MAX_CI_FIXES; round += 1) {
      ci = await call(prompt('Inspect CI for this pushed head. Return bounded poll results and distilled failure logs.', {
        mode: 'inspect', review, headSha, maxPolls: MAX_CI_POLLS, pollSeconds: CI_POLL_SECONDS,
      }, ['ci']), {
        agentType: 'ai-factory:ci-shepherd',
        model: 'sonnet',
        effort: 'medium',
        label: `CI check ${round + 1}`,
        schema: ciSchema,
      }) ?? { status: 'unknown', url: null, findings: ['The CI shepherd returned no result.'] };

      if (ci.status !== 'failed' || round === MAX_CI_FIXES) break;
      log(`CI failed. Starting repair ${round + 1} of ${MAX_CI_FIXES}.`);
      implementation = await implement(`CI repair ${round + 1}`,
        ci.findings.length ? ci.findings : ['CI failed; inspect the failing jobs for this head.'],
        implementation);
      unresolved = unique([...verifiedFindings, ...implementationFindings(implementation)]);
      delivery = await deliver(`Push CI repair ${round + 1}`, [
        ...unresolved, 'CI repair is awaiting a green pipeline for the new head.',
      ], true);
      unresolved = unique([...unresolved, ...deliveryFindings(delivery)]);
      if (!delivery?.ok || !delivery.review || !delivery.headSha || delivery.findings.length) break;
    }
  }
} catch (error) {
  unresolved.push(`The workflow aborted after creating its worktree: ${String(error)}`);
  log(`Run interrupted. Retained worktree: ${context.worktreePath}`);
}

if (ci.status !== 'success' || ci.findings.length) {
  unresolved = unique([...unresolved, ...ci.findings, ...(ci.status !== 'success'
    ? [`CI is ${ci.status}; the run did not confirm green CI within its budget.`] : [])]);
}

phase('CI');
async function finalize(label, forceDraft, findings) {
  return call(prompt('Finalize the review request state and description, then remove the worktree only if all work is committed and pushed.', {
    mode: 'finalize', review, headSha, implementation, ci, findings, forceDraft,
    // One last observation confirms the current head; it does not restart polling.
    maxPolls: 1, pollSeconds: CI_POLL_SECONDS,
  }, ['delivery', 'ci']), {
    agentType: 'ai-factory:ci-shepherd',
    model: 'sonnet',
    effort: 'medium',
    label,
    schema: finalSchema,
  });
}

function finalStateConfirmed(result) {
  return result?.ok && result.review && (result.draft ||
    (!unresolved.length && !result.findings.length &&
      result.ci.status === 'success' && !result.ci.findings.length));
}

let final = await finalize('Finalize review request and cleanup', unresolved.length > 0, unresolved);
if (!finalStateConfirmed(final)) {
  // One bounded recovery attempt covers a stopped call or a partial remote update.
  // It must rediscover the review request and worktree state before making any changes.
  unresolved = unique([...unresolved, ...(final?.findings ?? []), ...(final?.ci.findings ?? []),
    'Finalization did not confirm the review request state. Preserve a draft and report recovery details.']);
  if (final?.review) review = final.review;
  if (final?.ci) ci = final.ci;
  final = await finalize('Recover finalization', true, unresolved);
}
if (!finalStateConfirmed(final)) {
  log(`Final review request state could not be confirmed. Inspect the review request and worktree: ${context.worktreePath}`);
  return {
    status: 'unconfirmed', provider: context.provider, review: final?.review ?? review, ci: final?.ci ?? ci,
    findings: unique([...unresolved, ...(final?.findings ?? []), 'Final review request state is unconfirmed.']),
    retainedWorktree: context.worktreePath,
  };
}
const retainedWorktree = final.cleanedUp ? null : (final.retainedWorktree ?? context.worktreePath);
if (retainedWorktree) log(`Retained worktree: ${retainedWorktree}`);
log(`Delivery ${final.draft ? 'DRAFT' : 'ready'}: ${final.review.url}; CI: ${final.ci.status}`);
return {
  status: final.draft ? 'draft' : 'ready',
  provider: context.provider,
  branch: context.branch,
  review: final.review,
  ci: final.ci,
  findings: unique([...unresolved, ...final.findings, ...final.ci.findings]),
  retainedWorktree,
};
