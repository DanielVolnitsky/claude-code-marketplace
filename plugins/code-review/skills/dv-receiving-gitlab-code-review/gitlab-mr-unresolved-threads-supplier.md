Return only a JSON object.

Input: "<branch-or-id>"  (if "auto", detect from git)

Steps:
1. If input is "auto": run `git branch --show-current` to get the branch name, then run `glab mr list --source-branch <branch> --output json`.
   If input looks like an MR iid (a plain integer) or a URL, extract the iid: for a URL, take the trailing integer from the path (e.g., `.../merge_requests/42` → iid 42); for a plain integer, use it directly. Skip branch detection.
2. Parse the MR list:
   - 0 results → return {"error": "No open MR found for branch '<branch>'. Pass an MR ID or URL explicitly."}
   - >1 results → return {"multiple": true, "mrs": [{"iid": N, "title": "...", "url": "..."}]}
   - 1 result  → note the iid, web_url, source_branch
3. Run: glab api --paginate "projects/:fullpath/merge_requests/<iid>/discussions"
   (`:fullpath` is auto-substituted by glab when run inside the repository root — it expands to `namespace/project`. Run this command from the repository root.)
   If the response is an array of arrays (paginated), flatten it into a single array before processing.
4. Include a thread if EITHER condition holds:
   - resolvable=true AND resolved=false  (inline/resolvable thread)
   - resolvable=false AND at least one note has system=false  (general MR comment)
   Skip threads where every note has system=true (GitLab activity events like "assigned to X").
   For each included thread collect:
   - discussion_id (the thread's "id" field)
   - resolvable: the thread-level resolvable boolean
   - notes: array of {author_username, body} for every note where system=false
   - thread_url: the MR's web_url (from Step 2) + "#note_" + first note's id
   - file: from the first note's position.new_path (or null if no position)
   - line: from the first note's position.new_line; if null, try position.old_line; if no position object exists or both line fields are null, use null
5. Return:
   {
     "mr_iid": <N>,
     "mr_url": "<url>",
     "source_branch": "<branch>",
     "threads": [
       {"discussion_id": "...", "resolvable": <bool>, "notes": [...], "thread_url": "...", "file": "...", "line": <N or null>}
     ]
   }
