# Claude Code Marketplace maintained by Daniel Volnitsky

## Installation

```bash
# Add the marketplace (once per machine / container)
claude plugin marketplace add https://github.com/DanielVolnitsky/claude-code-marketplace.git

# Install a plugin example
claude plugin install code-review@waytoodanny
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Delivery Workflow

The [ai-factory plugin](plugins/ai-factory/README.md) provides
`/ai-factory:deliver <spec-path | task description>` to implement and independently
verify a task in an isolated worktree, then deliver a GitHub PR or GitLab MR with
bounded CI repair. It detects the provider from `origin`. Unresolved work remains draft.

## Quality Gates

Every update runs `claude plugin validate .` (schema and layout baseline):

```bash
# macOS / WSL / Git Bash
claude plugin validate .
for plugin in plugins/*; do claude plugin validate "$plugin"; done
node --test tests/*.test.mjs
```

```powershell
# Windows (PowerShell)
claude plugin validate .
Get-ChildItem plugins -Directory | ForEach-Object { claude plugin validate $_.FullName }
node --test tests/ai-factory-deliver.test.mjs
```
