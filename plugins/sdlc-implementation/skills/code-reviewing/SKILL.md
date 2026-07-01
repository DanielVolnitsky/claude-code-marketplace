---
name: dv-local-code-reviewing
description: "Use after a spec or a feature is implemented, before committing changes, or creating a MR. Performs a comprehensive code review using specialized agents."
argument-hint: "[review-aspects]"
allowed-tools: [ "Bash", "Glob", "Grep", "Read", "Task" ]
context: fork
model: sonnet
---

# Comprehensive PR Review

Run a comprehensive review of local changes using multiple specialized agents, each focusing on a different aspect of code quality.

**Review Aspects (optional):** "$ARGUMENTS"

## Review Workflow:

1. **Determine Review Scope**
    - Check git status to identify changed files
    - Parse arguments to see if user requested specific review aspects
    - Default: Run all applicable reviews

2. **Available Review Aspects:**

    - **comments** - Analyze code comment accuracy and maintainability
    - **tests** - Review test coverage quality and completeness
    - **errors** - Check error handling for silent failures
    - **types** - Analyze type design and invariants (if new types added)
    - **code** - General code review for project guidelines
    - **simplify** - Simplify code for clarity and maintainability
    - **all** - Run all applicable reviews (default)

3. **Identify Changed Files**
    - Run `git diff --name-only` to see modified files
    - Identify file types and what reviews apply

4. **Determine Applicable Reviews**

   Based on changes:
    - **Always applicable**: code-reviewer (general quality)
    - **If test files changed**: test-analyzer
    - **If comments/docs added**: comment-analyzer
    - **If error handling changed**: silent-failure-hunter
    - **If types added/modified**: type-design-analyzer
    - **After passing review**: code-simplifier (polish and refine)

5. **Launch Review Agents**

   **Parallel approach**:
    - Launch all agents simultaneously
    - Results come back together

6. **Aggregate Results**

   After agents complete, summarize:
    - **Critical** — will definitely lead to significant issues (e.g. security holes, data loss, broken functionality).
    - **Important** — architecture problems, poor error handling, testing gaps; serious technical debt.
    - **Minor** — objectively better but harmless. Not everything is Critical; do not inflate.

7. **Provide Action Plan**

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

## Usage Examples:

**Full review (default):**

```
/sdlc-implementation:code-reviewing
```

**Specific aspects:**

```
/sdlc-implementation:code-reviewing tests errors
# Reviews only test coverage and error handling

/sdlc-implementation:code-reviewing comments
# Reviews only code comments

/sdlc-implementation:code-reviewing simplify
# Simplifies code after passing review
```

## Agent Descriptions:

**comment-analyzer**:

- Verifies comment accuracy vs code
- Identifies comment rot
- Checks documentation completeness

**test-analyzer**:

- Reviews behavioral test coverage
- Identifies critical gaps
- Evaluates test quality

**silent-failure-hunter**:

- Finds silent failures
- Reviews catch blocks
- Checks error logging

**type-design-analyzer**:

- Analyzes type encapsulation
- Reviews invariant expression
- Rates type design quality

**code-reviewer**:

- Checks CLAUDE.md compliance
- Detects bugs and issues
- Reviews general code quality

**code-simplifier**:

- Simplifies complex code
- Improves clarity and readability
- Applies project standards
- Preserves functionality

## Tips:

- **Run early**: Before creating MR, not after
- **Focus on changes**: Agents analyze git diff by default
- **Address critical first**: Fix high-priority issues before lower priority
- **Re-run after fixes**: Verify issues are resolved
- **Use specific reviews**: Target specific aspects when you know the concern

## Workflow Integration:

**After /sdlc-implementation:executing-spec:**

```
1. Implement the specification
2. Run: /sdlc-implementation:code-reviewing
3. Double-check whether the raised issues are valid (brainstorm with human when needed) 
4. Fix valid critical and important issues
5. Commit
```

**Before committing:**

```
1. Write code
2. Run: /sdlc-implementation:code-reviewing
3. Fix any critical issues
4. Commit
```

**Before creating MR:**

```
1. Stage all changes
2. Run: /sdlc-implementation:code-reviewing all
3. Address all critical and important issues
4. Run specific reviews again to verify
5. Create MR
```

## Notes:

- Agents run autonomously and return detailed reports
- Each agent focuses on its specialty for deep analysis
- Results are actionable with specific file:line references
- Agents use appropriate models for their complexity
- All agents available in `/agents` list
