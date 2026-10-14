---
id: REQ-032
type: requirement
name: "UI without model editing"
status: active
evidence: declared-doc
summary: "The UI does not offer creating, deleting, renaming or reconnecting elements; the HTTP API rejects any write that is not layout"
aliases: []
tags: [ui, security]
relations:
  actors: [ACT-001]
  features: [FEAT-007]
  constraints: []
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-032 · UI without model editing

## Statement

The UI does not offer creating, deleting, renaming or reconnecting elements; the HTTP API rejects any write that is not layout.

## Source

User [A]; DEC-006. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given an HTTP model-write request, then it is rejected.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
