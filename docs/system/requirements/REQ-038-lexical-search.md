---
id: REQ-038
type: requirement
name: "Lexical search"
status: active
evidence: declared-doc
summary: "ACT-002 can search elements by free text with lexical ranking"
aliases: ["bm25", "free text", "minisearch"]
tags: [queries]
relations:
  actors: [ACT-002]
  features: [FEAT-004]
  constraints: [NFR-002]
  depends_on: []
  decisions: [DEC-013]
uncertainties: []
---

# REQ-038 · Lexical search

## Statement

ACT-002 can search elements by free text with lexical ranking.

## Source

User [A]; DEC-007. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Results ordered by relevance, deterministic on ties.
2. Works offline and without optional dependencies.
3. Derived, rebuildable index, outside git if persisted.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
