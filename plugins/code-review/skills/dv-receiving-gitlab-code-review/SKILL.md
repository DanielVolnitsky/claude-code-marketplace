---
name: dv-receiving-gitlab-code-review
description: Use when you need to handle unresolved GitLab code review discussions — detect MR of the current branch, analyze open discussions, display severity table, propose a fix|reaction plan with open questions, then on approval apply fixes, commit, push, and follow the CI pipeline to green
user_invocable: true
disable-model-invocation: false
---

Triage unresolved GitLab MR review threads with human-in-the-loop, then fix, push, and ride the pipeline to green.

## Step 1 — Detect MR and Fetch Threads

Read the file `gitlab-mr-unresolved-threads-supplier.md` (sibling to this skill file) to get the subagent prompt.

Replace the literal text `"<branch-or-id>"` in that prompt with `"auto"`.

Spawn a subagent using the `Agent` tool with the resulting prompt.

## Step 2 — Handle Subagent Result

Parse the JSON the subagent returned:

- `error` key present → print the error message and stop.
- `multiple` key present → print a numbered list of MRs, ask user to pick one, then re-run the subagent with the chosen iid.
- `threads` is empty → print `No unresolved review threads on MR !<iid>.` and stop.
- Otherwise, → proceed to Step 3.

Remember `mr_iid`, `mr_url`, and `source_branch` — you will need them in later steps.

## Step 3 — Filter Non-Actionable Threads

Before displaying anything, discard threads whose first note is a summary or verdict rather than actionable feedback. Drop a thread if the comment:

- Reads as an overall review verdict (e.g. "Ready to merge?: 🟢 Yes — 0 Critical, 0 Important, 3 Minor")
- Is a pure approval or LGTM without specific feedback (e.g. "LGTM", "Approved", "Looks good to me")
- Is an automated bot summary (e.g. pipeline status, coverage report, review-score rollup)
- Contains no concrete suggestion, question, or concern directed at a specific piece of code

If all threads are filtered out after this step, print `No actionable review threads on MR !<iid>.` and stop.

## Step 4 — Display Analysis Results

For each discussion:

1. Gather all the necessary context. Read the referenced file(s) to confirm context before proposing anything. Do not plan against code you haven't actually
   read.
2. Decide whether the discussion is legitimate.
3. Assign a severity:

**Severity scale:**

- **`critical` — must fix: will definitely lead to significant issues if left as is**:
    - e.g. bugs, security issues, data loss risks, broken functionality
- **`important` — should fix: may not lead to significant issues if left as is right now, but is a serious technical debt for the future**:
    - e.g. architecture problems, poor error handling, testing problems
- **`minor` — nice to have: definitely will not lead to significant issues, is not a serious technical debt, just makes a code objectively better**
    - e.g. minor optimization opportunities, documentation polish
- **`nitpick` — style, naming, formatting; optional**
- **`question` — reviewer asking for clarification; no action necessarily required**
- **`junk` - doesn't make sense, not worth reacting to**

4. Decide a **proposed action** per thread:

