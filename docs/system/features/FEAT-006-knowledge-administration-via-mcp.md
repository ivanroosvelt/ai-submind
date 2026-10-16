---
id: FEAT-006
type: feature
name: "Knowledge administration via MCP"
status: active
evidence: verified-code
summary: "MCP tools to create, modify, delete and rename models, elements and diagrams, in atomic batches."
aliases: ["administration", "crud", "mcp"]
tags: [mcp]
implementation: verified
code:
  - src/engine/edit.ts#edit
  - src/mcp/tools.ts#createMcpServer
test_code:
  - test/engine/edit.test.ts
  - test/mcp/tools.test.ts
  - test/mcp/http.test.ts
relations:
  entities: [ENT-002, ENT-003, ENT-004]
  functions: []
  interfaces: [API-001]
  integrations: []
  depends_on: [FEAT-001, FEAT-002]
  decisions: [DEC-015, DEC-016]
uncertainties:
  - "IDs of message occurrences are not derived from their message (`<message>.send`): an occurrence created without `id` gets `<interaction>.occ`; agents pass explicit IDs for them."
---

# FEAT-006 · Knowledge administration via MCP

## Description
Administration tools of the MCP server (API-001) over the engine; the only ways to change the model (DEC-006). PLAN-002 S8.
Element-level edits live in the engine (`src/engine/edit.ts`): create with derived IDs (also for inline children),
merge-patch update, delete with optional cascade (DEC-016), diagram membership, atomic batches of them, implicit
init and dry run (DEC-015). Every edit is planned on working copies and committed as one engine transaction whose
batch is built inside the transaction, after pending external changes are loaded. Input keys `__proto__`,
`constructor` and `prototype` are rejected (INVALID_ARGUMENT) before anything is copied.

## Behavior
REQ-021, REQ-023..027, REQ-039.

## States and transitions
No states of its own.

## Dependencies
FEAT-002, FEAT-004 (same MCP server), FEAT-001 (daemon).

## Risks
Cascading deletions; collisions of generated ids.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
