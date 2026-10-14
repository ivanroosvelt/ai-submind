---
id: REQ-020
type: requirement
name: "Semantic search"
status: proposed
evidence: declared-doc
summary: "ACT-002 can search by free text and receive elements ranked by similarity with a score. Outside PLAN-002"
aliases: ["embeddings", "semantic"]
tags: [queries, later]
relations:
  actors: [ACT-002, ACT-004]
  features: [FEAT-005]
  constraints: [NFR-002]
  depends_on: [REQ-038]
  decisions: []
uncertainties:
  - "Embeddings model and download (DEC-007)."
---

# REQ-020 · Semantic search

## Statement

ACT-002 can search by free text and receive elements ranked by similarity with a score. Outside PLAN-002.

## Source

User [A]; DEC-007. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given the index is outdated, when queried, then it indicates `stale` or reindexes incrementally beforehand.
2. Given the provider is unavailable, then error `SEMANTIC_UNAVAILABLE` and the remaining tools stay operational.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

The whole requirement is outside PLAN-002 (later plan, DEC-007).
