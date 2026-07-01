---
name: dv-code-polishing
description: "Use after a spec or a feature is implemented, before committing changes, or creating a MR. Polishes the produced code until it doesn't have critical or important issues, and corresponds to the repository's quality gates."
model: sonnet
---

# Constants

REVIEW_POLISHING_ROUNDS_CAP = 3

# Task

The goal is to polish a produced code until your code-review partner produces no critical and important issues, which are approved by your
reported-issue-judgment partner.
You are not responsible for issues detection - it is **forbidden for you to detect issues**, your role is to orchestrate your subagent partners:

- detect issues (code-review partner)
- independently judge detected issues (reported-issue-judgment partner)
- verified issues fixing (issue fixing partner)
  You have a high cap of allowed polishing rounds number, if after this number of review-polishing sessions there are still critical and important issues
  detected - you pair with the human to decide what to do with leftover issues.

# Single polishing session flow

1. Launch code-review partner, receive its feedback. If no critical and important issues detected - inform human and propose next steps.
2. Launch reported-issue-judgment subagent passing the code-review feedback to it. Receive its judgment on what issues are verified by it as legit issues.
3. Launch issue fixing partner if verified issues exist and need fixing.

# References

## Code-review partner

**Strictly Use **sdlc-implementation:dv-local-code-reviewing** skill** to produce a code review - reviews the produced code and provides a feedback on detected
issues.

## Reported-issue-judgment partner

Having received a feedback from your code-review partner, launch a general-purpose opus subagent, pass to it only info on what code scope is under question, and
code-review feedback. Specify that you expect from it a justified decision on which issues are worth fixing, and which are false-positives and why.

## Issue fixing partner

Having received a list of verified legit critical or important issues, launch a general-purpose sonnet subagent, pass to it only info on what code scope is
under question and list of issues with fix proposals produced by your code review partner, specify that you expect from it fix of all listed issues, and green
quality gates: tests, linter (if present).

# Pair with the human to decide what to do with leftover issues

If your code review partner states there are critical and important issues, but amount of REVIEW_POLISHING_ROUNDS_CAP is done - use `AskUserQuestion` tool to
brainstorm with user what to do with them. Accompany every question with your recommendation.

# After no critical and important issues are left

Use `AskUserQuestion` tool to ask user what they want to do with the result of your work:

- Propose finalizing the work by using `sdlc-implementation:dv-finishing-a-development-branch` skill
