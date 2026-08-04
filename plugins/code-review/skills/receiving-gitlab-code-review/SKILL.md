---
name: dv-receiving-gitlab-code-review
description: Use when you need to process unresolved GitLab MR code review discussions. Fetches unresolved discussions, one-by-one brainstorms with human what to do with it, and runs the decision action.
model: opus
allowed-tools: Agent, AskUserQuestion, Read, Grep, Glob, Edit, Write, Bash, Skill
---

## Discipline

- **Be brief**;
- Dispatch the `code-review:gitlab-mr-unresolved-threads-supplier` agent with the input `auto` to get unresolved discussions;
- If multiple MRs detected - print a numbered list of MRs, ask user to pick one, then re-dispatch the agent with the chosen iid;
- We concentrate on **discussions that demand action**. We are not interested in processing summaries, verdicts, or other general notes. Filter out those;
- If no discussions worth processing present - let human know and stop;
- **Gathering all the necessary context** for each discussion is mandatory;
- You strictly process with human **one discussion at a time** ordered by severity;
- Include **code path links** where present when discussing an issue with human (e.g. `file/path.py:42`)
- Use `AskUserQuestion` tool for brainstorming with human;
- When discussing appropriate reaction to a discussion, always include your recommendation;
- At the end of all discussions processing, provide a small summary on actions that you and human agreed to take and ask for its explicit approval;
- Execute actions having **human explicit approval**.
- Having executed all the necessary actions, if your work included code changes, use `sdlc-implementation:finishing-a-development-branch` skill - it will make sure local quality gates pass, commit changes, push, and make sure CI is green.

## Discussion severity scale

- **`critical` — must fix: will definitely lead to significant issues if left as is**:
    - e.g. bugs, security issues, data loss risks, broken functionality
- **`important` — better fix: may not lead to significant issues if left as is right now, but is a serious technical debt for the future**:
    - e.g. architecture problems, long-term maintainability concerns
- **`minor` — nice to have: definitely will not lead to significant issues, is not a serious technical debt, just makes a code objectively better**
    - e.g. minor optimization opportunities, documentation polish
- **`nitpick` — style, naming, formatting; optional**
- **`question` — reviewer asking for clarification; no action necessarily required**
- **`junk` - doesn't make sense, not worth reacting to**

## Discussion handling actions

- `fix` — apply a concrete code change
- `respond` — post a reply to the discussion instead of changing code (for `question` severity, for disagreements, or when the reviewer's input is needed)
- `skip` — intentionally do nothing (typical for `nitpick` the user may wish to ignore)
- `defer` — acknowledge out-of-scope; will not be addressed in this MR
- some other action that seems appropriate

## Action execution

- `fix` — keep each edit minimal and on-scope for the discussion; do not bundle unrelated cleanup.
- `respond` — keep replies short and specific; quote the part of the comment you are answering if the discussion is long.
- `skip` and `defer` — no action, but track them and report in the final summary.

## Gotchas

- To post the reply to a discussion use: ```glab api projects/:fullpath/merge_requests/<iid>/discussions/<discussion_id>/notes -f body="<your reply>"```

## Task

Triage unresolved GitLab MR discussions one at a time with human-in-the-loop, brainstorm with human how to handle each, then handle them according to the mutual decision.
