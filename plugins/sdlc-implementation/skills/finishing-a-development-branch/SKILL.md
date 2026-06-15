---
name: dv-finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work. Guides completion of development work by presenting structured options for merge, PR, or cleanup
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Detect environment → Present options → Execute choice

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

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

**Normal repo and named-branch worktree — present exactly these 5 options:**

```
Implementation complete. 

Current branch state:
- <mention whether we are on a default or custom feature branch>
- <mention whether some commits from the origin/<default_repository_branch> need a rebase>

What would you like to do?

1. Rebase (if needed) & Squash & Push & create a Pull Request & /goal make sure CI pipeline is green
2. Create a new branch (specify the name), then pipeline from Option 1
3. <let user write their request>

Which option?
```

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
