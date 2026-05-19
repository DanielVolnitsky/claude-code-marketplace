---
name: dv-changes-briefing
description: Produces a plain-language branch briefing for a Java Senior engineer unfamiliar with the tech stack (infra, Python, AI, cloud). Explains what existed before the branch, what changed, why, and which files to read in what order. Use when asked to explain a within-branch changes.
---

# Changes Briefing

Produces a structured briefing of the current branch's changes, written for a senior engineer who is expert in a Java stack but a dummy with the infra-as-code,
Python, AI/ML services, cloud-native.

## Workflow

### Step 0: Discover Branch Context

1. Run `git fetch origin` to ensure comparison is against the latest remote state.
2. Run `git log origin/develop..HEAD --oneline` to get the exact commits on this branch.
3. Run `git diff origin/develop...HEAD --stat` to get the list of changed files.
4. Report: branch name, number of commits, number of files touched.

---

### Step 1: Deep-Read the Diff

Read the full diff: `git diff origin/develop...HEAD`

Focus on:

- **New files**: what they are, what problem they solve
- **Modified files**: what specifically changed (not just "updated") — before vs. after the key lines
- **Deleted/removed lines**: what was removed and why
- **Config/lock/CI files**: treat as housekeeping unless something notable changed

---

### Step 2: Produce the Briefing

Deliver a single, structured briefing with the following sections:

---

#### 1. What This Branch Is About (2–4 sentences)

One plain-language paragraph: the core purpose of these changes. No jargon.

---

#### 2. The Problem Being Solved

Explain the specific problem or gap that motivated these changes. Include:

- What was missing or broken before
- Why this approach was chosen

---

#### 3. Before vs. After

| Aspect           | Before this branch | After this branch |
|------------------|--------------------|-------------------|
| [key capability] | [state]            | [state]           |
| ...              | ...                | ...               |

Keep to the most meaningful differences. Skip unchanged areas.

---

#### 4. Architecture / Flow (if relevant)

If the changes affect runtime behavior, add a simple ASCII diagram showing the flow or component relationships. Use analogies to concepts the target audience
knows.

---

#### 5. Top Files to Read, In Order

For each file worth reading:

- **Filename** — one-line description of its role
- What does it contain
- What to look for when reading it
- Why it matters in the context of the change

Order: most important / most explanatory first. Group pure housekeeping files at the end as a single bullet.

---

#### 6. Analogy Table (tech-stack translation)

| This stack's concept | Equivalent in target audience's stack |
|----------------------|---------------------------------------|

Translate every non-obvious term. Tailor to the audience confirmed in Step 0.

---

#### 7. Key Caveats / Things to Watch For

Any workarounds, temporary patches, known limitations, or "this will change when X matures" notes that a reviewer should be aware of.

---

## Guidelines

- **Never summarize what the code does at the line level.** Explain intent and impact.
- **Always explain the "why this approach" when a workaround exists.**
- **Calibrate all analogies to the confirmed audience background** — a Java senior gets Spring/JEE analogies; a Rails dev gets ActiveRecord/Rack analogies, etc.
- If `origin/develop` doesn't exist, fall back to `origin/main` or ask the user for the correct base branch.
- If the branch has 0 commits ahead of origin, report that and stop.