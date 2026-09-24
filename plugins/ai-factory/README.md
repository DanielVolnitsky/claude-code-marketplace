# AI Factory

`/ai-factory:deliver <spec-path | task description>` implements and independently
verifies a task in a shared worktree, then delivers it to a supported remote VCS.
Confirmed green CI permits a ready result; unresolved findings keep it draft.

## Setup

```bash
claude plugin install ai-factory@waytoodanny
```

```text
/ai-factory:deliver specs/add-validation.md
/ai-factory:deliver Add validation for empty project names
```

Requires Claude Code **2.1.281+**, dynamic workflows enabled, a resolvable `origin`
default branch, draft-review support, and the selected CLI authenticated for the
origin host:

| Provider | CLI | Review / CI |
| --- | --- | --- |
| GitHub | `gh` | PR / Actions and external checks or statuses |
| GitLab | `glab` | MR / pipelines and jobs |

For unattended runs, use auto/bypass mode or allow the workflow, file edits,
`git`, selected CLI, setup commands, and quality gates. The workflow neither
changes permissions nor requests human input.

## Workflow

1. **Preflight:** Detect the provider from `origin`; confirm custom hosts through
   repository APIs. Failed prerequisites or unknown providers return a fix list
   without repairs. Snapshot the input, including ignored/external specs. Reuse a
   review matched by task meaning; uncertain matches get a new branch. Reject
   branches already checked out elsewhere.
2. **Implement and verify:** Run local gates and independently check the original
   input. Allow **two repair rounds**, each with a fresh implementer and verifier.
   Failed gates or missing results remain unresolved.
3. **Deliver and check CI:** Open/update the review with failure details. Allow
   **two CI repairs** with fresh implementers, without re-verification; previous
   verification findings persist. Each inspection allows **20 polls, 15 seconds
   apart**. Missing, blocked/manual, unknown, or exhausted CI keeps the review draft.
4. **Finalize:** Make **one confirmation poll**, with **one recovery call** on
   failure. Confirm review state, then remove the worktree only if all work is
   committed and pushed; otherwise report its path. Failed recovery returns
   **unconfirmed**, with known review/worktree details, never success.

These limits bound retries and polls, not wall-clock time. All five agents share
`../<repo>.worktrees/<branch>` and explicit script-defined model/effort settings.
The user's checkout may be dirty. Confinement is prompt-only: the API has no
per-agent cwd option.

## Provider contract

The shared workflow selects command recipes from `providers` in
[deliver.js](workflows/deliver.js). Delivery and CI receive only their selected
recipes; implementers and verifiers need none. Every remote command specifies the
host and repository.

- Preflight: `provider`, canonical `repository: {host, path}`, and nullable
  `review: {number, url}`. `number` maps to a GitHub PR number or GitLab project-local IID.
- CI: `{status, url, findings}`; status is `success`, `failed`, `exhausted`, or `unknown`.
- Final results include the provider and review.

Only CI for the **pushed head** counts. GitHub checks all reported checks and legacy
statuses, not one green Actions run or an empty required-check list; body updates
and draft transitions are separate commands. GitLab verifies the source head,
including merged-results pipelines. Older green results never count.

## Validation

From the marketplace root, run:

```bash
claude plugin validate .
claude plugin validate plugins/ai-factory
node --test tests/ai-factory-deliver.test.mjs
```

Schema-checked adapters execute the actual script, covering input propagation,
missing results, repair caps, draft state, polls, review reuse, provider routing,
recovery, and cleanup. Real git fixtures check concurrent runs, branch locks, and
preservation of staged, unstaged, and untracked changes.

Model judgment and real hosting APIs require live testing. Before production,
use authenticated Claude sessions and disposable GitHub/GitLab projects with CI:

- [ ] Preflight failures, missing CLI, custom-host routing, and unchanged checkout.
- [ ] Spec-file and description inputs; exhausted verification repairs produce a draft.
- [ ] Pending/red/green/stale CI; exhausted CI repairs produce a draft with logs.
- [ ] Parallel tasks preserve a dirty checkout; active-task reruns reject locked branches.
- [ ] Completed-task reruns reuse open reviews; cleanup removes clean/pushed worktrees and retains local work.
- [ ] GitHub body/draft updates and mixed Actions/external checks.
