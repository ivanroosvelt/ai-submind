---
id: REQ-012
type: requirement
name: "Validation report"
status: active
evidence: declared-doc
summary: "ACT-002 can request validation of all of `knowledge/` via MCP and ACT-001 can run it via CLI (CI, pre-commit)"
aliases: ["validate"]
tags: [validation]
relations:
  actors: [ACT-001, ACT-002]
  features: [FEAT-003, FEAT-001]
  constraints: []
  depends_on: [REQ-011]
  decisions: []
uncertainties: []
---

# REQ-012 · Validation report

## Statement

ACT-002 can request validation of all of `knowledge/` via MCP and ACT-001 can run it via CLI (CI, pre-commit).

## Source

Analyst assumption. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Each finding includes severity, code, file, JSON Pointer, affected id and message.
2. The CLI subcommand exits with code ≠ 0 if there are errors.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
