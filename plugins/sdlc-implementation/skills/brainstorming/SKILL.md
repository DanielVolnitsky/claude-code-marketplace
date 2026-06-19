---
name: dv-brainstorming
description: "Use when there is some raw task or plan that needs refinement and brainstorming to fill the design gaps. Interviews human about every aspect of provided plan until the plan is solid."
---

# Task

Interview me relentlessly about every aspect of provided plan until we reach a shared understanding.
Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.
When an understanding is reached: there is no huge gaps, or unanswered questions that can affect design in a huge way, ask me what to do with the result of the session.
Propose to write it down to a specification file.
If specification file was created, use `AskUserQuestion` tool to propose next step/steps (multiple choice is available):

- propose critically evaluate the specification using `sdlc-implementation:dv-critical-thinking`
- propose continue by implementation the spec using the `sdlc-implementation:dv-executing-spec`.

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design, get approval before moving on
- **Be flexible** - Go back and clarify when something doesn't make sense

# Requirements

## Ask only when can not get answer from the context

Before asking, decide whether it can be answered with accessible tools and context.

Example:

```
Context: the repository contains .gitlab-ci.yml file
Question: what CI system is used in this repository?
Verdict: wrong question - answer can be deducted from the context
```

When you get the answer from the context or tools usage - state it clearly to the user.

## Output Specification

If I ask you to write out results of the session to a specification file:

- Write design doc — save to `specs/YYYY-MM-DD-<topic>-design.md`
- Dispatch a subagent using the prompt template at `spec-reviewer-prompt.md`
- Propose critically evaluate the spec using `sdlc-implementation:dv-critical-thinking`
- If there is some feedback from any review-related skill or subagent that requires action before implementing the spec - get back to the human interview stage
