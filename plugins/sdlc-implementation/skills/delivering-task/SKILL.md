---
name: dv-delivering-task
description: delivers requested changes by implementing them, passing available quality gates, delivering to VCS, and testing when appropriate.
argument-hint: "[request specifics]"
model: opus
---

Implement requested changes, polish the produced code, delivers result to a remote VCS.
When a project supports it, request and pass a remote code review.
When it is clear how the changes can be tested within the affected project/s without human intervention, test them.
Provide human a brief summary at the end.

## Discipline

- Use a worktree for the job. Clean up the worktree when changes are pushed to VCS and appropriate branch is available remotely.
