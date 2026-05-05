---
name: dv-receiving-gitlab-code-review
description: Use when you have an open GitLab MR and want to triage unresolved review threads — detect MR from current branch or accept MR id/URL, analyze open threads, display severity table, and act on threads interactively via glab
user_invocable: true
---

# dv-receiving-gitlab-code-review

Triage unresolved GitLab MR review threads interactively.

## Step 1 — Detect MR and Fetch Threads (silently, via subagent)

Read the file `gitlab-mr-unresolved-threads-supplier.md` (sibling to this skill file) to get the subagent prompt.

Replace the literal text `"<branch-or-id>"` in that prompt with the actual argument passed to this skill (use `"auto"` if no argument was given).

Spawn a subagent using the `Agent` tool with the resulting prompt.

## Step 2 — Handle Subagent Result

Parse the JSON the subagent returned:

- `error` key present → print the error message and stop.
- `multiple` key present → print a numbered list of MRs, ask user to pick one, then re-run the subagent with the chosen iid.
- `threads` is empty → print `No unresolved review threads on MR !<iid>.` then enter the interactive loop (refresh available).
- Otherwise, → proceed to Step 3.

## Step 3 — Display Analysis Table

Sort by severity descending (critical first). Number threads `#1`, `#2`, … for this session.

| # | Summary | Location | Severity | Recommended action | Thread link |
|---|---------|----------|----------|--------------------|-------------|

**Location:** Format as `file/path.py:42` (file and line number). If no line number, just `file/path.py`. If no file info, leave blank.

**Severity scale:**
- `critical` — breaks functionality, security issue, data loss risk; must fix before merge
- `major` — significant logic/design flaw, likely to cause bugs; should fix before merge
- `minor` — correctness concern, improvement that would noticeably help quality
- `nitpick` — style, naming, formatting; optional
- `question` — reviewer asking for clarification; no action necessarily required

**Thread link:** Direct URL to the specific discussion thread on the MR.


## Step 4 — Interactive Loop

Stay active after the table. Accept these commands:

| Command | Action |
|---------|--------|
| `fix #N` | Print: `fix skill not yet available — coming soon` |
| `reply #N <message>` | Run `glab api` POST to add comment. Hook prompts `[y/N]` — do NOT prompt yourself. |
| `resolve #N` | If thread has resolvable=false, print: `Thread #N is a general comment and cannot be resolved via API.` Otherwise run `glab api` PUT to resolve thread. Hook prompts `[y/N]` — do NOT prompt yourself. |
| `refresh` | Re-fetch open threads, reprint table with fresh numbering from `#1`. |

**IMPORTANT for resolve and reply:** Do NOT ask the user for confirmation in the loop. The shell hook handles the single confirmation. If the hook blocks (user says N), the action is not executed — continue the loop normally.

### glab API calls to use

**Reply (POST new comment to thread):**
```bash
glab api --method POST "projects/:fullpath/merge_requests/:iid/discussions/:discussion_id/notes" \
  --field "body=<message>"
```

**Resolve thread (PUT):**
```bash
glab api --method PUT "projects/:fullpath/merge_requests/:iid/discussions/:discussion_id" \
  --field "resolved=true"
```

To get `:iid` and `:discussion_id`: parse the discussions JSON from the subagent result in Step 1. The `iid` is the MR internal ID, `discussion_id` is each thread's `id` field.