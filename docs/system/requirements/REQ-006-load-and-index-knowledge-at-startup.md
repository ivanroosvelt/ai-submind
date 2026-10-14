---
id: REQ-006
type: requirement
name: "Load and index knowledge/ at startup"
status: active
evidence: declared-doc
summary: "ai-submind must load all of `knowledge/` and build the query indexes at startup"
aliases: ["loading", "index"]
tags: [engine]
relations:
  actors: []
  features: [FEAT-002]
  constraints: [NFR-007, VAL-006]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-006 · Load and index knowledge/ at startup

## Statement

ai-submind must load all of `knowledge/` and build the query indexes at startup.

## Source

Analyst assumption; DEC-004. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given `knowledge/` with valid and invalid files, when it starts, then it loads the valid ones, marks the invalid ones (REQ-022) and stays in `degraded` state without aborting.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
