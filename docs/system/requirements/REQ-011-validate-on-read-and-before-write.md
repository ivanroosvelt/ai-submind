---
id: REQ-011
type: requirement
name: "Validate on read and before write"
status: active
evidence: declared-doc
summary: "ai-submind must validate every document when loading it and before each write"
aliases: ["validation"]
tags: [validation]
relations:
  actors: []
  features: [FEAT-003, FEAT-002]
  constraints: [VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, VAL-006, VAL-007]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-011 · Validate on read and before write

## Statement

ai-submind must validate every document when loading it and before each write.

## Source

User [U]; DEC-002, DEC-004. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given an operation that would produce an invalid document, when it runs, then it is rejected entirely and `knowledge/` does not change.
2. Given an invalid file on disk, when it is loaded, then it is reported and does not accept writes (REQ-022).

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
