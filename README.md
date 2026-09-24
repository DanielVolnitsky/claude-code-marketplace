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
verify a task in an isolated worktree, then deliver it to a supported remote VCS with
bounded CI repair. It detects the provider from `origin`. Unresolved work remains draft.

## Quality Gates

Every update runs `claude plugin validate .` (schema and layout baseline):

```bash
# macOS / WSL / Git Bash
claude plugin validate .
claude plugin validate plugins/ai-factory
node --test tests/*.test.mjs
```

```powershell
# Windows (PowerShell)
claude plugin validate .
claude plugin validate plugins/ai-factory
node --test tests/ai-factory-deliver.test.mjs
```
