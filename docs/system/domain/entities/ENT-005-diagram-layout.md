---
id: ENT-005
type: entity
name: "Diagram layout"
status: active
evidence: declared-doc
summary: "Positions, sizes, link vertices and style of a diagram, separate from the model."
aliases: ["layout", "positions"]
tags: [format, data]
implementation: none
code: []
test_code: []
relations:
  related: [ENT-004]
  validations: [VAL-001, VAL-005, VAL-006]
  decisions: [DEC-018]
uncertainties: []
---

# ENT-005 · Diagram layout

## Description
Format-specific extension (UMJ does not define layout). In sequence diagrams: horizontal position, minimum width and minimum length (`height`) of lifelines; `y` is derived (header top) and the order of events is given by the model; message entries only carry `style` (DEC-018).

## Properties

| Property | Type | Required | Constraints |
|----------|------|----------|-------------|
| diagram | idref | yes | VAL-005 |
| nodes | map id→position (top-left) and minimum size | no | finite integers; the drawn size is never smaller than the content (spec §8) |
| links | map id→vertices | no |  |
| style | object | no | optional |

## Invariants
See VAL-005.

## Persistence
`knowledge/layout/<diagram-id>.json`.

## Lifecycle
Created when something is moved in the UI (not before, REQ-010); renaming ids updates it (REQ-039).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Indicative properties; the exact definition is the spec and the JSON Schema (API-004).
