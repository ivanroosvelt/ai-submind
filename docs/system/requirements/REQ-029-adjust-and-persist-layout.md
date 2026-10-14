---
id: REQ-029
type: requirement
name: "Adjust and persist layout"
status: active
evidence: declared-doc
summary: "ACT-001 can move elements and link vertices and the layout is saved in `knowledge/layout/`"
aliases: []
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-007]
  constraints: [VAL-005, NFR-005]
  depends_on: [REQ-010, REQ-028]
  decisions: []
uncertainties:
  - "P9: whether the MCP agent can also modify layout."
---

# REQ-029 · Adjust and persist layout

## Statement

ACT-001 can move elements and link vertices and the layout is saved in `knowledge/layout/`.

## Source

User [A]; DEC-006. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a move, when it is released, then it is persisted (with debounce) and survives reloads.
2. Given that the diagram changed on disk since it was opened, when the layout is saved, then it is rejected with a warning and reloaded.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
