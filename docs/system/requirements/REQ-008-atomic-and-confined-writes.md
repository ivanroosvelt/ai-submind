---
id: REQ-008
type: requirement
name: "Atomic and confined writes"
status: active
evidence: declared-doc
summary: "Every ai-submind write must be atomic and confined to `knowledge/`"
aliases: ["atomic"]
tags: [security, data]
relations:
  actors: []
  features: [FEAT-002]
  constraints: [NFR-006]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-008 · Atomic and confined writes

## Statement

Every ai-submind write must be atomic and confined to `knowledge/`.

## Source

Analyst assumption; DEC-004, DEC-005. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a process killed during a write, when it restarts, then each file is at its previous or new version, never truncated.
2. Given a path outside `knowledge/` (`..`, absolute, external symlink), when reading or writing is attempted, then error `PATH_OUTSIDE_KNOWLEDGE`.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
