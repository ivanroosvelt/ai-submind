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
  decisions: [DEC-018]
uncertainties: []
---

# REQ-040 · Explore and adjust sequence diagram layout

## Statement

ACT-001 can see rendered sequence diagrams and adjust their layout (mature stage S11 of PLAN-002).

## Source

User (2026-10-14, sequence render in PLAN-002 S11); DEC-006. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Render of lifelines, activations (the interaction's `executions`, DEC-018), messages (synchronous, asynchronous, reply, create, destroy, lost, found), combined fragments with operands and guards (also nested), and interaction use.
2. Event order = array order of the model (fragments flattened depth first); lifelines move only horizontally and their length can be changed; reordering lifelines persists canonical layout.
3. Class ↔ lifeline navigation; an interaction use opens the diagram of the used interaction.
4. Auto-layout of a sequence diagram from the UI and from the MCP tool `auto_layout_diagram` gives the same layout, without overlapping lifeline headers.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
