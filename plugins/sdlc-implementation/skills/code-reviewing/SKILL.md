---
name: dv-local-code-reviewing
description: "Use after a spec or a feature is implemented, before committing changes, or creating a MR. Performs a comprehensive code review using specialized agents."
argument-hint: "[review-aspects]"
allowed-tools: [ "Bash", "Glob", "Grep", "Read", "Task" ]
context: fork
model: sonnet
---

# Task

Run a comprehensive review of the changes using chosen available specialized agents, each focusing on a different aspect of code quality.

# Review Workflow:

1. **Determine Review Scope**
    - Check git status to identify changed files

2. **Identify Changed Files**
    - Run `git diff --name-only` to see modified files

3. **Determine Applicable Reviews**

   Based on changes:
    - **Always applicable**: code-reviewer (general quality)
    - **If test files changed/added**: test-analyzer
    - **If error handling changed**: silent-failure-hunter
    - **After passing review**: code-simplifier (polish and refine)

   Each agent call is a latency and money, so running all agents for every task is wrong.

4. **Launch Review Agents**

   **Parallel approach**:
    - Launch all agents simultaneously. Specify for each high cap for the findings - 5, and an expectation - output findings contain most critical issues.
    - Results come back together

5. **Aggregate Results**

   After agents complete, judge their results:
    - **Critical** — will definitely lead to significant issues (e.g. security holes, data loss, broken functionality).
    - **Important** — architecture problems, poor error handling, testing gaps; serious technical debt.
    - **Minor** — objectively better but harmless. Not everything is Critical; do not inflate.

6. **Provide Action Plan**

   Organize findings:
   ```markdown
   # PR Review Summary

   ## Critical Issues (X found)
   - [agent-name]: Issue description [file:line]

   ## Important Issues (X found)
   - [agent-name]: Issue description [file:line]

   ## Minor Issues (X found)
   - [agent-name]: Suggestion [file:line]
   ```

   High Cap for the findings - 10, make sure final finding list contains most critical issues.

# Available Agents

**test-analyzer**:

- Reviews behavioral test coverage
- Identifies critical gaps
- Evaluates test quality

**silent-failure-hunter**:

- Finds silent failures
- Reviews catch blocks
- Checks error logging

**code-reviewer**:

- Checks CLAUDE.md compliance
- Detects bugs and issues
- Reviews general code quality

**code-simplifier**:

- Simplifies complex code
- Improves clarity and readability
- Applies project standards
- Preserves functionality

# Notes

- Agents run autonomously and return detailed reports
- Each agent focuses on its specialty for deep analysis
- Results are actionable with specific file:line references
- Agents use appropriate models for their complexity
- All agents available in `/agents` list
