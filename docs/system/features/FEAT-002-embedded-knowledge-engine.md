---
id: FEAT-002
type: feature
name: "Embedded knowledge engine"
status: active
evidence: verified-code
summary: "Own portable equivalent of TerminusDB over knowledge/: loading, graph, transactions, revision, rename, reload."
aliases: ["engine", "store", "terminusdb"]
tags: [data, engine]
implementation: partial
code:
  - src/engine/index.ts
  - src/engine/engine.ts#Engine
  - src/engine/store.ts#writeDocument
  - src/engine/rename.ts#rewriteIds
  - src/engine/ids.ts#deriveId
  - src/engine/diff.ts#semanticDiff
test_code:
  - test/engine/engine.test.ts
  - test/engine/ids.test.ts
relations:
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  functions: []
  interfaces: []
  integrations: []
  depends_on: [FEAT-003]
  decisions: [DEC-004, DEC-011]
uncertainties:
  - "3-way semantic merge and path language: later (DEC-004)."
  - "Implemented (PLAN-002 S5): loading and indexes (by ID, inverse references), document-level batch transactions, rename, ID derivation functions, reload with watcher and semantic diff. Pending: element-level create/update/delete with derived IDs and cascade (REQ-023, REQ-024; S8, on top of transactions) and queries beyond get/inverse references (FEAT-004, S6)."
---

# FEAT-002 · Embedded knowledge engine

## Description
In-process TypeScript engine (DEC-004): in-memory document graph and indexes, validated transactional writes, optimistic concurrency control, atomic writes, rename with reference rewriting, watcher and semantic diff. Git is the history. PLAN-002 S5.

## Behavior
REQ-005..008, REQ-022, REQ-026 (transaction), REQ-039.

## Operation errors
`NOT_FOUND`, `AMBIGUOUS_ID`, `INVALID_ID`, `INVALID_PATH`, `PATH_OUTSIDE_KNOWLEDGE`, `INVALID_BATCH`, `DOCUMENT_INVALID`, `REVISION_CONFLICT`, `VALIDATION_FAILED` (with the findings), `RENAME_COLLISION`, `RENAME_BLOCKED` (`src/engine/errors.ts`).

## States and transitions
Document status as in API-004 (`writable`, `read_only`, `invalid_encoding`, `conflicted`, `invalid_parse`, `invalid_schema`); only `writable` accepts writes; every change on disk triggers revalidation. Engine: `ok`, or `degraded` while some finding is an error (REQ-022). Persistence, revisions and reload: DEC-011.

## Dependencies
FEAT-003 (format and validation).

## Risks
Performance bounded by memory (NFR-007); own maintenance.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
