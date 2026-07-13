---
name: dv-creating-spec
description: "Use when user asks to create a spec | specification file based on some provided context or current session context. Converts provided context to a specification file."
model: sonnet
context: fork
---

## Key Principles

- Keep it goal-oriented: a spec should focus on what and why, and high-level how - without detailed code
- Aim for covering just enough nuance (may include structure, style, testing, boundaries)
- Break large tasks into smaller ones. Each task should be something that can be implemented and tested in isolation.
- Specify when tasks must be done incrementally, and when in parallel

# Spec Content Requirements

- Clear goal statement
- Objectives
- Requirements
- Constraints
- Step-by-step plan

## Output Specification

- Save resulting spec to `specs/YYYY-MM-DD-<topic>-design.md`

# Task

Create a spec file based on provided context according to Key Principles, Spec Content Requirements, Output Specification.

# Post-processing

- Dispatch opus subagent using the prompt template at `spec-reviewer-prompt.md` to review the spec:
    - If there are comments that need human judgment, use `AskUserQuestion` tool to fill the gaps
    - Else - modify the spec according to review comments
- Use `AskUserQuestion` tool to propose human nxt steps options:
    - implement the spec using `sdlc-implementation:executing-spec` skill
    - critically evaluate the spec using `sdlc-implementation:critical-thinking` skill
