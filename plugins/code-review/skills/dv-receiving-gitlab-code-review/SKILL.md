---
name: dv-receiving-gitlab-code-review
description: Use when you have an open GitLab MR and want to triage unresolved review threads — detect MR from current branch, analyze open threads, display severity table, and act on threads interactively via glab
user_invocable: true
disable-model-invocation: true
allowed-tools: glab
---

# dv-receiving-gitlab-code-review

Triage unresolved GitLab MR review threads with human-in-the-loop.

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

## Step 3 — Display Analysis Table

Categorize comments by actual severity. Sort by severity descending (critical first). Number threads `#1`, `#2`, … for this session.

| # | Comment | Location | Severity | Recommended action | Thread link |
|---|---------|----------|----------|--------------------|-------------|

**Comment:** The original comment text from the GitLab thread (first note of the discussion), verbatim.

**Location:** Format as `file/path.py:42` (file and line number). If no line number, just `file/path.py`. If no file info, leave blank.

**Severity scale:**

- `critical` — breaks functionality, security issue, data loss risk; must fix before merge
- `major` — significant logic/design flaw, likely to cause bugs; should fix before merge
- `minor` — correctness concern, improvement that would noticeably help quality
- `nitpick` — style, naming, formatting; optional
- `question` — reviewer asking for clarification; no action necessarily required

**Thread link:** Direct URL to the specific discussion thread on the MR.

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
