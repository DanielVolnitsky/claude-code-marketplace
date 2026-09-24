import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const plugin = join(root, 'plugins/ai-factory');
const source = readFileSync(join(plugin, 'workflows/deliver.js'), 'utf8');
// Claude's body supports top-level return, so run it in the same async shape.
const program = new vm.Script(`(async () => { ${source.replace('export const meta', 'const meta')} })()`);
const clone = value => JSON.parse(JSON.stringify(value));
const review = { number: 7, url: 'https://gitlab.example/team/repo/-/merge_requests/7' };
const models = {
  'preflight-gateway': ['sonnet', 'medium'],
  implementer: ['opus', 'high'],
  verifier: ['opus', 'xhigh'],
  deliverer: ['sonnet', 'low'],
  'ci-shepherd': ['sonnet', 'medium'],
};
const input = 'Add input validation';
const preflight = {
  ready: true, worktreePath: '/tmp/repo.worktrees/codex/deliver-validation',
  provider: 'gitlab', repository: { host: 'gitlab.example', path: 'team/repo' },
  branch: 'codex/deliver-validation', defaultBranch: 'main',
  task: input, sourcePath: null, review: null, fixList: [],
};
const implemented = {
  summary: 'Added input validation.',
  gates: [{ command: 'node --test', status: 'passed', details: 'All tests passed.' }],
  findings: [],
};
const green = { status: 'success', url: 'https://gitlab.example/pipelines/8', findings: [] };

// Check real output schemas against adapter results, including all required keys.
function validate(schema, value) {
  if (schema.anyOf) {
    assert.ok(schema.anyOf.some(option => {
      try { validate(option, value); return true; } catch { return false; }
    }), `Value did not match any schema: ${JSON.stringify(value)}`);
    return;
  }
  if (schema.enum) assert.ok(schema.enum.includes(value));
  if (schema.type === 'null') assert.equal(value, null);
  if (schema.type === 'string') assert.equal(typeof value, 'string');
  if (schema.type === 'boolean') assert.equal(typeof value, 'boolean');
  if (schema.type === 'integer') {
    assert.ok(Number.isInteger(value));
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum);
  }
  if (schema.type === 'array') {
    assert.ok(Array.isArray(value));
    value.forEach(item => validate(schema.items, item));
  }
  if (schema.type === 'object') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value));
    for (const key of schema.required) {
      assert.ok(Object.hasOwn(value, key), `Missing required key: ${key}`);
    }
    for (const [key, item] of Object.entries(value)) {
      assert.ok(Object.hasOwn(schema.properties, key), `Unexpected key: ${key}`);
      validate(schema.properties[key], item);
    }
  }
}

function defaults(role, data) {
  if (role === 'preflight-gateway') return clone(preflight);
  if (role === 'implementer') return clone(implemented);
  if (role === 'verifier') return { summary: 'Task and gates verified.', findings: [] };
  if (role === 'deliverer') return {
    ok: true, review: data.review ?? providerReview(data.provider, data.repository),
    headSha: 'abc123', draft: data.draft, findings: [],
  };
  if (data.mode === 'inspect') return clone(green);
  return {
    ok: true, review: data.review ?? providerReview(data.provider, data.repository),
    draft: data.forceDraft || data.findings.length > 0,
    ci: clone(data.ci), cleanedUp: true, retainedWorktree: null, findings: [],
  };
}

function providerReview(provider, repository) {
  return {
    number: 7,
    url: `https://${repository.host}/${repository.path}/${provider === 'github' ? 'pull' : '-/merge_requests'}/7`,
  };
}

