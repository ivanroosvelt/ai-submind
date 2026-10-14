---
id: REQ-010
type: requirement
name: "Layout separate from the model"
status: active
evidence: declared-doc
summary: "ai-submind must store the layout of each diagram in its own file as an extension of the format"
aliases: ["layout"]
tags: [format, ui]
relations:
  actors: []
  features: [FEAT-003]
  constraints: [VAL-005, NFR-003]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-010 · Layout separate from the model

## Statement

ai-submind must store the layout of each diagram in its own file as an extension of the format.

## Source

User [U]; UMJ paper; DEC-002. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a diagram without layout, when it is opened, then it is shown with automatic layout and nothing is written until the user moves something.
2. Given a moved element, when it is saved, then only `knowledge/layout/<diagram-id>.json` changes.
3. Given a layout entry for an element absent from the diagram, when it is validated, then warning `LAYOUT_ORPHAN`.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
