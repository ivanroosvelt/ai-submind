---
id: REQ-013
type: requirement
name: "Diagram type extensibility"
status: active
evidence: declared-doc
summary: "The format must allow adding diagram and element types without breaking existing documents"
aliases: ["kind", "extension"]
tags: [format]
relations:
  actors: []
  features: [FEAT-003]
  constraints: [NFR-011]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-013 · Diagram type extensibility

## Statement

The format must allow adding diagram and element types without breaking existing documents.

## Source

User [U]; DEC-002. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a version N document, when a new type is added in a minor version N+1, then it still validates.
2. Every diagram declares its `kind` and the registry of supported types.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

New concrete diagram types: later plan. In PLAN-002 only the extensible design.
