---
id: REQ-042
type: requirement
name: "Drill-down navigation between diagrams and link marker"
status: active
evidence: declared-doc
summary: "ACT-001 can open the flow, diagram or model behind an element with a double click, and sees a marker on elements that have a navigable target. Implemented in PLAN-005 S5 (targets computed by Query.diagram, API-002 `targets`; ↗ marker, double click and «Navigates to» in the UI); checked in the browser by the user (2026-10-17, PLAN-005 S6)"
aliases: ["drill-down", "navigate", "marker", "flows of flows"]
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-007, FEAT-009]
  constraints: []
  depends_on: [REQ-041, REQ-028, REQ-040]
  decisions: [DEC-020]
uncertainties:
  - "Rendering of the marker and double-click navigation are not covered by automated tests (no browser in the suite); checked in the browser by the user on 2026-10-17 with the garage example (PLAN-005 S6). Accepted as they are: no marker for a link to an element shown on the same diagram; double click opens the first target, the rest are in «Navigates to»; a model target opens its first diagram by ID."
---

# REQ-042 · Drill-down navigation between diagrams and link marker

## Statement

ACT-001 can open, from an element of a diagram, the flow, diagram or model it points to, in order to navigate flows
of flows in both directions (class ↔ sequence), and can see which elements have such a target.

## Source

User (2026-10-16, PLAN-005): UI "navigate + mark". DEC-020.

## Acceptance criteria

1. Given an operation (or its class) with `behavior`, when ACT-001 double-clicks it, then the sequence diagram of
   that interaction opens.
2. Given a message whose `signature` operation has `behavior`, when double-clicked, then that interaction's
   diagram opens.
3. Given an element with `links`, when double-clicked, then: a diagram target opens that diagram; a model target
   opens its first diagram; an element target opens a diagram that shows it (existing reveal behavior).
4. An `interaction_use` keeps opening the used interaction (REQ-040 CA3).
5. Elements with a navigable target show a visible marker (↗); elements without one show none.
6. Navigation goes one level per action; cycles between flows never make the UI recurse.

## Business rules

- Order of targets (PLAN-005 S5): the typed one first (operation `behavior`, message `signature` → `behavior`,
  interaction use `interaction`, a classifier's operation behaviors), then `links` in their order (a classifier's own,
  then its attributes' and operations'). Double click
  opens the first; the detail panel lists all of them under «Navigates to» (for the open diagram's own `links`,
  with nothing selected).
- A target that is the open diagram itself or an element it shows directly is not a drill-down target (e.g. a
  message whose operation's behavior is the shown interaction).
- A model target opens its first diagram by ID (the tree's order).
- Data from the model is never interpreted as HTML.

## Errors and edge cases

A target without any diagram that shows it, or a model without diagrams: the UI tells the user and stays where it
is.

## Out of scope

Editing `behavior` or `links` from the UI (REQ-032: the UI does not edit the model).
