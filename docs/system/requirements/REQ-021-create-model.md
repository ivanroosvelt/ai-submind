---
id: REQ-021
type: requirement
name: "Create model"
status: active
evidence: declared-doc
summary: "ACT-002 can create an empty model with a name"
aliases: []
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: [VAL-002]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-021 · Create model

## Statement

ACT-002 can create an empty model with a name.

## Source

User [U]; DEC-002. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a name, when it is created, then a canonical `knowledge/models/<model-id>.json` is written with a unique readable id.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
