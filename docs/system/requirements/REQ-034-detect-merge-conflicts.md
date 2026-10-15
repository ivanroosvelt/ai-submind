---
id: REQ-034
type: requirement
name: "Detect merge conflicts"
status: active
evidence: verified-code
summary: "ai-submind must detect conflict markers in `knowledge/`, mark the file `conflicted` and not overwrite it"
aliases: []
tags: [integrity]
test_code:
  - test/engine/edit.test.ts
  - test/integrity/merge.test.ts
  - test/format/rules.test.ts
  - test/engine/engine.test.ts
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
2. The conflicted file is never written; while it is unreadable, writes that add IDs fail with `CREATE_BLOCKED`
   and `rename` with `RENAME_BLOCKED` (it may already hold any ID); other writes go on (DEC-016).

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
