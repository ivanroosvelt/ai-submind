---
id: REQ-025
type: requirement
name: "Manage diagrams"
status: active
evidence: declared-doc
summary: "ACT-002 can create, rename and delete diagrams and add or remove references to elements"
aliases: []
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: [VAL-003]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-025 · Manage diagrams

## Statement

ACT-002 can create, rename and delete diagrams and add or remove references to elements.

## Source

User [U]. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given an element of a type not allowed by the diagram `kind`, when it is added, then a VAL-003 error.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
