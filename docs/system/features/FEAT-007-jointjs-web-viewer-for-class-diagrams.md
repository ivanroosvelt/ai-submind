---
id: FEAT-007
type: feature
name: "JointJS web viewer for class diagrams"
status: active
evidence: declared-doc
summary: "Local UI with @joint/core to explore class diagrams and adjust and persist their layout."
aliases: ["ui", "viewer", "jointjs"]
tags: [ui]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-004, ENT-005]
  functions: []
  interfaces: [API-002]
  integrations: []
  depends_on: [FEAT-001, FEAT-002]
  decisions: []
uncertainties:
  - "UI framework: vanilla TS or lightweight library (DEC-006)."
---

# FEAT-007 · JointJS web viewer for class diagrams

## Description
UI with `@joint/core` and own UML shapes, dagre auto-layout, zoom/pan, selection, detail, navigation, live refresh; it only writes layout (DEC-006). PLAN-002 S9.

## Behavior
REQ-028..033.

## States and transitions
No UI states of its own beyond selection and view.

## Dependencies
FEAT-001 (the daemon serves the UI), FEAT-002.

## Risks
Own effort on shapes and tools (without JointJS+).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
