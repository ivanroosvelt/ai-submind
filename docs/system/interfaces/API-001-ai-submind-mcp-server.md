---
id: API-001
type: interface
name: "ai-submind MCP server"
status: active
evidence: declared-doc
summary: "Typed MCP tools for querying and administering knowledge, over stdio (proxy) or Streamable HTTP."
aliases: ["mcp", "mcp tools", "streamable http"]
tags: [contracts]
implementation: none
code: []
test_code: []
relations:
  providers: []
  consumers: [ACT-002]
  entities: [ENT-002, ENT-003, ENT-004]
  validations: [VAL-001, VAL-002, VAL-003, VAL-006, VAL-007]
  tests: []
  decisions: []
uncertainties:
  - "P9: layout tools (auto-layout) for agents."
  - "Versioning of the MCP contract."
---

# API-001 · ai-submind MCP server

## Contract
MCP server `ai-submind` (SDK `@modelcontextprotocol/server` v2) served by the daemon over Streamable HTTP; `ai-submind mcp` acts as the stdio proxy (DEC-005). Resources: models, diagrams, schema.

## Operations

| Operation | Input | Output | Errors |
|-----------|-------|--------|--------|
| list models/diagrams | filters | ids, names, type, validity |  |
| get element | id | element, type, owner, file | NOT_FOUND, AMBIGUOUS_ID |
| search / lexical search | filters or text, pagination | ordered elements |  |
| relationships, impact | id, types, depth | graph | NOT_FOUND |
| create model, create/update/delete element, manage diagrams | operation, expected_revision | result and diff | REVISION_CONFLICT, REFERENCED, DOCUMENT_INVALID, VAL errors |
| atomic batch | list of operations | all or nothing | same |
| rename | id, new id | rewritten references | collision, NOT_FOUND |
| validate | - | findings report |  |

## Authentication and permissions
Session token and loopback (NFR-004); confined paths (NFR-006). Model writes only through this channel (DEC-006).

## Versioning and compatibility
Typed input/output schemas; contract versioning to be defined.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Operation names are indicative; they are fixed in the corresponding plan stage.