async function run({
  args = input, respond = () => undefined, provider = 'gitlab',
  repository = { host: `${provider}.example`, path: 'team/repo' },
} = {}) {
  const calls = [], logs = [], phases = [];
  class DeterministicDate extends Date {
    constructor(...values) {
      if (!values.length) throw new Error('Clock unavailable');
      super(...values);
    }
    static now() { throw new Error('Clock unavailable'); }
  }
  const safeMath = Object.create(Math);
  safeMath.random = () => { throw new Error('Random unavailable'); };
  const sandbox = vm.createContext({
    args, Date: DeterministicDate, Math: safeMath,
    phase: title => phases.push(title),
    log: line => logs.push(line),
    agent: async (prompt, options) => {
      const role = options.agentType.replace('ai-factory:', '');
      assert.deepEqual([options.model, options.effort], models[role]);
      assert.equal(options.isolation, undefined);
      let data;
      if (role !== 'preflight-gateway') {
        data = JSON.parse(prompt.split('Run context and task data:\n')[1]);
        assert.ok(data.worktreePath.startsWith('/'));
        assert.match(prompt, /Every Bash call starts with cd/);
      }
      const call = { role, data, prompt, options };
      calls.push(call);
      const response = await respond(call, calls);
      const result = response === undefined
        ? (role === 'preflight-gateway' ? { ...clone(preflight), provider, repository } : defaults(role, data))
        : response;
      if (result !== null) validate(options.schema, result);
      return result;
    },
  }, { codeGeneration: { strings: false, wasm: false } });
  const result = clone(await program.runInContext(sandbox, { timeout: 1000 }));
  return { result, calls, logs, phases };
}

test('plugin registration, literal metadata, and agent model ownership', () => {
  const manifest = JSON.parse(readFileSync(join(plugin, '.claude-plugin/plugin.json')));
  assert.equal(manifest.name, 'ai-factory');
  assert.equal(manifest.version, '1.1.1');
  const marketplace = JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json')));
  assert.equal(marketplace.plugins.find(p => p.name === 'ai-factory').source.path, 'plugins/ai-factory');
  assert.ok(source.startsWith('export const meta = {'));
  const metaText = source.slice('export const meta = '.length, source.indexOf('\n};') + 2);
  const meta = vm.runInNewContext(`(${metaText})`, {}, { timeout: 1000 });
  assert.equal(meta.name, 'deliver');
  assert.deepEqual(Array.from(meta.phases, phase => phase.title), ['Preflight', 'Implement', 'Verify', 'Deliver', 'CI']);
  const files = readdirSync(join(plugin, 'agents'));
  assert.equal(files.length, 5);
  for (const file of files) {
    const agent = readFileSync(join(plugin, 'agents', file), 'utf8');
    const frontmatter = agent.split('---')[1];
    assert.doesNotMatch(frontmatter, /^(model|effort):/m);
    assert.match(frontmatter, new RegExp(`^name: ${file.replace('.md', '')}$`, 'm'));
  }
});

test('ready review request requires successful verification and CI, with every phase configured', async () => {
  const { result, calls, phases } = await run();
  assert.equal(result.status, 'ready');
  assert.equal(result.retainedWorktree, null);
  assert.deepEqual(calls.map(c => c.role), [
    'preflight-gateway', 'implementer', 'verifier', 'deliverer', 'ci-shepherd', 'ci-shepherd',
  ]);
  assert.deepEqual([...new Set(phases)], ['Preflight', 'Implement', 'Verify', 'Deliver', 'CI']);
  assert.equal(calls.find(c => c.role === 'deliverer').data.draft, false);
  assert.equal(calls.at(-1).data.maxPolls, 1);
});

test('preflight abort reports its fix list and any partially created worktree', async () => {
  const { result, calls, logs } = await run({ respond: () => ({
    ...preflight, ready: false, fixList: ['Authenticate glab for the origin host.'],
  }) });
  assert.equal(calls.length, 1);
  assert.equal(result.status, 'aborted');
  assert.deepEqual(result.findings, ['Authenticate glab for the origin host.']);
  assert.ok(logs.some(line => line.includes(preflight.worktreePath)));
});

test('a stopped or throwing preflight never starts implementation', async () => {
  for (const respond of [() => null, () => { throw new Error('schema validation failed'); }]) {
    const { result, calls } = await run({ respond });
    assert.equal(result.status, 'aborted');
    assert.equal(calls.length, 1);
  }
});

