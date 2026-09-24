# AI Factory

`/ai-factory:deliver <spec-path | task description>` implements a task in a shared
git worktree and delivers it to a supported remote VCS. An independent
verifier checks the original input before delivery. The workflow finishes ready
only after green CI is confirmed. Unresolved work is delivered as a draft with
failure details.

```bash
claude plugin install ai-factory@waytoodanny
```

```text
/ai-factory:deliver specs/add-validation.md
/ai-factory:deliver Add validation for empty project names
```

Use Claude Code 2.1.281 or later and enable dynamic workflows. Preflight detects the
provider from `origin` and requires only its CLI:

| Provider | CLI | Review request | CI |
| --- | --- | --- | --- |
| GitHub | `gh` | Pull request | PR checks, including Actions and external check/status results |
| GitLab | `glab` | Merge request | GitLab pipelines and jobs |

Authenticate the selected CLI for the origin host. The origin default branch must
resolve, and the repository must support draft review requests. Custom GitHub
Enterprise and GitLab hosts are confirmed through their repository APIs.
Unsupported or unconfirmed hosts fail preflight with a fix list.

For unattended execution, use session auto/bypass mode or allow rules for the
workflow, file edits, `git`, the selected CLI, setup commands, and repository
quality gates. The workflow does not change permission rules or request human input.

Preflight checks these prerequisites without repairing them. It snapshots spec
content before creating a worktree, so an ignored or external spec still works.
It chooses an existing PR/MR by task meaning; uncertain matches create a new branch.
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
blocked/manual pipelines, and unknown results keep the review request draft. Finalization
makes one confirmation poll; one additional recovery call is allowed if it fails.
These are poll/repair limits, not wall-clock deadlines.

The CI agent confirms the review state and removes the worktree only when all work
is committed and pushed. Otherwise the report includes its path. If tool access
fails even during finalization recovery, the result is **unconfirmed**, with the
known review and worktree details; it must not be read as a successful delivery.

## Provider contract

The orchestration and five agents are shared. Provider command recipes live in
the `providers` object in `workflows/deliver.js`; the script passes only the selected
recipes to delivery and CI. Implementers and verifiers do not need provider commands.
This keeps worktree setup, retry limits, findings, and cleanup consistent.

Preflight returns `provider`, canonical `repository: {host, path}`, and
`review: {number, url}` (or null). GitLab's project-local IID and GitHub's PR number
both map to `review.number`. CI maps to `{status, url, findings}`, where status is
`success`, `failed`, `exhausted`, or `unknown`. Final results include the provider
and review so callers do not need provider-specific field names.

All remote operations specify the selected host and repository. GitHub body
updates and draft transitions use separate commands. GitHub CI must check the
current PR head and all reported checks, including legacy statuses; a single green
Actions run or an empty required-check list is insufficient. GitLab CI must match
the source head, including for merged-results pipelines. An older green result
never counts for either provider.

## Validation

From the marketplace root, run:

```bash
claude plugin validate .
claude plugin validate plugins/ai-factory
node --test tests/ai-factory-deliver.test.mjs
```

The tests execute the actual workflow script with schema-checked agent adapters.
They cover original-input propagation, missing results, both repair caps, draft
state, poll settings, review reuse, provider routing, recovery, and cleanup reports.
A temporary local git remote exercises two concurrent adapter runs, branch locking,
cleanup, and preservation of staged, unstaged, and untracked user changes.

The adapters do not test model judgment or real hosting API requests. Before
production use, run this checklist in an authenticated Claude session against
disposable GitHub and GitLab projects with CI:

- [ ] Trigger a preflight failure and check the fix list and unchanged checkout.
- [ ] Deliver both a spec file and a raw description.
- [ ] Force verification findings through both repair rounds; inspect the draft.
- [ ] Exercise pending, failed, then green CI, including an older green pipeline.
- [ ] Exhaust both CI repairs and confirm a draft with failure logs.
- [ ] Run two distinct tasks together with a dirty main checkout; compare status.
- [ ] Re-run an active task and confirm preflight rejects its locked branch.
- [ ] Re-run a completed task with an open PR/MR and confirm it reuses that review.
- [ ] Check removal of clean, pushed worktrees and retention of local work.
- [ ] Check custom-host routing and the fix list for a missing selected CLI.
- [ ] On GitHub, check separate body/draft updates and mixed Actions/external checks.
