---
id: REQ-005
type: requirement
name: "Persist with canonical serialization"
status: active
evidence: declared-doc
summary: "ai-submind must write `knowledge/` with canonical serialization"
aliases: ["canonical", "deterministic"]
tags: [data]
relations:
  actors: []
  features: [FEAT-002, FEAT-003]
  constraints: [NFR-003]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-005 · Persist with canonical serialization

## Statement

ai-submind must write `knowledge/` with canonical serialization so that Git shows minimal diffs.

## Source

User [U]; DEC-002. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a document without logical changes, when it is saved, then it stays byte-for-byte identical.
2. Given a change in an element, when it is saved, then the diff affects only that element and the necessary references.
3. UTF-8, 2 spaces, LF, final newline, key order by schema, sets sorted by `id`, integer coordinates.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