test('file input snapshots original content even when the spec is outside the worktree', async () => {
  const task = 'Implement this exact spec.\nKeep the original requirement.';
  const { calls } = await run({
    args: './specs/task.md',
    respond: c => c.role === 'preflight-gateway'
      ? { ...preflight, task, sourcePath: '/original/repo/specs/task.md' } : undefined,
  });
  for (const call of calls.slice(1)) {
    assert.equal(call.data.originalInput, './specs/task.md');
    assert.equal(call.data.task, task);
  }
});

test('verification always runs after a missing implementer result', async () => {
  const { result, calls } = await run({ respond: c => c.role === 'implementer' ? null : undefined });
  assert.equal(calls.filter(c => c.role === 'verifier').length, 3);
  assert.equal(calls.filter(c => c.role === 'implementer').length, 3);
  assert.equal(result.status, 'draft');
  assert.ok(result.findings.some(f => f.includes('implementer returned no result')));
});

test('a null verifier consumes only two repair rounds and forces draft', async () => {
  const { result, calls } = await run({ respond: c => c.role === 'verifier' ? null : undefined });
  assert.equal(calls.filter(c => c.role === 'verifier').length, 3);
  assert.equal(calls.filter(c => c.role === 'implementer').length, 3);
  assert.equal(calls.find(c => c.role === 'deliverer').data.draft, true);
  assert.equal(result.status, 'draft');
});

test('resolved verification findings permit delivery before the repair cap', async () => {
  let checks = 0;
  const { result, calls } = await run({ respond: c => {
    if (c.role === 'verifier' && checks++ === 0) return { summary: 'Incomplete', findings: ['Missing edge case.'] };
  } });
  assert.equal(result.status, 'ready');
  const fixes = calls.filter(c => c.role === 'implementer');
  assert.equal(fixes.length, 2);
  assert.deepEqual(fixes[1].data.findings, ['Missing edge case.']);
});

test('failed or blocked local gates cannot be erased by a clean verifier', async () => {
  for (const status of ['failed', 'blocked']) {
    const { result } = await run({ respond: c => c.role === 'implementer' ? {
      ...implemented, gates: [{ command: 'lint', status, details: 'Could not pass.' }],
    } : undefined });
    assert.equal(result.status, 'draft');
    assert.ok(result.findings.some(f => f.includes('lint')));
  }
});

test('CI repairs are bounded, use fresh implementers, and never rerun verification', async () => {
  const { result, calls, logs } = await run({ respond: c => c.data?.mode === 'inspect' ? {
    status: 'failed', url: 'https://gitlab.example/pipelines/9', findings: ['Build failed at compile.'],
  } : undefined });
  assert.equal(result.status, 'draft');
  assert.equal(calls.filter(c => c.role === 'implementer').length, 3);
  assert.equal(calls.filter(c => c.role === 'verifier').length, 1);
  assert.equal(calls.filter(c => c.role === 'deliverer').length, 3);
  assert.equal(calls.filter(c => c.data?.mode === 'inspect').length, 3);
  assert.ok(logs.some(line => line.includes('repair 2 of 2')));
  for (const call of calls.filter(c => c.data?.mode === 'inspect')) {
    assert.equal(call.data.maxPolls, 20);
    assert.equal(call.data.pollSeconds, 15);
    assert.equal(call.data.headSha, 'abc123');
  }
});

test('green CI after repair clears CI failures but preserves verification findings', async () => {
  for (const verificationFails of [false, true]) {
    let polls = 0;
    const { result, calls } = await run({ respond: c => {
      if (verificationFails && c.role === 'verifier') return { summary: 'Incomplete', findings: ['Task incomplete.'] };
      if (c.data?.mode === 'inspect' && polls++ === 0) return {
        ...green, status: 'failed', findings: ['CI test failed.'],
      };
    } });
    assert.equal(result.status, verificationFails ? 'draft' : 'ready');
    assert.ok(!result.findings.includes('CI test failed.'));
    if (verificationFails) assert.ok(result.findings.includes('Task incomplete.'));
    assert.equal(calls.filter(c => c.role === 'deliverer').at(-1).data.draft, true);
  }
});

test('null, unknown, and exhausted CI never count as green or trigger speculative repairs', async () => {
  for (const response of [null, { ...green, status: 'unknown' }, { ...green, status: 'exhausted' }]) {
    const { result, calls } = await run({ respond: c => c.data?.mode === 'inspect' ? response : undefined });
    assert.equal(result.status, 'draft');
    assert.equal(calls.filter(c => c.role === 'implementer').length, 1);
  }
});

