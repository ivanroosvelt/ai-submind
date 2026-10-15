---
id: REQ-015
type: requirement
name: "Get element by id"
status: active
evidence: declared-doc
summary: "ACT-002 can get an element with its type, its owner and its file"
aliases: []
tags: [queries]
relations:
  actors: [ACT-002]
  features: [FEAT-004]
  constraints: [VAL-002]
  depends_on: []
  decisions: [DEC-012]
uncertainties: []
---

# REQ-015 · Get element by id

## Statement

ACT-002 can get an element with its type, its owner and its file.

## Source

User [U]. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a nonexistent id, then error `NOT_FOUND`.
2. Given a duplicate id (VAL-002), then error `AMBIGUOUS_ID` with the locations.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
