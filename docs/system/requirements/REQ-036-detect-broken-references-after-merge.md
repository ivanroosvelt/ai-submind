---
id: REQ-036
type: requirement
name: "Detect broken references after merge"
status: active
evidence: declared-doc
summary: "ai-submind must report references without a target without blocking the loading of the rest"
aliases: []
tags: [integrity]
relations:
  actors: [ACT-003]
  features: [FEAT-008]
  constraints: [VAL-003]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-036 · Detect broken references after merge

## Statement

ai-submind must report references without a target without blocking the loading of the rest.

## Source

User [U]. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Each broken reference appears in the validation report with its location.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
