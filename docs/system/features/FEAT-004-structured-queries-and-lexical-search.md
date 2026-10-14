---
id: FEAT-004
type: feature
name: "Structured queries and lexical search"
status: active
evidence: declared-doc
summary: "Deterministic queries over the graph (list, get, search, relationships, impact) and lexical search."
aliases: ["queries", "query", "search"]
tags: [queries]
implementation: none
code: []
test_code: []
relations:
  entities: []
  functions: []
  interfaces: [API-001]
  integrations: []
  depends_on: [FEAT-002]
  decisions: []
uncertainties:
  - "Lexical engine: own BM25 or minisearch (DEC-007)."
---

# FEAT-004 · Structured queries and lexical search

## Description
Read-only queries over the engine (DEC-004) and free-text lexical search (DEC-007), exposed via MCP. PLAN-002 S6.

## Behavior
REQ-014..018, REQ-038 (REQ-019 proposed).

## States and transitions
No states of its own; results in stable order, no effects on disk.

## Dependencies
FEAT-002.

## Risks
Cycles in impact (termination guaranteed).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
