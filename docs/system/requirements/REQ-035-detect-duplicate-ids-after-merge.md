---
id: REQ-035
type: requirement
name: "Detect duplicate IDs after merge"
status: active
evidence: declared-doc
summary: "ai-submind must report each duplicate id with its locations"
aliases: []
tags: [integrity]
relations:
  actors: [ACT-003]
  features: [FEAT-008]
  constraints: [VAL-002]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-035 · Detect duplicate IDs after merge

## Statement

ai-submind must report each duplicate id with its locations.

## Source

User [U]; DEC-003. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Queries for that id return `AMBIGUOUS_ID`; writes that affect it are blocked.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

Assisted repair (reassign id and references): later; REQ-039 serves as the basis.