test('a reused review request is passed to delivery and CI unchanged', async () => {
  const existing = { ...review, number: 11 };
  const { calls } = await run({ respond: c => c.role === 'preflight-gateway'
    ? { ...preflight, review: existing } : undefined });
  for (const call of calls.filter(c => ['deliverer', 'ci-shepherd'].includes(c.role))) {
    assert.deepEqual(call.data.review, existing);
  }
});

test('lost delivery results still trigger finalization and branch-based review request recovery', async () => {
  const { result, calls } = await run({ respond: c => c.role === 'deliverer' ? null : undefined });
  assert.equal(result.status, 'draft');
  assert.equal(calls.filter(c => c.data?.mode === 'inspect').length, 0);
  assert.equal(calls.at(-1).data.mode, 'finalize');
  assert.equal(calls.at(-1).data.forceDraft, true);
  assert.equal(calls.at(-1).data.branch, preflight.branch);
});

test('a failed CI repair push cannot be hidden by prior CI evidence', async () => {
  let deliveries = 0;
  const { result, calls } = await run({ respond: c => {
    if (c.data?.mode === 'inspect') return { ...green, status: 'failed', findings: ['Broken build.'] };
    if (c.role === 'deliverer' && deliveries++ > 0) return {
      ok: false, review, headSha: null, draft: true, findings: ['Push rejected.'],
    };
  } });
  assert.equal(result.status, 'draft');
  assert.ok(result.findings.includes('Push rejected.'));
  assert.equal(calls.filter(c => c.data?.mode === 'inspect').length, 1);
});

test('finalization failure has one recovery attempt and reports unconfirmed state', async () => {
  const { result, calls, logs } = await run({ respond: c => c.data?.mode === 'finalize' ? null : undefined });
  assert.equal(calls.filter(c => c.data?.mode === 'finalize').length, 2);
  assert.equal(result.status, 'unconfirmed');
  assert.equal(result.retainedWorktree, preflight.worktreePath);
  assert.ok(logs.at(-1).includes(preflight.worktreePath));
});

test('a fresh final CI failure cannot be reported as ready', async () => {
  const { result } = await run({ respond: c => c.data?.mode === 'finalize' ? {
    ...defaults(c.role, c.data), draft: true,
    ci: { ...green, status: 'failed', findings: ['Current head is red.'] },
  } : undefined });
  assert.equal(result.status, 'draft');
  assert.ok(result.findings.includes('Current head is red.'));
});

test('a contradictory ready-on-red final result triggers draft recovery', async () => {
  let attempts = 0;
  const { result, calls } = await run({ respond: c => {
    if (c.data?.mode === 'finalize' && attempts++ === 0) return {
      ...defaults(c.role, c.data), draft: false, cleanedUp: false,
      retainedWorktree: c.data.worktreePath,
      ci: { ...green, status: 'failed', findings: ['Current head is red.'] },
    };
  } });
  assert.equal(calls.filter(c => c.data?.mode === 'finalize').length, 2);
  assert.equal(calls.at(-1).data.forceDraft, true);
  assert.equal(result.status, 'draft');
  assert.ok(result.findings.includes('Current head is red.'));
});

test('unsafe cleanup retains the worktree in the final report', async () => {
  const { result, logs } = await run({ respond: c => c.data?.mode === 'finalize' ? {
    ...defaults(c.role, c.data), cleanedUp: false, retainedWorktree: c.data.worktreePath,
  } : undefined });
  assert.equal(result.retainedWorktree, preflight.worktreePath);
  assert.ok(logs.some(line => line.includes(`Retained worktree: ${preflight.worktreePath}`)));
});