- `fix` — apply a concrete code change
- `respond` — post a reply on the thread instead of changing code (use for `question` severity, for disagreements, or when you need the reviewer's input)
- `skip` — intentionally do nothing (typical for `nitpick` the user may wish to ignore)
- `defer` — acknowledge out-of-scope; will not be addressed in this MR
- some other action that seems appropriate

After processing all the discussions:

1. Sort them by severity descending (critical first). Number threads `#1`, `#2`, … for this session.
2. Display a table described in Output section.

### Output

1. The table:

| # | Comment | Severity | Recommended action | Location | Thread link |
|---|---------|----------|--------------------|----------|-------------|

- **Comment:** The original comment text from the GitLab thread (first note of the discussion), verbatim.
- **Location:** Format as `file/path.py:42` (file and line number). If no line number, just `file/path.py`. If no file info, leave blank.
- **Thread link:** Direct URL to the specific discussion thread on the MR.

2. List of open questions that need human-in-the-loop advice or decision:

**Open questions:** numbered list, where number = thread number; short phrase pointing to ambiguity that blocks a confident fix; absent if none present

Flag a thread with an open question when any of these hold (not exhaustive list):

- The reviewer's comment admits more than one reasonable interpretation
- The fix would expand scope beyond the MR's intent (new abstraction, broader refactor, dependency change)
- The code location has drifted and the intended target is ambiguous
- The reviewer asked a direct question that only the user can answer (intent, product decision, historical context)
- You are choosing between two or more viable implementations and the trade-off is not obvious

### Critical Rules

**DO:**

- Categorize by actual severity
- Explain a logic behind your verdict
- Give a clear verdict

**DON'T:**

- Say "looks valid" without checking
- Mark nitpicks as Critical
- Give feedback on code you didn't actually read
- Be vague ("improve error handling")
- Avoid giving a clear verdict

## Step 5 — Resolve Open Questions

If the plan has no open questions, skip this step.

Otherwise, collect every open question into a single `AskUserQuestion` call (batch up to 4 questions per call; chain multiple calls if needed). Frame each
question with enough context that the user can answer without re-reading the thread — quote the relevant snippet and list the concrete options you're choosing
between.

After answers land, reprint the **updated plan table** reflecting the decisions.

## Step 6 — Request Approval

Ask the user to approve the (possibly revised) plan via `AskUserQuestion`:

- `Approve` — proceed to apply, commit, and push
- `Revise` — user will describe what to change; loop back to Step 5 with their input
- `Cancel` — stop without making any changes

Do not advance until the user picks `Approve`.

## Step 7 — Apply Actions

For each thread whose action is `fix`:

- Use `Read` + `Edit` (or `Write` for new files) to apply the change
- Keep each edit minimal and on-scope for the thread — do not bundle unrelated cleanup
- If the project has an obvious fast-feedback check available (e.g. a formatter, linter, or single-file type-check that's clearly wired up), run it for the
  files you touched; skip project-wide test suites at this point — the pipeline will cover that

For each thread whose action is `respond`:

- Post the reply with:
  ```
  glab api projects/:fullpath/merge_requests/<iid>/discussions/<discussion_id>/notes \
    -f body="<your reply>"
  ```
- Keep replies short and specific; quote the part of the comment you're answering if the thread is long.

`skip` and `defer` threads require no action here, but track them — Step 12 will offer to reply/resolve.

## Step 8 — Commit & Push

Create one commit covering all code changes from Step 7 (multiple commits only if the user explicitly asked for it).

Follow the repository's existing commit convention.

Stage only the files you touched (not `git add -A`). Push to the MR's `source_branch`.

If the push is rejected (non-fast-forward), stop and tell the user — do not force-push. They may have local or remote changes that need reconciling.

Print the commit SHA and confirm the push succeeded.

## Step 9 — Follow the CI Pipeline

After the push, find the pipeline triggered by the new commit:

```
glab ci status --branch <source_branch>
```

or, for richer data:

```
glab api projects/:fullpath/pipelines?ref=<source_branch>&per_page=1
```

Match the pipeline by `sha` (the commit you just pushed). If no pipeline shows up yet, wait ~15s and retry — GitLab can take a moment to create it.

Poll status until it leaves `created` / `pending` / `running` / `preparing`:

- Poll every 30s
- Cap total wait at 15 minutes; if still running past that, stop and hand off to the user with the pipeline URL
- On each poll, print a one-line status update only when the status **changes** (avoid spam)

Terminal statuses:

- `success` → print pipeline URL, proceed to Step 12
- `failed` / `canceled` → proceed to Step 11
- `manual` / `skipped` → report and hand off to the user

## Step 10 — React to CI Failure

1. Identify failed jobs:

   ```
   glab api projects/:fullpath/pipelines/<pipeline_id>/jobs
   ```

   Keep jobs where `status == "failed"`. Ignore jobs that failed but have `allow_failure: true`.

2. For each failed job, fetch the tail of its log:

   ```
   glab ci trace <job_id>
   ```

   (Or `glab api projects/:fullpath/jobs/<job_id>/trace`.) Focus on the last ~200 lines — that's usually where the real error lives.

3. Diagnose the root cause. Distinguish:

    - **Code caused by our fixes** (test failure, lint failure, type error, broken build) → fix it
    - **Pre-existing flake unrelated to our changes** (transient network error, known-flaky test) → surface to the user, offer to retry the job (
      `glab ci retry <job_id>`) rather than code changes
    - **Infra / environment failure** (runner down, image pull error) → surface to the user; do not try to fix in code

4. If a code fix is needed, apply the fix, commit, push, and **loop back to Step 9**.

5. Cap the CI fix loop at **3 iterations**. If the pipeline is still red after the third attempt, stop and hand off to the user with:
    - List of what was tried each iteration
    - Current failing jobs and their likely root causes
    - Pipeline URL

# Gotchas
- 
