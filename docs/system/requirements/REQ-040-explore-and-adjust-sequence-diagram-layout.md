---
id: REQ-040
type: requirement
name: "Explore and adjust sequence diagram layout"
status: active
evidence: declared-doc
summary: "ACT-001 can see rendered sequence diagrams and adjust their layout (mature stage S11 of PLAN-002)"
aliases: ["sequence"]
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-009]
  constraints: [VAL-005, VAL-007]
  depends_on: [REQ-028, REQ-029]
  decisions: []
uncertainties: []
---

# REQ-040 · Explore and adjust sequence diagram layout

## Statement

ACT-001 can see rendered sequence diagrams and adjust their layout (mature stage S11 of PLAN-002).

## Source

User (2026-10-14, sequence render in PLAN-002 S11); DEC-006. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Render of lifelines, activations, messages (synchronous, asynchronous, reply, create, destroy), combined fragments with operands and guards, and interaction use.
2. Event order = array order of the model; reordering lifelines persists canonical layout.
3. Class ↔ lifeline navigation.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
