---
id: API-003
type: interface
name: "ai-submind CLI"
status: active
evidence: declared-doc
summary: "ai-submind command (npx) with subcommands serve, mcp, init, status, stop and validation."
aliases: ["cli", "npx", "command"]
tags: [contracts]
implementation: partial
code: [src/cli/, src/daemon/]
test_code: [test/daemon/, test/mcp/proxy.test.ts]
relations:
  providers: []
  consumers: [ACT-001, ACT-002]
  entities: [ENT-001]
  validations: []
  tests: []
  decisions: []
uncertainties: []
---

# API-003 · ai-submind CLI

## Contract
`ai-submind` binary of the npm package (DEC-001). Root = git root of the cwd (or cwd); `--knowledge <dir>` confined to the root.

## Operations

| Operation | Input | Output | Errors |
|-----------|-------|--------|--------|
| `ai-submind` / `serve` | `--knowledge`, `--port` (default 7777, fallback to a free port), `--idle` minutes (default 30, 0 = never) | daemon running in the foreground, UI URL with one-time token on stderr; reuses a live daemon | Node < 22, `--knowledge` outside the root, explicit port busy |
| `mcp` | `--knowledge` | stdio MCP server (API-001) proxied to the daemon's `/mcp`; starts the daemon if missing and retries once through `ensureDaemon` on connection refused or 401; stdout carries only the protocol, logs go to stderr (DEC-016) | daemon that does not start within 10 s |
| `init` | `--knowledge` | `ai-submind.json` and self-ignored `.ai-submind/` (DEC-014) | does not overwrite |
| `status`, `stop` | - | daemon status/stop |  |
| `validate` | `--knowledge` | one finding per line on stdout; exit 1 if there are errors (REQ-012); default `knowledge/` missing → notice, exit 0 | explicit `--knowledge` missing → exit 2 |

## Authentication and permissions
Local user; no authentication of its own.

## Versioning and compatibility
Subcommands and options stable from the first release.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Operation names are indicative; they are fixed in the corresponding plan stage.
