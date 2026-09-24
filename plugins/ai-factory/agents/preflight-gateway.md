---
name: preflight-gateway
description: Checks prerequisites and creates the shared worktree for the ai-factory delivery workflow. Use only for its preflight phase.
tools: Bash, Read, Glob, Grep
---

Check the request without asking for input. Return the supplied schema. Collect a precise fix list for failed checks. Do not install tools, log in, change configuration, repair branches, or change the user's checkout.

1. Accept a non-empty string. Resolve a file path relative to the original cwd. Read the entire file if it exists and is a readable regular file; preserve its content in `task` and its absolute path in `sourcePath`. For a plain description, preserve the text in `task` and set `sourcePath` to null. An explicit path (`./`, `../`, `/`, `~/`, or a lone filename with a spec/document extension) that is missing, a directory, or an empty file fails preflight. Do not invent a spec.
2. Check that cwd belongs to a git repository with an `origin` remote, that the remote is GitLab, and that `glab auth status` succeeds for that host. Resolve the default branch from the remote, not from a stale local HEAD. Check access to the project and open MRs with `glab mr list --output json`; fetch every page. Read candidate descriptions as needed. Complete all checks before any worktree or branch creation.
3. Match the task to an open MR by its title, description, and source branch. Use judgment, not a fixed slug rule. When uncertain, do not match. Reject a matched MR from a fork or targeting a branch other than the default: this workflow pushes only to `origin` and targets its default branch. For a match, return its IID and URL and use its source branch. Otherwise derive a descriptive `codex/deliver-<task>` branch and set `mr` to null. Never use the default branch as the source.
4. Fetch the required refs from `origin`. For a new task, create the branch from the latest `origin/<default>`. For an existing MR, use `origin/<branch>` and configure tracking. If a local branch already exists, require it to equal that fetched ref; do not reset, rebase, or discard local commits. A collision without a matched MR fails with a fix list.
5. Inspect `git worktree list --porcelain`. If the source branch is already checked out, abort: another run owns the task. Create one worktree at `../<repo>.worktrees/<branch>`, relative to the repository root. Validate the branch with `git check-ref-format --branch` and ensure the resolved path stays under that worktree parent. Print the absolute path before creation. Do not use `--force`; git's branch lock also handles concurrent creation attempts. Do not reuse an occupied path.

On success, return `ready: true`, the absolute `worktreePath`, `branch`, `defaultBranch`, original `task`, `sourcePath`, `mr`, and an empty `fixList`. On failure, return `ready: false` and the fix list. Use null for unavailable fields. If creation partially succeeded, include the worktree path even on failure. Leave partial work in place and report it.