for (const provider of ['github', 'gitlab']) {
  const cli = provider === 'github' ? 'gh' : 'glab';
  const otherCli = provider === 'github' ? 'glab' : 'gh';

  test(`${provider}: routes only selected provider commands and returns a common review`, async () => {
    const { result, calls } = await run({ provider });
    assert.equal(result.status, 'ready');
    assert.equal(result.provider, provider);
    assert.deepEqual(Object.keys(result.review).sort(), ['number', 'url']);
    assert.match(result.review.url, new RegExp(provider === 'github' ? '/pull/7$' : '/-/merge_requests/7$'));
    assert.ok(!Object.hasOwn(result, 'mr'));
    for (const call of calls.slice(1)) {
      assert.equal(call.data.provider, provider);
      const commands = call.data.providerCommands;
      for (const group of Object.values(commands)) {
        for (const [key, command] of Object.entries(group)) {
          if (key === 'notes') continue;
          assert.ok(command.startsWith(`${cli} `));
          assert.ok(!command.startsWith(`${otherCli} `));
          assert.match(command, /<host>/);
          assert.match(command, /<path>/);
        }
      }
      if (['implementer', 'verifier'].includes(call.role)) assert.deepEqual(commands, {});
      if (call.role === 'deliverer') assert.deepEqual(Object.keys(commands), ['delivery']);
      if (call.data.mode === 'inspect') assert.deepEqual(Object.keys(commands), ['ci']);
      if (call.data.mode === 'finalize') assert.deepEqual(Object.keys(commands), ['delivery', 'ci']);
    }
  });

  test(`${provider}: reuses the repository-local review number across delivery and CI`, async () => {
    const repository = { host: `${provider}.example`, path: 'team/repo' };
    const existing = { ...providerReview(provider, repository), number: 23 };
    const { result, calls } = await run({
      provider,
      respond: c => c.role === 'preflight-gateway'
        ? { ...preflight, provider, repository, review: existing } : undefined,
    });
    assert.deepEqual(result.review, existing);
    for (const call of calls.filter(c => ['deliverer', 'ci-shepherd'].includes(c.role))) {
      assert.deepEqual(call.data.review, existing);
    }
  });

  test(`${provider}: CI still caps repairs and preserves draft on terminal failure`, async () => {
    const { result, calls } = await run({
      provider,
      respond: c => c.data?.mode === 'inspect'
        ? { status: 'failed', url: null, findings: ['Build failed.'] } : undefined,
    });
    assert.equal(result.status, 'draft');
    assert.equal(calls.filter(c => c.role === 'implementer').length, 3);
    assert.equal(calls.filter(c => c.role === 'verifier').length, 1);
    assert.equal(calls.filter(c => c.role === 'deliverer').length, 3);
    assert.equal(calls.filter(c => c.data?.mode === 'inspect').length, 3);
    assert.ok(calls.at(-1).data.forceDraft);
  });

  test(`${provider}: missing verification, CI, or finalization is never ready`, async () => {
    for (const missing of ['verifier', 'inspect', 'finalize']) {
      const { result, calls } = await run({
        provider,
        respond: c => c.role === missing || c.data?.mode === missing ? null : undefined,
      });
      assert.equal(result.status, missing === 'finalize' ? 'unconfirmed' : 'draft');
      if (missing === 'finalize') assert.equal(calls.filter(c => c.data?.mode === missing).length, 2);
    }
  });

  test(`${provider}: preserves custom host and full repository path in every later phase`, async () => {
    const repository = {
      host: 'code.company.example',
      path: provider === 'github' ? 'engineering/repo' : 'engineering/platform/repo',
    };
    const { result, calls } = await run({ provider, repository });
    assert.equal(result.status, 'ready');
    for (const call of calls.slice(1)) assert.deepEqual(call.data.repository, repository);
    assert.ok(result.review.url.startsWith(`https://${repository.host}/${repository.path}/`));
  });

  test(`${provider}: a missing selected CLI returns the preflight fix list`, async () => {
    const { result, calls } = await run({
      provider,
      respond: () => ({
        ...preflight, provider, ready: false, worktreePath: null,
        fixList: [`Install ${cli} and authenticate for the origin host.`],
      }),
    });
    assert.equal(result.status, 'aborted');
    assert.equal(calls.length, 1);
    assert.deepEqual(result.findings, [`Install ${cli} and authenticate for the origin host.`]);
  });
}

