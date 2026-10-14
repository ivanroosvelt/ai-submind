---
id: REQ-027
type: requirement
name: "Dry run"
status: proposed
evidence: inferred
summary: "Any write operation accepts `dry_run`, which returns validation and diff without writing"
aliases: ["dry run"]
tags: [mcp, later]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: []
  depends_on: []
  decisions: []
uncertainties:
  - "Later increment according to the annex; confirm whether it enters PLAN-002."
---

# REQ-027 · Dry run

## Statement

Any write operation accepts `dry_run`, which returns validation and diff without writing.

## Source

Analyst assumption. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given `dry_run: true`, then `knowledge/` does not change.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
