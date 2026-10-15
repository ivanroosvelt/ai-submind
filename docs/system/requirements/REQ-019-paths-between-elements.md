---
id: REQ-019
type: requirement
name: "Paths between elements"
status: active
evidence: declared-doc
summary: "ACT-002 can get the shortest paths between two elements, with a length and count limit"
aliases: ["path"]
tags: [queries]
relations:
  actors: [ACT-002]
  features: [FEAT-004]
  constraints: []
  depends_on: [REQ-017]
  decisions: [DEC-012]
uncertainties:
  - "Resolved 2026-10-14: DEC-004 (approved) includes simple paths; they enter PLAN-002 S6. An advanced path language remains for later."
---

# REQ-019 · Paths between elements

## Statement

ACT-002 can get the shortest paths between two elements, with a length and count limit.

## Source

User [A]; DEC-004. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a cycle, then it terminates.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