test('an unknown provider or missing repository identity cannot start implementation', async () => {
  for (const fields of [{ provider: null }, { provider: 'unsupported' }, { repository: null }]) {
    const { result, calls } = await run({ respond: () => ({ ...preflight, ...fields }) });
    assert.equal(result.status, 'aborted');
    assert.equal(calls.length, 1);
  }
});

test('real git worktrees isolate parallel adapter runs and lock the same branch', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ai-factory-'));
  const remote = join(fixture, 'origin.git');
  const checkout = join(fixture, 'repo');
  const git = (cwd, ...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  }).trim();
  mkdirSync(remote); mkdirSync(checkout);
  try {
    git(remote, 'init', '--bare', '--initial-branch=main');
    git(checkout, 'init', '--initial-branch=main');
    git(checkout, 'config', 'user.name', 'Workflow test');
    git(checkout, 'config', 'user.email', 'workflow@example.invalid');
    writeFileSync(join(checkout, 'README.md'), 'Base\n');
    git(checkout, 'add', 'README.md'); git(checkout, 'commit', '-m', 'initial');
    git(checkout, 'remote', 'add', 'origin', remote); git(checkout, 'push', '-u', 'origin', 'main');
    writeFileSync(join(checkout, 'README.md'), 'User staged changes\n');
    git(checkout, 'add', 'README.md');
    writeFileSync(join(checkout, 'README.md'), 'User unstaged changes\n');
    writeFileSync(join(checkout, 'untracked.txt'), 'User untracked file\n');
    const before = ['status', 'diff', 'cached'].map(kind => kind === 'status'
      ? git(checkout, 'status', '--porcelain=v1')
      : git(checkout, 'diff', ...(kind === 'cached' ? ['--cached'] : [])));
    const paths = [];
    let arrive;
    const bothCreated = new Promise(resolve => { arrive = resolve; });
    let count = 0;
    const adapter = task => async c => {
      const branch = `codex/deliver-${task}`;
      const path = join(fixture, 'repo.worktrees', branch);
      if (c.role === 'preflight-gateway') {
        git(checkout, 'fetch', 'origin');
        git(checkout, 'worktree', 'add', '-b', branch, path, 'origin/main');
        paths.push(path);
        // This is a real git lock failure, not a mocked preflight verdict.
        assert.throws(() => git(checkout, 'worktree', 'add', `${path}-duplicate`, branch));
        count += 1;
        if (count === 2) arrive();
        await bothCreated;
        return { ...preflight, branch, worktreePath: path, task };
      }
      assert.equal(c.data.worktreePath, path);
      if (c.role === 'implementer') {
        writeFileSync(join(path, `${task}.txt`), task);
        return clone(implemented);
      }
      if (c.role === 'verifier') {
        assert.equal(readFileSync(join(path, `${task}.txt`), 'utf8'), task);
      }
      if (c.role === 'deliverer') {
        git(path, 'add', `${task}.txt`); git(path, 'commit', '-m', `implement ${task}`);
        git(path, 'push', '-u', 'origin', branch);
        return { ...defaults(c.role, c.data), headSha: git(path, 'rev-parse', 'HEAD') };
      }
      if (c.data.mode === 'finalize') {
        assert.equal(git(path, 'status', '--porcelain=v1'), '');
        assert.equal(git(path, 'rev-parse', 'HEAD'), git(path, 'rev-parse', `origin/${branch}`));
        git(path, 'worktree', 'remove', path);
      }
    };
    const runs = await Promise.all(['alpha', 'beta'].map(task => run({ args: task, respond: adapter(task) })));
    assert.ok(runs.every(run => run.result.status === 'ready'));
    const after = ['status', 'diff', 'cached'].map(kind => kind === 'status'
      ? git(checkout, 'status', '--porcelain=v1')
      : git(checkout, 'diff', ...(kind === 'cached' ? ['--cached'] : [])));
    assert.deepEqual(after, before);
    assert.equal(readFileSync(join(checkout, 'untracked.txt'), 'utf8'), 'User untracked file\n');
    const worktrees = git(checkout, 'worktree', 'list', '--porcelain');
    for (const path of paths) assert.ok(!worktrees.includes(path));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
