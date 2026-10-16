---
id: NFR-005
type: quality-attribute
name: "Write concurrency"
status: active
evidence: declared-doc
summary: "A single writer per project and optimistic control by revision; other parties' changes are never lost."
aliases: ["lock", "revision", "concurrency"]
tags: [data, integrity]
relations:
  tests: []
  decisions: []
uncertainties: []
---

# NFR-005 · Write concurrency

## Requirement
One daemon per project (lockfile, DEC-005) is the only writer; writes serialized in-process; optimistic control by revision hash per document (DEC-004); concurrent external changes produce `REVISION_CONFLICT`, never a silent overwrite.

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Concurrent startups | a single daemon | `test/daemon/server.test.ts`, `test/daemon/cli.test.ts` |
| Write with stale revision | REVISION_CONFLICT | `test/engine/engine.test.ts`, `test/daemon/ui-api.test.ts` |

## Scope
Engine (FEAT-002), MCP and UI.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
