---
name: dv-executing-spec
description: Use when a specification file has been created and there is a request for its implementation. Implements the spec with review checkpoints.
---

# Executing Specs

## Overview

Load spec, review critically, derive tasks, execute all tasks, report when complete.

**Note:** Tell your human partner that agentic implementation works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support. If subagents are available, use sdlc-implementation:subagent-driven-development instead of this skill.

## Verification Options
- tests
- linter (if present)
- SonarQube (if present)

## The Process

### Step 1: Load and Review Spec

1. Find the relevant spec in `specs/` (format: `YYYY-MM-DD-<topic>-design.md`)
2. Read it fully
3. Review critically — identify any gaps, contradictions, or ambiguities
4. If concerns: raise them with your human partner before starting
5. If no concerns: derive implementation tasks, create a TodoWrite list, and follow it exactly — don't re-scope mid-execution

### Step 2: Derive Tasks from Spec

The spec is a design document, not a task list. Before coding:

1. Map the spec's components/architecture into concrete implementation tasks
2. Order tasks by dependency (foundational units first)
3. Keep tasks small enough to verify independently
4. For each task note: what to build, what file(s) to touch, how to verify

### Step 3: Execute Tasks

For each task:
1. Mark as in_progress
2. Implement exactly what the spec describes — no scope creep, no gold-plating
3. Run verifications as specified
4. Mark as completed

### Step 4: Complete Implementation

After all tasks are done and verified:
  **REQUIRED SUB-SKILL:** Use sdlc-implementation:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

### Step 5: Propose Next Steps Options

Use `AskUserQuestion` tool to ask user what they want to do with the result of your work:
- Propose finalizing the work by using `sdlc-implementation:dv-finishing-a-development-branch` skill

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, failing test, unclear spec requirement)
- Spec has critical gaps preventing starting at all
- You don't understand a requirement
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Step 1 when:**
- Partner updates the spec based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** — stop and ask.

## Remember

- Review the spec critically before writing any code
- Derive tasks explicitly before starting; don't free-style
- Follow the spec exactly — don't add features it doesn't describe
- Don't skip verifications
- Reference skills or tools when the spec calls for them
- Stop when blocked, don't guess

## Integration

**Related workflow skills:**
- **sdlc-implementation:dv-brainstorming** — produces the spec this skill executes (`specs/YYYY-MM-DD-<topic>-design.md`)
- **sdlc-implementation:dv-finishing-a-development-branch** - Complete development after all tasks
