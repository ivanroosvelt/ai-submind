---
id: API-003
type: interface
name: "ai-submind CLI"
status: active
evidence: declared-doc
summary: "ai-submind command (npx) with subcommands serve, mcp, init, status, stop and validation."
aliases: ["cli", "npx", "command"]
tags: [contracts]
implementation: none
code: []
test_code: []
relations:
  providers: []
  consumers: [ACT-001, ACT-002]
  entities: [ENT-001]
  validations: []
  tests: []
  decisions: []
uncertainties:
  - "Name of the validation subcommand (e.g. `validate`)."
  - "P11: default port and automatic browser opening."
---

# API-003 · ai-submind CLI

## Contract
`ai-submind` binary of the npm package (DEC-001). Root = git root of the cwd (or cwd); `--knowledge <dir>` confined to the root.

## Operations

| Operation | Input | Output | Errors |
|-----------|-------|--------|--------|
| `ai-submind` / `serve` | options | daemon running, UI URL on stderr | Node < 22, lock |
| `mcp` | - | stdio proxy to the daemon (starts it if missing) |  |
| `init` | - | minimal structure of knowledge/ and .gitignore | does not overwrite |
| `status`, `stop` | - | daemon status/stop |  |
| validate | - | report; exit code ≠ 0 if there are errors |  |

## Authentication and permissions
Local user; no authentication of its own.

## Versioning and compatibility
Subcommands and options stable from the first release.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Operation names are indicative; they are fixed in the corresponding plan stage.
