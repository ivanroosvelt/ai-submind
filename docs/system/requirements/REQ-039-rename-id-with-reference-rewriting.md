---
id: REQ-039
type: requirement
name: "Rename id with reference rewriting"
status: active
evidence: declared-doc
summary: "ACT-002 can rename the id of an element and the engine atomically rewrites all its references"
aliases: ["rename"]
tags: [mcp, integrity]
relations:
  actors: [ACT-002]
  features: [FEAT-006, FEAT-002]
  constraints: [VAL-002, VAL-003]
  depends_on: [REQ-026]
  decisions: []
uncertainties: []
---

# REQ-039 · Rename id with reference rewriting

## Statement

ACT-002 can rename the id of an element and the engine atomically rewrites all its references.

## Source

User (2026-10-14); DEC-003. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a rename, then references in models, diagrams and layout are updated in a single transaction.
2. Given a target id that already exists, then it is rejected without writing.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
