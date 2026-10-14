---
id: FEAT-002
type: feature
name: "Embedded knowledge engine"
status: active
evidence: declared-doc
summary: "Own portable equivalent of TerminusDB over knowledge/: loading, graph, transactions, revision, rename, reload."
aliases: ["engine", "store", "terminusdb"]
tags: [data, engine]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  functions: []
  interfaces: []
  integrations: []
  depends_on: [FEAT-003]
  decisions: []
uncertainties:
  - "3-way semantic merge and path language: later (DEC-004)."
---

# FEAT-002 · Embedded knowledge engine

## Description
In-process TypeScript engine (DEC-004): in-memory document graph and indexes, validated transactional writes, optimistic concurrency control, atomic writes, rename with reference rewriting, watcher and semantic diff. Git is the history. PLAN-002 S5.

## Behavior
REQ-005..008, REQ-022, REQ-026 (transaction), REQ-039.

## States and transitions
Document: `valid` · `valid_with_warnings` · `invalid_parse` · `invalid_schema` · `conflicted` · `unsupported_version`; only the first two accept writes; every change on disk triggers revalidation.

## Dependencies
FEAT-003 (format and validation).

## Risks
Performance bounded by memory (NFR-007); own maintenance.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
