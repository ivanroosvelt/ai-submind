---
id: FEAT-004
type: feature
name: "Structured queries and lexical search"
status: active
evidence: verified-code
summary: "Deterministic queries over the graph (list, get, search, relationships, impact) and lexical search."
aliases: ["queries", "query", "search"]
tags: [queries]
implementation: verified
code:
  - src/query/index.ts
  - src/query/query.ts#createQuery
  - src/query/graph.ts
  - src/query/traverse.ts#impact
  - src/query/traverse.ts#paths
  - src/query/filters.ts#compileFilter
  - src/query/meta.ts#metaOf
  - src/query/lexical.ts#LexicalIndex
  - src/query/text.ts#tokenize
test_code:
  - test/query/query.test.ts
  - test/query/lexical.test.ts
  - test/query/text.test.ts
relations:
  entities: []
  functions: []
  interfaces: [API-001]
  integrations: []
  depends_on: [FEAT-002]
  decisions: [DEC-012, DEC-013, DEC-020]
uncertainties: []
---

# FEAT-004 · Structured queries and lexical search

## Description
Read-only queries over the engine (DEC-004) and free-text lexical search (DEC-007), exposed via MCP. PLAN-002 S6.

## Behavior
REQ-014..019, REQ-038; every result carries the engine generation, the degraded state and the excluded documents (REQ-022). Graph semantics, limits and errors (`NOT_FOUND`, `AMBIGUOUS_ID`, `INVALID_ARGUMENT`): DEC-012. Lexical engine: DEC-013.
Flows of flows (REQ-041, DEC-020): `behavior` and `links` are `reference` edges (keys `behavior`, `links`);
`relations` groups `behavior` under `sequence` and `links` under its own group `links`; impact and paths
traverse them, with models and diagrams as link endpoints (paths still use them as intermediate steps only with
`throughHubs`).

## States and transitions
No states of its own; results in stable order, no effects on disk.

## Dependencies
FEAT-002.

## Risks
Cycles in impact (termination guaranteed).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
