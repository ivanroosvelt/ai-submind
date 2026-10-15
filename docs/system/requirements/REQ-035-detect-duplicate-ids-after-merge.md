---
id: REQ-035
type: requirement
name: "Detect duplicate IDs after merge"
status: active
evidence: verified-code
summary: "ai-submind must report each duplicate id with its locations"
aliases: []
tags: [integrity]
test_code:
  - test/engine/edit.test.ts
  - test/integrity/merge.test.ts
  - test/format/rules.test.ts
  - test/query/query.test.ts
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

1. Queries for that id return `AMBIGUOUS_ID`; writes that affect it are blocked: update, delete and rename of
   it, and any new reference to it, fail with `AMBIGUOUS_ID`; deleting the model that holds one copy keeps the
   references, which resolve to the copy that remains (DEC-016).

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

Assisted repair (reassign id and references): later; REQ-039 serves as the basis.
