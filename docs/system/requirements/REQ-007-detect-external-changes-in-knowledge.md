---
id: REQ-007
type: requirement
name: "Detect external changes in knowledge/"
status: active
evidence: declared-doc
summary: "ai-submind must revalidate and reindex when ACT-001 or ACT-003 modify `knowledge/` outside ai-submind"
aliases: ["watcher", "reload"]
tags: [engine]
relations:
  actors: [ACT-001, ACT-003]
  features: [FEAT-002]
  constraints: [NFR-005, NFR-007]
  depends_on: [REQ-006]
  decisions: []
uncertainties: []
---

# REQ-007 · Detect external changes in knowledge/

## Statement

ai-submind must revalidate and reindex when ACT-001 or ACT-003 modify `knowledge/` outside ai-submind.

## Source

User [U]; DEC-004. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given the active daemon, when a file changes on disk, then it is revalidated, reindexed and the UI refreshes (REQ-030).
2. Given an external change to a document with a write in progress, when the write commits, then it is rejected with `REVISION_CONFLICT`.
3. Given a checkout that changes many files, then reindexing is batched without exposing intermediate states as errors.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
