---
id: REQ-034
type: requirement
name: "Detect merge conflicts"
status: active
evidence: declared-doc
summary: "ai-submind must detect conflict markers in `knowledge/`, mark the file `conflicted` and not overwrite it"
aliases: []
tags: [integrity]
relations:
  actors: [ACT-003]
  features: [FEAT-008]
  constraints: [VAL-006]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-034 · Detect merge conflicts

## Statement

ai-submind must detect conflict markers in `knowledge/`, mark the file `conflicted` and not overwrite it.

## Source

User [U]. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Diagnostic visible in CLI, MCP and UI, without silent repair.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
