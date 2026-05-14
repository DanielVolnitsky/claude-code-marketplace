---
name: dv-implement-from-ticket
description: Use when you need to implement a ticket end-to-end — fetch ticket details, plan the implementation with human approval, write code, commit, push, open a PR, and follow CI to green
user_invocable: true
disable-model-invocation: false
allowed-tools: Read
---

Implement a software ticket end-to-end: fetch context, plan, get approval, code, commit, push, open PR, ride CI to green.

## Step 1 — Identify the Ticket

If the user supplied a ticket identifier (e.g. `PROJECT-123`, `#42`, a URL), use it.

Otherwise, detect the ticket from the current git branch name. Common patterns:
- `feature/PROJECT-123-short-description`
- `PROJECT-123-short-description`
- `fix/42-short-description`

If no ticket can be determined, ask the user: `Which ticket should I implement? Please provide an ID or URL.`

## Step 2 — Fetch Ticket Details

Retrieve the full ticket using whichever tracker is available:

- **Jira**: use `mcp__atlassian__getJiraIssue` with the issue key
- **GitLab issue**: `glab api projects/:fullpath/issues/<iid>`
- **GitHub issue**: `gh issue view <number>`
- **Linear / other**: ask the user to paste the description if no tool is available

Extract and remember:
- `ticket_id` — canonical identifier (e.g. `PROJECT-123`)
- `title` — one-line summary
- `description` — full body / acceptance criteria
- `ticket_url` — direct link to the ticket

If the ticket is not found or access is denied, report the error and stop.

## Step 3 — Understand the Codebase Context

Before planning, read enough of the codebase to form a concrete implementation plan. At minimum:

1. Identify which files, modules, or layers are relevant to this ticket.
2. Read each relevant file (use `Read`; spawn an `Explore` subagent for broad searches).
3. Note any existing patterns (naming, structure, test style) you must follow.

Do **not** propose a plan against code you haven't actually read.

## Step 4 — Produce an Implementation Plan

Draft a concise plan covering:

1. **Summary** — one paragraph: what the ticket asks for and how you'll deliver it.
2. **Files to change** — table:

   | File | Change type | What changes |
   |------|-------------|--------------|
   | `src/foo/bar.py` | modify | Add `process_event()` method |
   | `tests/foo/test_bar.py` | create | Unit tests for `process_event()` |

3. **Open questions** — numbered list of anything that blocks a confident implementation (ambiguous requirements, missing context, design trade-offs). Leave blank if none.

4. **Out of scope** — anything the ticket mentions but you will not address in this PR, with a brief reason.

## Step 5 — Resolve Open Questions

If the plan has no open questions, skip this step.

Otherwise batch them into one or more `AskUserQuestion` calls (up to 4 questions per call). Provide enough context in each question that the user can answer without rereading the ticket.

After answers land, update the plan to reflect the decisions.

## Step 6 — Request Approval

Ask the user to approve via `AskUserQuestion`:

- `Approve` — proceed to implement
- `Revise` — user will describe what to change; loop back to Step 5 with their input
- `Cancel` — stop without making any changes

Do not advance until the user picks `Approve`.

## Step 7 — Create or Switch to a Branch

Check the current branch:

```
git branch --show-current
```

If already on a feature branch that matches this ticket, stay on it.

Otherwise, derive a branch name from the ticket:

```
git checkout -b feature/<ticket_id>-<slug>
```

Where `<slug>` is a 2–5 word kebab-case summary of the ticket title.

If the branch already exists remotely, check it out and pull:

```
git checkout feature/<ticket_id>-<slug>
git pull --ff-only
```

If pull fails (diverged), stop and tell the user.

## Step 8 — Implement

Apply every change listed in the approved plan:

- Use `Read` + `Edit` (or `Write` for new files) for all code changes.
- Follow the patterns and conventions you observed in Step 3.
- Keep changes minimal and on-scope — do not bundle unrelated cleanup.
- After writing code, run fast-feedback checks if they're clearly available (formatter, linter, type-check for touched files). Skip project-wide test suites — CI will cover that.

## Step 9 — Commit & Push

Stage only the files you touched (not `git add -A`). Create a single commit following the repository's existing commit convention.

The commit message must reference the ticket:
- If the repo uses conventional commits: `feat(scope): short description [TICKET-ID]`
- Otherwise: follow whatever format recent commits use, and append `[TICKET-ID]` to the subject if it isn't already there.

Push to the remote branch:

```
git push -u origin <branch>
```

If the push is rejected (non-fast-forward), stop and tell the user — do not force-push.

Print the commit SHA and confirm the push succeeded.

## Step 10 — Open a Pull / Merge Request

Check whether a PR/MR already exists for this branch. If not, create one.

**GitLab MR:**
```
glab mr create \
  --title "<ticket_id>: <ticket title>" \
  --description "$(cat <<'EOF'
## Summary
<1–3 bullet points describing what was changed and why>

## Ticket
<ticket_url>

## Test plan
- [ ] <what to verify manually or via CI>
EOF
)" \
  --assignee @me
```

**GitHub PR:**
```
gh pr create \
  --title "<ticket_id>: <ticket title>" \
  --body "$(cat <<'EOF'
## Summary
<1–3 bullet points>

## Ticket
<ticket_url>

## Test plan
- [ ] <what to verify>
EOF
)"
```

Print the MR/PR URL.

## Step 11 — Follow the CI Pipeline

After the push, find the pipeline triggered by the new commit.

**GitLab:**
```
glab ci status --branch <branch>
```

**GitHub Actions:**
```
gh run list --branch <branch> --limit 1
```

If no pipeline appears yet, wait ~15 s and retry — CI can take a moment to start.

Poll status until it leaves `created` / `pending` / `running` / `queued` / `in_progress`:

- Poll every 30 s
- Cap total wait at 15 minutes; if still running, stop and give the user the pipeline URL
- Print a one-line status update only when the status **changes**

Terminal statuses:
- `success` / `completed` → print the pipeline URL and proceed to Step 13
- `failed` / `canceled` → proceed to Step 12
- `manual` / `skipped` → report and hand off to the user

## Step 12 — React to CI Failure

1. Identify failed jobs/checks.

   **GitLab:** `glab api projects/:fullpath/pipelines/<pipeline_id>/jobs`  
   **GitHub:** `gh run view <run_id> --json jobs`

   Ignore jobs with `allow_failure: true`.

2. For each failed job, fetch the tail of its log:

   **GitLab:** `glab ci trace <job_id>`  
   **GitHub:** `gh run view --log-failed <run_id>`

   Focus on the last ~200 lines.

3. Diagnose root cause:

   - **Caused by our changes** (test failure, lint, type error, broken build) → fix it, commit, push, loop back to Step 11
   - **Pre-existing flake** (transient network, known-flaky test) → offer to retry the job; do not change code
   - **Infra / environment failure** (runner down, image pull error) → surface to the user; do not try to fix in code

4. Cap the CI fix loop at **3 iterations**. If still red after the third attempt, stop and hand off with:
   - What was tried each iteration
   - Current failing jobs and their likely root causes
   - Pipeline URL

## Step 13 — Done

Print a brief summary:

```
Implementation complete.

Ticket:   <ticket_id> — <title>
Branch:   <branch>
Commit:   <sha>
PR/MR:    <url>
Pipeline: <url> — <status>
```

# Gotchas

- Read files before planning; never propose changes against code you haven't seen.
- Never force-push; if the remote has diverged, stop and tell the user.
- Keep commits scoped to this ticket — no opportunistic cleanup.
- If the ticket is vague, surface ambiguities in Step 5 rather than guessing.
