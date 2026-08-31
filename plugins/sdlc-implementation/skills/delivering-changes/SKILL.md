---
name: dv-delivering-changes
description: Validates changes and delivers them to a remote VCS MR making sure CI pipeline is green. Use when some task implementation or fix is complete, and you need to deliver the changes to a remote VCS MR.
argument-hint: "[request specifics]"
---

## Local Quality control gates

Local Quality control gates are mandatory before delivering changes to a remote VCS. Detect available options. Make sure they pass before proceeding.

Candidates:

- tests
- linter (if present)
- SonarQube (if present)

## Feature branch creation

- default repository branch may be different from repo to repo (e.g. develop, main, master);
- make sure feature branch is created from latest origin/<default_repository_branch> state so no rebase is needed later on;

## How to deliver results

Inform a user about the results: provide feature branch name, local quality gates results, remote MR link, remote MR CI state and any other info you think is important to convey.

## How to solve uncertainties

Use `AskUserQuestion` tool **with multiple options choice possibility** to query a user in case you are not sure about something. Leave one free-choice option so user could specify their own view on next steps as a free-form text. Mention your recommendation on the next steps and let a user a possibility to go with it as one of the options.

**Don't add explanation** - keep options concise.

## Common Mistakes

**Skipping test verification**

- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests, linter (if present) before offering options

**Open-ended questions**

- **Problem:** "What should I do next?" is ambiguous
- **Fix:** Present exact structured options

## Gotchas

- you can use `goal` skill with argument `make sure CI pipeline is green` to make sure CI pipeline is green.

## Task

Make sure changes:

- pass existing local quality control gates;
- are covered by a dedicated feature branch rebased on latest default branch;
- are delivered as MR to a remote VCS;
- lead to the green CI pipeline on the MR.

Take into account additional user request specifics if any and adapt.
