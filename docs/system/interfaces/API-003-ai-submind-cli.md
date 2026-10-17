---
id: API-003
type: interface
name: "ai-submind CLI"
status: active
evidence: verified-code
summary: "ai-submind command (npx) with subcommands serve, mcp, init, status, stop, validation and migrate."
aliases: ["cli", "npx", "command"]
tags: [contracts]
implementation: verified
code: [src/cli/, src/daemon/]
test_code: [test/daemon/, test/mcp/proxy.test.ts, test/e2e/npx.test.ts]
relations:
  providers: []
  consumers: [ACT-001, ACT-002]
  entities: [ENT-001]
  validations: []
  tests: []
  decisions: [DEC-020]
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
| `init` | `--knowledge` | `ai-submind.json` and self-ignored `.ai-submind/` (DEC-014) | does not overwrite; live daemon → exit 1 (stop it; its first MCP write creates `knowledge/`) |
| `status`, `stop` | - | daemon status/stop |  |
| `migrate` | `--knowledge`, `--dry-run` | 1.0 documents upgraded to 1.1 (REQ-043): one path per line on stdout, summary on stderr; runs its own engine like `init` | `MIGRATE_BLOCKED` → exit 1; live daemon → exit 1 (use the MCP `migrate` tool or stop it) |
| `validate` | `--knowledge` | one finding per line on stdout; exit 1 if there are errors (REQ-012); default `knowledge/` missing → notice, exit 0 | explicit `--knowledge` missing → exit 2 |

## Authentication and permissions
Local user; no authentication of its own.

## Distribution
npm package `ai-submind` with `dist/` (including `dist/ui/` and its `THIRD-PARTY-LICENSES.md`), `spec/format/README.md`, `spec/format/schema/` (1.0 and 1.1) and `spec/format/migrations/` (DEC-010); `npm run build` empties `dist/` first so no stale file is packed. `test/e2e/npx.test.ts` drives the packed tarball through `npx ai-submind`. Published on npm (`ai-submind@0.1.0`, Apache-2.0, DEC-019) with `LICENSE`, `NOTICE` and `CHANGELOG.md`; releases by tag through `.github/workflows/release.yml` (PLAN-004).

## Versioning and compatibility
Subcommands and options stable from the first release.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Operation names are indicative; they are fixed in the corresponding plan stage.
