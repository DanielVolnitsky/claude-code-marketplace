## Skill Naming Convention

All skills in this repository must be prefixed with `dv-` (e.g. `dv-receiving-gitlab-code-review`). This applies to the directory name, the `name` field in `SKILL.md` frontmatter, and the heading inside the skill body.

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