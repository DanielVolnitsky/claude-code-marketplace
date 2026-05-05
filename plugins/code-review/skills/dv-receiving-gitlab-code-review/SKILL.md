---
name: dv-receiving-gitlab-code-review
description: Use when you have an open GitLab MR and want to triage unresolved review threads — detect MR from current branch or accept MR id/URL, analyze open threads, display severity table, and act on threads interactively via glab
user_invocable: true
---

# dv-receiving-gitlab-code-review

Triage unresolved GitLab MR review threads interactively.

## Step 1 — Detect MR and Fetch Threads (silently, via subagent)

Spawn a subagent using the `Agent` tool.

**Subagent prompt** (fill in `<branch-or-id>` from the skill argument, or `"auto"` if none given):

```
Return only a JSON object.

Input: "<branch-or-id>"  (if "auto", detect from git)

Steps:
1. If input is "auto": run `git branch --show-current` to get the branch name, then run `glab mr list --source-branch <branch> --output json`.
   If input looks like an MR id or URL, resolve it to an iid and skip branch detection.
2. Parse the MR list:
   - 0 results → return {"error": "No open MR found for branch '<branch>'. Pass an MR ID or URL explicitly."}
   - >1 results → return {"multiple": true, "mrs": [{"iid": N, "title": "...", "url": "..."}]}
   - 1 result  → note the iid, web_url, source_branch
3. Run: glab api --paginate "projects/:fullpath/merge_requests/<iid>/discussions" --output json
4. Include a thread if EITHER condition holds:
   - resolvable=true AND resolved=false  (inline/resolvable thread)
   - resolvable=false AND at least one note has system=false  (general MR comment)
   Skip threads where every note has system=true (GitLab activity events like "assigned to X").
   For each included thread collect:
   - discussion_id (the thread's "id" field)
   - resolvable: the thread-level resolvable boolean
   - notes: array of {author_username, body} for every note where system=false
   - thread_url: web_url + "#note_" + first note's id
   - file: from the first note's position.new_path (or null if no position)
   - line: from the first note's position.new_line; if null, try position.old_line (or null if no position)
5. Return:
   {
     "mr_iid": <N>,
     "mr_url": "<url>",
     "source_branch": "<branch>",
     "unresolved_threads": [
       {"discussion_id": "...", "notes": [...], "thread_url": "...", "file": "...", "line": <N or null>}
     ]
   }
```

## Step 2 — Handle Subagent Result

Parse the JSON the subagent returned:

- `error` key present → print the error message and stop.
- `multiple` key present → print a numbered list of MRs, ask user to pick one, then re-run the subagent with the chosen iid.
- `unresolved_threads` is empty → print `No unresolved review threads on MR !<iid>.` then enter the interactive loop (refresh available).
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

To get `:iid` and `:discussion_id`: parse the discussions JSON from Step 2. The `iid` is the MR internal ID, `discussion_id` is each thread's `id` field.