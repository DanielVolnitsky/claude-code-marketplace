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

## Quality Gates

Every update runs `claude plugin validate .` (schema and layout baseline):

```bash
# macOS / WSL / Git Bash
claude plugin validate .
for f in scripts/*_validation.py; do python3 "$f"; done
```

```powershell
# Windows (PowerShell)
claude plugin validate .
Get-ChildItem scripts\*_validation.py | ForEach-Object { python $_ }
```
