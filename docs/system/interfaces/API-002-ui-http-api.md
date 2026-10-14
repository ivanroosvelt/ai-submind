---
id: API-002
type: interface
name: "UI HTTP API"
status: active
evidence: declared-doc
summary: "Local HTTP API serving the UI: reading models and diagrams, writing layout only, live events."
aliases: ["http", "ui api", "sse"]
tags: [contracts]
implementation: none
code: []
test_code: []
relations:
  providers: []
  consumers: [ACT-001]
  entities: [ENT-002, ENT-004, ENT-005]
  validations: [VAL-005]
  tests: []
  decisions: []
uncertainties:
  - "SSE vs WebSocket for live refresh (S9)."
---

# API-002 · UI HTTP API

## Contract
HTTP endpoints of the daemon on 127.0.0.1 consumed by the JointJS UI; event channel (SSE or WebSocket) for live refresh (REQ-030). Rejects every write that is not layout (REQ-032).

## Operations

| Operation | Input | Output | Errors |
|-----------|-------|--------|--------|
| read models/diagrams/element | ids | JSON | NOT_FOUND |
| validation status | - | findings |  |
| save layout | diagram id, layout, revision | new revision | REVISION_CONFLICT, VAL-005 |
| events | - | stream of changes |  |

## Authentication and permissions
Loopback, token and Host/Origin validation (NFR-004).

## Versioning and compatibility
Internal: UI and API are distributed together in the package; no external compatibility guarantee.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Operation names are indicative; they are fixed in the corresponding plan stage.
