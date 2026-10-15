---
id: REQ-027
type: requirement
name: "Dry run"
status: active
evidence: declared-doc
summary: "Any write operation accepts `dryRun`, which returns validation and diff without writing"
aliases: ["dry run"]
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: []
  depends_on: []
  decisions: [DEC-015, DEC-016]
uncertainties: []
---

# REQ-027 · Dry run

## Statement

Any write operation accepts `dryRun`, which returns validation and diff without writing.

## Source

Analyst assumption, confirmed by the user in DEC-015. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given `dryRun: true`, then `knowledge/` does not change (not even by implicit init, DEC-015).
2. Given `dryRun: true`, then the response carries the same validation result and diff as the real write.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
