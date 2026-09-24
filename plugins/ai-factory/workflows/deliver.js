export const meta = {
  name: 'deliver',
  description: 'Implement and verify a spec or task in one worktree, then deliver a GitLab MR with green CI',
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
const mrSchema = object({ iid: { type: 'integer', minimum: 1 }, url: text });
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
  worktreePath: nullable(text),
  branch: nullable(text),
  defaultBranch: nullable(text),
  task: nullable(text),
  sourcePath: nullable(text),
  mr: nullable(mrSchema),
  fixList: texts,
});
const deliverySchema = object({
  ok: boolean,
  mr: nullable(mrSchema),
  headSha: nullable(text),
  draft: boolean,
  findings: texts,
});
const ciSchema = object({
  status: { enum: ['success', 'failed', 'exhausted', 'unknown'] },
  pipelineUrl: nullable(text),
  findings: texts,
});
const finalSchema = object({
  ok: boolean,
  mr: nullable(mrSchema),
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
  `Check this original input and create the run's shared worktree only after all checks pass.\nInput: ${JSON.stringify(args)}`,
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
    !preflight.defaultBranch || !preflight.task?.trim() || preflight.fixList.length) {
  const findings = preflight?.fixList.length ? preflight.fixList : [
    'Preflight did not return a complete successful result. Inspect its output for a partially created worktree.',
  ];
  log(`Preflight aborted: ${findings.join('\n')}`);
  return { status: 'aborted', findings, retainedWorktree: preflight?.worktreePath ?? null };
}

// Snapshot spec content here: ignored or external specs need not exist in the worktree.
const context = {
  worktreePath: preflight.worktreePath,
  branch: preflight.branch,
  defaultBranch: preflight.defaultBranch,
  originalInput: args,
  task: preflight.task,
  sourcePath: preflight.sourcePath,
};
const confinement = `Every Bash call starts with cd to the safely shell-quoted worktreePath followed by &&. Use absolute file paths under that worktree. Never change the user's checkout. Do not ask for input.`;
function prompt(instruction, details = {}) {
  return `${instruction}\n${confinement}\nRun context and task data:\n${JSON.stringify({ ...context, ...details })}`;
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
let mr = preflight.mr;
let headSha = null;
let ci = { status: 'unknown', pipelineUrl: null, findings: ['CI has not been confirmed.'] };
let delivery = null;

async function deliver(label, findings, draft) {
  const result = await call(prompt('Commit, push, and open or update the MR. Report the actual remote state.', {
    mr, implementation, findings, draft,
  }), {
    agentType: 'ai-factory:deliverer',
    model: 'sonnet',
    effort: 'low',
    label,
    schema: deliverySchema,
  });
  if (result?.mr) mr = result.mr;
  if (result?.headSha) headSha = result.headSha;
  return result;
}

function deliveryFindings(result) {
  if (!result) return ['Delivery returned no result. Recover any MR created for the source branch and mark it draft.'];
  const findings = [...result.findings];
  if (!result.ok || !result.mr || !result.headSha) {
    findings.push('Delivery did not confirm a pushed commit and an open MR.');
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
  delivery = await deliver('Deliver MR', unresolved, unresolved.length > 0);
  unresolved = unique([...unresolved, ...deliveryFindings(delivery)]);

  phase('CI');
  if (delivery?.ok && delivery.mr && delivery.headSha && !delivery.findings.length) {
    // These findings stay unresolved: CI repair does not run the verifier again.
    const verifiedFindings = [...unresolved];
    for (let round = 0; round <= MAX_CI_FIXES; round += 1) {
      ci = await call(prompt('Inspect CI for this pushed head. Return bounded poll results and distilled failure logs.', {
        mode: 'inspect', mr, headSha, maxPolls: MAX_CI_POLLS, pollSeconds: CI_POLL_SECONDS,
      }), {
        agentType: 'ai-factory:ci-shepherd',
        model: 'sonnet',
        effort: 'medium',
        label: `CI check ${round + 1}`,
        schema: ciSchema,
      }) ?? { status: 'unknown', pipelineUrl: null, findings: ['The CI shepherd returned no result.'] };

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
      if (!delivery?.ok || !delivery.mr || !delivery.headSha || delivery.findings.length) break;
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
  return call(prompt('Finalize the MR state and description, then remove the worktree only if all work is committed and pushed.', {
    mode: 'finalize', mr, headSha, implementation, ci, findings, forceDraft,
    // One last observation confirms the current head; it does not restart polling.
    maxPolls: 1, pollSeconds: CI_POLL_SECONDS,
  }), {
    agentType: 'ai-factory:ci-shepherd',
    model: 'sonnet',
    effort: 'medium',
    label,
    schema: finalSchema,
  });
}

function finalStateConfirmed(result) {
  return result?.ok && result.mr && (result.draft ||
    (!unresolved.length && !result.findings.length &&
      result.ci.status === 'success' && !result.ci.findings.length));
}

let final = await finalize('Finalize MR and cleanup', unresolved.length > 0, unresolved);
if (!finalStateConfirmed(final)) {
  // One bounded recovery attempt covers a stopped call or a partial remote update.
  // It must rediscover the MR and worktree state before making any changes.
  unresolved = unique([...unresolved, ...(final?.findings ?? []), ...(final?.ci.findings ?? []),
    'Finalization did not confirm the MR state. Preserve a draft and report recovery details.']);
  if (final?.mr) mr = final.mr;
  if (final?.ci) ci = final.ci;
  final = await finalize('Recover finalization', true, unresolved);
}
if (!finalStateConfirmed(final)) {
  log(`Final MR state could not be confirmed. Inspect the MR and worktree: ${context.worktreePath}`);
  return {
    status: 'unconfirmed', mr: final?.mr ?? mr, ci: final?.ci ?? ci,
    findings: unique([...unresolved, ...(final?.findings ?? []), 'Final MR state is unconfirmed.']),
    retainedWorktree: context.worktreePath,
  };
}
const retainedWorktree = final.cleanedUp ? null : (final.retainedWorktree ?? context.worktreePath);
if (retainedWorktree) log(`Retained worktree: ${retainedWorktree}`);
log(`Delivery ${final.draft ? 'DRAFT' : 'ready'}: ${final.mr.url}; CI: ${final.ci.status}`);
return {
  status: final.draft ? 'draft' : 'ready',
  branch: context.branch,
  mr: final.mr,
  ci: final.ci,
  findings: unique([...unresolved, ...final.findings, ...final.ci.findings]),
  retainedWorktree,
};
