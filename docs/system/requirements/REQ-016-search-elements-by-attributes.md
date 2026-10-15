---
id: REQ-016
type: requirement
name: "Search elements by attributes"
status: active
evidence: declared-doc
summary: "ACT-002 can search elements by name (exact or partial, case-insensitive), type, model, package or diagram, with pagination"
aliases: ["filter", "search"]
tags: [queries]
relations:
  actors: [ACT-002]
  features: [FEAT-004]
  constraints: []
  depends_on: []
  decisions: [DEC-012]
uncertainties:
  - "Implemented filters go beyond the statement: tags, stereotypes, code_refs, documentation, visibility, owner and interaction (spec §7.1, DEC-012)."
---

# REQ-016 · Search elements by attributes

## Statement

ACT-002 can search elements by name (exact or partial, case-insensitive), type, model, package or diagram, with pagination.

## Source

User [U]; DEC-007 (structured queries). Proposed in REP-003 Annex A.

## Acceptance criteria

1. Deterministic, paginated results.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
