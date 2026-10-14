---
id: DEC-004
type: decision
name: "Own embedded knowledge engine instead of TerminusDB"
status: active
evidence: declared-doc
summary: "The useful subset of TerminusDB (schema, document graph, queries, diff, optimistic control) is reimplemented in TypeScript over files in knowledge/; git acts as history."
aliases: [terminusdb, engine, store, graph, queries, diff]
tags: [architecture, data]
relations:
  affects: [REQ-006, REQ-007, REQ-008, REQ-011, REQ-017, REQ-018, REQ-019, REQ-022, REQ-026, NFR-005, NFR-007, FEAT-002, FEAT-004, FEAT-008]
  supersedes: []
uncertainties:
  - "Three-way semantic merge as a git merge driver: after the MVP."
  - "Path query language: after the MVP."
---

# DEC-004 · Own embedded knowledge engine

## Context
- User: "terminusdb for db/json management"; then: "create a portable equivalent to manage the
  knowledge, merged with the features/validations we will build" [declared].
- TerminusDB v12.0.8, Apache-2.0, Prolog + Rust; requires its own server [verified: tech-research].
- Git already provides commits, branches, history and push/pull of the host project [verified].

## Alternatives considered
1. External TerminusDB (Docker) — full functionality; breaks `npx` portability, duplicates history.
2. **Own embedded engine** — portable, aligned with git; must be built and tested.
3. Generic embedded database (SQLite) — powerful queries; a second store to synchronize.

## Decision
In-process TypeScript engine, with `knowledge/` as the single source of truth. MVP subset inspired
by TerminusDB (studied from its open source code, does not require REA):
- In-memory document graph loaded from files; indexes by type, direct and inverse references.
- Schema: JSON Schema validation (Ajv 2020-12) + a second referential and invariants pass.
- Queries: by type/property, neighbours, inverse references, impact (transitive closure), simple paths.
- Transactional writes: batch fully validated before writing; optimistic control by revision
  hash (`@before`-like); atomic write (temporary file + rename).
- Semantic diff between revisions (used by MCP and post-merge validation).
- File watching: reload on external changes (manual edit, checkout, merge).
- Not replicated: WOQL/datalog, delta layers, own commits/branches.

## Consequences
- Positive: zero infrastructure; git remains the history.
- Negative / costs: performance bounded by memory (target ~10k elements per project); own maintenance.

## Affected elements
Persistence (CAP-014 no longer deferred), MCP queries, UI.

## Verification
Pending: tests for loading, transactions, revision conflict and external reload.
