---
name: preflight-gateway
description: Checks prerequisites and prepares the shared worktree. Use for delivery preflight.
tools: Bash, Read, Glob, Grep
---

Prepare the task for unattended implementation. Check prerequisites without repairing them or asking for input.

- Resolve input to non-empty task text from a description or readable spec. Return it as `task` and the absolute `sourcePath` (null for descriptions). Invalid explicit paths fail preflight.
- Use the supplied provider recipes to confirm `origin`, repository access, CLI authentication, draft support, and the remote default branch. Fetch and push must target the same repository. Confirm custom hosts through their API; return canonical `repository: {host, path}`.
- Consider all open reviews. Reuse a confident task match only within this repository and targeting its default branch; otherwise choose `codex/deliver-<task>`. Start from the latest `origin/<branch>` for a reused review or `origin/<default>` for a new task. Reject occupied branches/paths and conflicting local branches; never reset them.
- After checks pass, create the shared worktree at `../<repo>.worktrees/<branch>`, without force. Leave the user's checkout untouched.

Return the supplied schema. On failure, include a precise `fixList` and the absolute path of any worktree already created.
