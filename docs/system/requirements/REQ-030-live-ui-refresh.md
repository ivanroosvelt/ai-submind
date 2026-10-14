---
id: REQ-030
type: requirement
name: "Live UI refresh"
status: active
evidence: declared-doc
summary: "The UI reflects changes made through MCP or on disk without a manual reload"
aliases: []
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-007]
  constraints: []
  depends_on: [REQ-007]
  decisions: []
uncertainties: []
---

# REQ-030 · Live UI refresh

## Statement

The UI reflects changes made through MCP or on disk without a manual reload.

## Source

Analyst assumption; DEC-005 (shared state). Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a change through MCP or on disk, when the engine applies it, then the open UI is updated.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
