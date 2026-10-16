---
id: FEAT-001
type: feature
name: "Per-project CLI and daemon"
status: active
evidence: verified-code
summary: "npx ai-submind command that starts a single daemon per project and the stdio MCP proxy."
aliases: ["cli", "daemon", "serve"]
tags: [cli, process]
implementation: verified
code: [src/cli/, src/daemon/]
test_code: [test/daemon/, test/mcp/http.test.ts, test/mcp/proxy.test.ts, test/e2e/npx.test.ts]
relations:
  entities: [ENT-001]
  functions: []
  interfaces: [API-003]
  integrations: []
  depends_on: [FEAT-002]
  decisions: [DEC-005, DEC-014, DEC-016]
uncertainties: []
---

# FEAT-001 · Per-project CLI and daemon

## Description
`ai-submind` CLI (API-003) and daemon lifecycle: root resolution, lockfile, `runtime.json`, HTTP on loopback (DEC-001, DEC-005). PLAN-002 S7.
The daemon serves the stateless MCP route `/mcp` behind its token, Host and Origin checks, and `ai-submind mcp` is
the stdio proxy that starts the daemon if needed and retries once through `ensureDaemon` when it is gone or
restarted (PLAN-002 S8; API-001, DEC-016).

## Behavior
REQ-001..004, REQ-012 (CLI), REQ-037.

## States and transitions
Daemon: running (live `runtime.json` and lock) or not running; `stop` (`POST /api/stop`) or idle shutdown closes it and releases the lock. While running, the engine state reported by `GET /api/status` is `ok` or `degraded` (some error finding, REQ-022), recomputed on every reload.

## Dependencies
FEAT-002 (engine).

## Risks
Orphan processes, busy ports, orphan lock.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
