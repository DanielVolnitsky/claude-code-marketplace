# Contributing to the Marketplace

## Semver Guidance

Follow semantic versioning: bump MAJOR for breaking changes, MINOR for new features, PATCH for bug fixes:

| Change                               | Bump  |
|--------------------------------------|-------|
| New skill or agent                   | MINOR |
| Breaking change to existing skill    | MAJOR |
| Fix or documentation update to skill | PATCH |

## Security-Sensitive Plugin Components

Plugins can ship components that execute code in every developer's Claude Code
session:

| Component          | What it does                                              |
|--------------------|-----------------------------------------------------------|
| `hooks/hooks.json` | Shell commands run unsandboxed on every tool event        |
| `bin/`             | Executables injected into `PATH` for every Bash tool call |
| `.mcp.json`        | Long-running server process launched at session start     |

If your plugin uses hooks, `bin/`, or an MCP server:

1. Add a brief justification comment at the top of `hooks/hooks.json` explaining what each hook does and why.
2. Avoid network calls in hooks where possible. If a hook must reach an
   external service, restrict it to the org's internal domain and document the
   endpoint.
3. Do not use `allowed-tools` frontmatter to silently grant broad tool
   permissions in skills. Request only the minimum needed and document the
   reason.
