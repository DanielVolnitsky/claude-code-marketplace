---
name: dv-creating-spec
description: "Use when user asks to create a spec | specification file based on some provided context or current session context. Converts provided context to a specification file."
model: sonnet
context: fork
---

## Key Principles

- **Goal-oriented**. A spec should focus on what and why, and high-level how;
- **No low-level code/details**. Aim for covering just enough nuance (may include structure, style, testing, boundaries), leaving low-level implementation decisions to an implementor;
- **Be concise**. Respect human-in-the-loop time necessary to review the produced spec. Be brief, talk like caveman. Avoid duplication;  
- **~150 line spec**. Aim for this file length. If you need more - justify it at the end of your turn for human.

# Spec Content Requirements

- Goal
- Objectives
- Requirements
- Constraints
- High-level implementation plan

## Output Specification

- Save resulting spec to `specs/YYYY-MM-DD-<topic>-design.md`

# Task

Create a spec file based on provided context according to Key Principles, Spec Content Requirements, Output Specification.

# Post-processing

- Dispatch the `sdlc-implementation:spec-reviewer` agent with the spec file path to review the spec:
    - If there are comments that need human judgment, use `AskUserQuestion` tool to fill the gaps
    - Else - modify the spec according to review comments
- Use `AskUserQuestion` tool to propose human nxt steps options:
    - implement the spec using `sdlc-implementation:executing-spec` skill
    - critically evaluate the spec using `sdlc-implementation:critical-thinking` skill
