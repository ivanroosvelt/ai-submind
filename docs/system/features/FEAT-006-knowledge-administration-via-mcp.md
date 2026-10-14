---
id: FEAT-006
type: feature
name: "Knowledge administration via MCP"
status: active
evidence: declared-doc
summary: "MCP tools to create, modify, delete and rename models, elements and diagrams, in atomic batches."
aliases: ["administration", "crud", "mcp"]
tags: [mcp]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-002, ENT-003, ENT-004]
  functions: []
  interfaces: [API-001]
  integrations: []
  depends_on: [FEAT-001, FEAT-002]
  decisions: []
uncertainties: []
---

# FEAT-006 · Knowledge administration via MCP

## Description
Administration tools of the MCP server (API-001) over the engine; the only ways to change the model (DEC-006). PLAN-002 S8.

## Behavior
REQ-021, REQ-023..027, REQ-039 (REQ-027 proposed).

## States and transitions
No states of its own.

## Dependencies
FEAT-002, FEAT-004 (same MCP server), FEAT-001 (daemon).

## Risks
Cascading deletions; collisions of generated ids.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
