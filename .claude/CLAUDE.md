# Contribution Rules

## Context Minimalism

- Give skills the minimal possible system prompt and the minimal possible tools, then let the model figure out the rest.
- Only tell the model what it needs to know — too much context is micromanagement and can prevent the model from finding a better path.
- Treat the model like an engineer you're delegating to, not a pair programmer you're guiding line by line; give it a way to pull in context when needed rather than front-loading everything.
- Detailed sections are not forbidden, and should be used when appropriate: model burns tokens every time to get on the right track; you need higher consistency etc.

## Best Practices correspondence

When creating, updating, or performing a code-review for a skill - make sure it corresponds to best practices and does not violate critical issues described in @skill-rules.md 

## Skill Naming Convention

All skills in this repository must be prefixed with `dv-` (e.g. `dv-receiving-gitlab-code-review`). This applies to the `name` field in `SKILL.md` frontmatter and the heading inside the skill body.

## Plugin Version

Each plugin directory contains a `.claude-plugin/plugin.json` with a `version` field (semver). Bump it whenever you modify any file inside that plugin:

- **Patch** (`1.0.0` → `1.0.1`): wording tweaks, bug fixes, non-behavioral clarifications in a skill
- **Minor** (`1.0.0` → `1.1.0`): new behavior, new steps, new skills, or feature additions
- **Major** (`1.0.0` → `2.0.0`): breaking changes to skill interface or removal of skills

Always update `.claude-plugin/plugin.json` in the same commit as the skill change.

## Git Commit Pattern

When committing changes, use the following format:

**Format:** `<one-sentence change description>`

**Examples:**
- `add CLAUDE.md file for Claude Code project-wide instructions`
- `remove obsolete skill; add a new code-review skill`