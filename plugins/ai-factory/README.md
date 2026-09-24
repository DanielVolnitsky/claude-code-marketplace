# AI Factory

`/ai-factory:deliver <spec-path | task description>` implements a task in a shared
git worktree and delivers it to an open GitLab MR. An independent verifier checks
the original input before delivery. The workflow finishes ready only after green
CI is confirmed. Unresolved work is delivered as a draft with failure details.

```bash
claude plugin install ai-factory@waytoodanny
```

```text
/ai-factory:deliver specs/add-validation.md
/ai-factory:deliver Add validation for empty project names
```

Use Claude Code 2.1.281 or later, enable dynamic workflows, and authenticate `glab`
for the GitLab host used by `origin`. The origin default branch must resolve.
For unattended execution, use session auto/bypass mode or allow rules for the
workflow, file edits, `git`, `glab`, setup commands, and repository quality gates.
The workflow does not change permission rules or request human input.

Preflight checks these prerequisites without repairing them. It snapshots spec
content before creating a worktree, so an ignored or external spec still works.
It chooses an existing MR by task meaning; uncertain matches create a new branch.
It never reuses a branch checked out by another worktree.

Each run uses `../<repo>.worktrees/<branch>`. All five agents share that path and
receive explicit model and effort settings from the script. The user's checkout
can be dirty. Worktree confinement relies on agent instructions, as Claude's
workflow API has no per-call cwd option.

The initial implementation and verification can be followed by **two repair
rounds**, each with a fresh implementer and verifier. Failed local gates and
missing agent results are unresolved findings. CI can trigger **two further
repairs**, using fresh implementers without another verifier call. Findings left
by verification remain unresolved during CI repair.

Each CI inspection makes at most **20 polls**, with **15 seconds** between polls.
Only a green pipeline for the pushed head counts. Exhausted polling, missing CI,
blocked/manual pipelines, and unknown results keep the MR draft. Finalization
makes one confirmation poll; one additional recovery call is allowed if it fails.
These are poll/repair limits, not wall-clock deadlines.

The CI agent confirms the MR state and removes the worktree only when all work
is committed and pushed. Otherwise the report includes its path. If tool access
fails even during finalization recovery, the result is **unconfirmed**, with the
known MR and worktree details; it must not be read as a successful delivery.

## Validation

From the marketplace root, run:

```bash
claude plugin validate .
claude plugin validate plugins/ai-factory
node --test tests/ai-factory-deliver.test.mjs
```

The tests execute the actual workflow script with schema-checked agent adapters.
They cover original-input propagation, missing results, both repair caps, draft
state, poll settings, MR reuse, recovery, and cleanup reports. A temporary local
git remote exercises two concurrent adapter runs, branch locking, cleanup, and
preservation of staged, unstaged, and untracked user changes.

The adapters do not test model judgment or real GitLab requests. Before production
use, run this checklist in an authenticated Claude session against a disposable
GitLab project with CI:

- [ ] Trigger a preflight failure and check the fix list and unchanged checkout.
- [ ] Deliver both a spec file and a raw description.
- [ ] Force verification findings through both repair rounds; inspect the draft.
- [ ] Exercise pending, failed, then green CI, including an older green pipeline.
- [ ] Exhaust both CI repairs and confirm a draft with failure logs.
- [ ] Run two distinct tasks together with a dirty main checkout; compare status.
- [ ] Re-run an active task and confirm preflight rejects its locked branch.
- [ ] Re-run a completed task with an open MR and confirm it reuses the MR.
- [ ] Check removal of clean, pushed worktrees and retention of local work.
