---
name: dv-finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work. Guides completion of development work by presenting structured options for merge, PR, or cleanup
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Detect environment → Present options → Execute choice

## The Process

### Step 1: Verify Quality Control Gates

**Before presenting options, verify quality control gates are passing:**

- tests
- linter (if present)
- SonarQube (if present)

If at least one fails - stop. Don't proceed to Step 2.

**If all pass:** Continue to Step 2.

### Step 2: Detect Environment

**Determine workspace state before presenting options:**

- Option 1: it is a default repository branch (e.g. develop, main, master)
- Option 2: it is a custom feature branch

If current branch is a default repository branch, propose user to create a custom branch and prompt him for the branch name.
Create the branch upon approval.

### Step 3: Determine if Rebase is Needed

Check if there were some updates to the origin/<default_repository_branch> that are not present in current branch.

### Step 4: Present Options

Inform a user about the results:

```
Implementation has been completed. 

Current branch state:
- <mention whether we are on a default or custom feature branch>
- <mention whether some commits from the origin/<default_repository_branch> need a rebase>
```

Use `AskUserQuestion` tool **with multiple options choice possibility** to query a user on the next steps.
Leave one free-choice option so user could specify their own view on next steps as a free-form text.
Mention your recommendation on the next steps and let a user a possibility to go with it as one of the options.

Options:

- Create a new branch (let user specify or prompt them about the name)
- Rebase (propose only if needed)
- Squash (propose only if needed)
- Push
- Create a Merge Request (if this option is chosen - call `/goal` command with argument `make sure CI pipeline is green`)

**Don't add explanation** - keep options concise.

### Step 5: Execute Choice

## Common Mistakes

**Skipping test verification**

- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests, linter (if present) before offering options

**Open-ended questions**

- **Problem:** "What should I do next?" is ambiguous
- **Fix:** Present exact structured options

## Red Flags

**Never:**

- Proceed with failing tests or linter
- Force-push without explicit request

**Always:**

- Verify tests and linter (if present) before offering options
- Detect environment before presenting menu
- Present exact options
