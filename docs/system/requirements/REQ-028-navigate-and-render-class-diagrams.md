---
id: REQ-028
type: requirement
name: "Navigate and render class diagrams"
status: active
evidence: declared-doc
summary: "ACT-001 can navigate models and diagrams and see a class diagram rendered with JointJS"
aliases: ["jointjs", "render"]
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-007]
  constraints: [NFR-007]
  depends_on: [REQ-004]
  decisions: []
uncertainties: []
---

# REQ-028 · Navigate and render class diagrams

## Statement

ACT-001 can navigate models and diagrams and see a class diagram rendered with JointJS.

## Source

User [U][A]; DEC-006. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a diagram without a saved layout, then auto-layout (dagre) is applied.
2. Zoom, pan, selection and navigation between diagrams.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

Sequence diagrams: REQ-040.
