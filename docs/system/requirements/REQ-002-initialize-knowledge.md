---
id: REQ-002
type: requirement
name: "Initialize knowledge/"
status: active
evidence: declared-doc
summary: "ACT-001 or ACT-002 can initialize `knowledge/`"
aliases: ["init"]
tags: [cli]
relations:
  actors: [ACT-001, ACT-002]
  features: [FEAT-001]
  constraints: [VAL-004]
  depends_on: []
  decisions: []
uncertainties:
  - "P10: whether the first MCP write initializes implicitly."
---

# REQ-002 · Initialize knowledge/

## Statement

ACT-001 or ACT-002 can initialize `knowledge/` to start documenting.

## Source

User [U]; analyst assumption; PLAN-002 S7/S10. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a project without `knowledge/`, when it starts without writing, then nothing is created and queries return an empty set.
2. Given a project without `knowledge/`, when `ai-submind init` runs, then `knowledge/ai-submind.json` is created with the format version and `.ai-submind/` is added to `.gitignore`.
3. Given an existing `knowledge/`, when it is reinitialized, then no file is overwritten.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
