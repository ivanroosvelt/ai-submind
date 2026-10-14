---
id: REQ-026
type: requirement
name: "Atomic batch operations"
status: active
evidence: declared-doc
summary: "ACT-002 can apply a batch of operations that is validated as a whole and persisted all or nothing"
aliases: ["batch", "transaction"]
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006, FEAT-002]
  constraints: [NFR-005]
  depends_on: [REQ-011]
  decisions: [DEC-011]
uncertainties:
  - "All or nothing holds for validation (nothing is written if anything fails); after a crash during the writes, atomicity is per file (DEC-011)."
---

# REQ-026 · Atomic batch operations

## Statement

ACT-002 can apply a batch of operations that is validated as a whole and persisted all or nothing.

## Source

Analyst assumption; DEC-004 (transactions). Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a batch with an invalid operation, when it is applied, then nothing is written and the errors are returned.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
