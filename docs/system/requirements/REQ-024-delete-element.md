---
id: REQ-024
type: requirement
name: "Delete element"
status: active
evidence: declared-doc
summary: "ACT-002 can delete an element"
aliases: []
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: [VAL-003]
  depends_on: []
  decisions: [DEC-016]
uncertainties: []
---

# REQ-024 · Delete element

## Statement

ACT-002 can delete an element.

## Source

User [U]. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a referenced element, when it is deleted without `cascade`, then error `REFERENCED` with the list of references.
2. With `cascade: true`, the references are cleaned up (model, diagrams, layout), elements that cannot exist without the deleted one are deleted too (mandatory references, message events required by its kind, required non-empty lists such as a sequence diagram's element, and the occurrences of a deleted message that no other message uses; DEC-016), and the response lists what was affected.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
