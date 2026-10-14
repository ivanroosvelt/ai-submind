---
id: FEAT-001
type: feature
name: "Per-project CLI and daemon"
status: active
evidence: declared-doc
summary: "npx ai-submind command that starts a single daemon per project and the stdio MCP proxy."
aliases: ["cli", "daemon", "serve"]
tags: [cli, process]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-001]
  functions: []
  interfaces: [API-003]
  integrations: []
  depends_on: [FEAT-002]
  decisions: []
uncertainties:
  - "Daemon shutdown: manual, on inactivity or when the last client closes (DEC-005)."
---

# FEAT-001 · Per-project CLI and daemon

## Description
`ai-submind` CLI (API-003) and daemon lifecycle: root resolution, lockfile, `runtime.json`, HTTP on loopback (DEC-001, DEC-005). PLAN-002 S7.

## Behavior
REQ-001..004, REQ-012 (CLI), REQ-037.

## States and transitions
Server: `starting` → `indexing` → `ready` | `degraded` → `stopping` → `stopped`; `ready ↔ degraded` depending on revalidations.

## Dependencies
FEAT-002 (engine).

## Risks
Orphan processes, busy ports, orphan lock.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
