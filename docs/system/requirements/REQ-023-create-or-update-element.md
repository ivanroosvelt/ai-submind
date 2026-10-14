---
id: REQ-023
type: requirement
name: "Create or update element"
status: active
evidence: declared-doc
summary: "ACT-002 can create or modify any element of the format"
aliases: []
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: [VAL-001, VAL-002, VAL-003, NFR-005]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-023 · Create or update element

## Statement

ACT-002 can create or modify any element of the format.

## Source

User [U]; DEC-003. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given an element without id, when it is created, then the engine assigns a readable id derived from the scoped name, globally unique, with a deterministic suffix on collision.
2. Given a change of `name`, then the `id` does not change.
3. Given a `null` field, then it is kept as `null` (unknown).
4. Given an update with an `expected_revision` different from the current one, then error `REVISION_CONFLICT`.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
