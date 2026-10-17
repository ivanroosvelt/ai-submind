---
id: API-002
type: interface
name: "UI HTTP API"
status: active
evidence: verified-code
summary: "Local HTTP API serving the UI: reading models and diagrams, writing layout only, live events."
aliases: ["http", "ui api", "sse"]
tags: [contracts]
implementation: verified
code:
  - src/daemon/ui-api.ts#uiRoutes
  - src/daemon/server.ts#startDaemon
  - src/query/query.ts#Query
test_code:
  - test/daemon/ui-api.test.ts
relations:
  providers: []
  consumers: [ACT-001]
  entities: [ENT-002, ENT-004, ENT-005]
  validations: [VAL-005]
  tests: []
  decisions: [DEC-006, DEC-014, DEC-017, DEC-018]
uncertainties: []
---

# API-002 · UI HTTP API

## Contract
HTTP endpoints of the daemon on 127.0.0.1 consumed by the JointJS UI; SSE event channel for live refresh (DEC-017) (REQ-030). Rejects every write that is not layout (REQ-032).

## Operations

| Operation | Input | Output | Errors |
|-----------|-------|--------|--------|
| `GET /` | - | `dist/ui/index.html` with a CSP (`default-src 'self'`) | 503 `UI_NOT_BUILT` |
| `GET /assets/<name>` | build file name (no separators, no leading dot) | file with its content type, `nosniff` | 404 |
| `GET /api/diagrams` | - | `{models, diagrams}` (query `listModels`/`listDiagrams`, every page) | |
| `GET /api/diagram?id=` | diagram ID | `{diagram, model, file, elements, names, layout, formatVersion, targets, revision}` | 400 INVALID_ARGUMENT, 404 NOT_FOUND, 400 AMBIGUOUS_ID |
| `GET /api/relations?id=` | element ID | `{items}`: relations that reach the element (query `relations`, `direction: "in"`, every page), each with the source's `name` when it has one (REQ-031) | 400 INVALID_ARGUMENT, 404 NOT_FOUND, 400 AMBIGUOUS_ID |
| `GET /api/findings` | - | `{state, errors, warnings, findings}` | |
| `PUT /api/layout?diagram=` | body `{layout, revision}` (≤ 2 MiB) | `{revision, generation}`; `layout/<id>.json` written canonically | see Errors |
| `GET /api/events` | - | `text/event-stream`; `event: change` with `{source, generation, added, removed, changed, documents}` per engine `change` | |

`revision` is `<model file revision>:<layout revision or empty>`: a save is rejected if the file of the diagram's
model or its layout changed since the UI read it (REQ-029 CA2), checked inside the engine transaction. Changes to
shown elements that live in other models do not cause a 409; the SSE refresh redraws them. `elements` are the shown
elements that exist (`{id, type, node}`); `names` maps every shown or referenced ID (drill-down targets included)
to its name. `targets` (REQ-042) maps the diagram and every shown element or part of one (operations, lifelines,
messages, fragments…) that has a drill-down target to its targets, `[{id, kind: "element" | "diagram" | "model",
diagram?}]`, resolved by the server across models: operation `behavior`, message `signature` → operation
`behavior`, interaction use `interaction`, a classifier's operation behaviors, then `links` (a classifier's own, then its attributes' and operations'; the
members keep their own entries); `diagram` is a model target's first diagram by ID, the tree's order (absent if it has none). Targets that are the diagram or one of its shown
elements are left out; IDs without targets are absent. Errors: see below. Any other method on any path is 405 (`Connection: close`; REQ-032); `POST
/api/stop` and `/mcp` are the daemon's own routes (API-001, API-003). An open event stream counts as activity for
idle shutdown (DEC-014) and is closed by `stop`.

## Errors
JSON `{error: {code, message, details?}}`. Engine and query errors map to 404 `NOT_FOUND`, 409
`REVISION_CONFLICT` and 400 for every other code (`INVALID_ARGUMENT`, `AMBIGUOUS_ID`, `VALIDATION_FAILED` with
`details.findings` (schema, VAL-005), `DOCUMENT_INVALID` (layout not writable), `INVALID_PATH`,
`PATH_OUTSIDE_KNOWLEDGE`, `INVALID_BATCH`, `INVALID_ID`). `PUT /api/layout` also answers 400 `INVALID_ARGUMENT` to a
diagram parameter that is not a diagram ID, a body that is not JSON or not exactly `{layout, revision}`, or a
`layout.diagram` other than the parameter, and 413 `PAYLOAD_TOO_LARGE` over 2 MiB (by `Content-Length` or while
reading), closing the connection without reading the rest. `GET /` answers 503 `UI_NOT_BUILT` without `dist/ui`.
Plain-text 401 (token), 403 (Host/Origin), 404 (unknown GET path) and 405 (any other method) come from the daemon.

## Authentication and permissions
Loopback, token and Host/Origin validation (NFR-004).

## Versioning and compatibility
Internal: UI and API are distributed together in the package; no external compatibility guarantee.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007; operations fixed in PLAN-002 S9 (DEC-017).
