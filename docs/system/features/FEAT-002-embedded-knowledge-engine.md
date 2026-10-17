---
id: FEAT-002
type: feature
name: "Embedded knowledge engine"
status: active
evidence: verified-code
summary: "Own portable equivalent of TerminusDB over knowledge/: loading, graph, transactions, revision, rename, reload."
aliases: ["engine", "store", "terminusdb"]
tags: [data, engine]
implementation: verified
code:
  - src/engine/index.ts
  - src/engine/engine.ts#Engine
  - src/engine/store.ts#writeDocument
  - src/engine/rename.ts#rewriteIds
  - src/engine/ids.ts#deriveId
  - src/engine/diff.ts#semanticDiff
  - src/engine/edit.ts#edit
test_code:
  - test/engine/engine.test.ts
  - test/engine/edit.test.ts
  - test/engine/ids.test.ts
relations:
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  functions: []
  interfaces: []
  integrations: []
  depends_on: [FEAT-003]
  decisions: [DEC-004, DEC-011, DEC-015, DEC-016, DEC-020]
uncertainties:
  - "3-way semantic merge and path language: later (DEC-004)."
---

# FEAT-002 · Embedded knowledge engine

## Description
In-process TypeScript engine (DEC-004): in-memory document graph and indexes, validated transactional writes, optimistic concurrency control, atomic writes, rename with reference rewriting, watcher and semantic diff. Git is the history. Includes document-level batch transactions with dry run, rename with dry run, ID derivation, reload with watcher and semantic diff, and element-level edits with derived IDs, cascade and implicit init (`edit.ts`). Queries are FEAT-004; the engine exposes `generation` for their caches.
`behavior` and `links` (format 1.1, DEC-020) are written through the same create/update operations on elements,
diagrams and the model (a `links` patch replaces the whole set, written sorted); deleting their target follows
the cascade like any optional reference: without `cascade` it is `REFERENCED`; with it, `behavior` is unset and
only the deleted entry leaves `links` (an emptied set is not written). Deleting a whole model or diagram removes
the links to it.

## Behavior
REQ-005..008, REQ-022, REQ-023..027 (element edits, batch, dry run), REQ-039, REQ-041.

## Operation errors
`NOT_FOUND`, `AMBIGUOUS_ID`, `INVALID_ID`, `INVALID_PATH`, `PATH_OUTSIDE_KNOWLEDGE`, `INVALID_BATCH`, `DOCUMENT_INVALID`, `REVISION_CONFLICT`, `VALIDATION_FAILED` (with the findings), `RENAME_COLLISION`, `RENAME_BLOCKED`, `CREATE_BLOCKED`, `REFERENCED` (with the references),
`INVALID_ARGUMENT` (`src/engine/errors.ts`).

## States and transitions
Document status as in API-004 (`writable`, `read_only`, `invalid_encoding`, `conflicted`, `invalid_parse`, `invalid_schema`); only `writable` accepts writes; every change on disk triggers revalidation. Engine: `ok`, or `degraded` while some finding is an error (REQ-022). Persistence, revisions and reload: DEC-011.

## Dependencies
FEAT-003 (format and validation).

## Risks
Performance bounded by memory (NFR-007); own maintenance.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
