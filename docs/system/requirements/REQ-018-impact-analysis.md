---
id: REQ-018
type: requirement
name: "Impact analysis"
status: active
evidence: declared-doc
summary: "ACT-002 can get the transitive set of elements that depend on an element, with configurable depth and relationship types"
aliases: ["impact"]
tags: [queries]
relations:
  actors: [ACT-002]
  features: [FEAT-004]
  constraints: []
  depends_on: [REQ-017]
  decisions: []
uncertainties: []
---

# REQ-018 · Impact analysis

## Statement

ACT-002 can get the transitive set of elements that depend on an element, with configurable depth and relationship types.

## Source

User [U]; DEC-004. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a dependency cycle, then it terminates and each element appears once.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
