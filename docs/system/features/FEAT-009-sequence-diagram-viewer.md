---
id: FEAT-009
type: feature
name: "Sequence diagram viewer"
status: active
evidence: declared-doc
summary: "Rendering and layout adjustment of sequence diagrams in the UI (mature stage S11 of PLAN-002)."
aliases: ["sequence", "sequence diagram", "lifeline"]
tags: [ui]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-004, ENT-005]
  functions: []
  interfaces: [API-002]
  integrations: []
  depends_on: [FEAT-007, FEAT-008]
  decisions: []
uncertainties: []
---

# FEAT-009 · Sequence diagram viewer

## Description
Own shapes for lifeline, activation, messages, combined fragments and interaction use; own sequence layout; class ↔ lifeline navigation (DEC-006). PLAN-002 S11, after S9 and S10.

## Behavior
REQ-040.

## States and transitions
No states of its own.

## Dependencies
FEAT-007, FEAT-008.

## Risks
Complexity of nested fragments.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
