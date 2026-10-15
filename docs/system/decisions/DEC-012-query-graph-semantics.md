---
id: DEC-012
type: decision
name: "Query graph semantics: edge kinds, dependency direction, hubs and strict arguments"
status: active
evidence: declared-doc
summary: "Queries see knowledge/ as a graph where A→B means A depends on B (containers, packages and diagrams depend on their parts); impact follows incoming edges, undirected associations both ways; models and diagrams are not intermediate path steps by default; out-of-range arguments are rejected."
aliases: [graph, impact, paths, edges, relations, hubs, pagination]
tags: [queries, architecture]
relations:
  affects: [FEAT-004, REQ-016, REQ-017, REQ-018, REQ-019]
  supersedes: []
uncertainties: []
---

# DEC-012 · Query graph semantics

## Context
- REQ-017 asks for relationships filterable by type (association, generalization, dependency, realization,
  ownership, appearance in diagram, sequence references); REQ-018 for a transitive impact with depth and
  relationship types that terminates on cycles; REQ-019 for shortest simple paths with limits [declared].
- The format stores relationships both as relation elements (spec §6.3) and as `{"idref"}` references
  (spec §4); every element has a structural container (spec §6) [verified: src/format/semantic.ts].
- Every model owns all its elements, so a naive graph makes the model a hub that connects everything [inferred].

## Alternatives considered
1. Only relation elements as edges — simple, but misses typing, sequence and diagram references.
2. **All references plus derived relation edges and ownership, with a single dependency direction** — one graph
   for relations, impact and paths; hubs need explicit handling.
3. Separate graphs per query — more precise per query, more code and inconsistent answers.

## Decision
- Edge kinds: `owns` (container → part), `member` (package → member), `shows` (diagram → element),
  `reference` (innermost element containing an `idref` → target, with its key), and one derived edge per
  relation element: `generalization` (specific → general), `dependency` and `realization` (client →
  supplier), `association` (end1 → end2; undirected when the association is `undirected`). Layout references
  are not edges.
- A→B means "A depends on B". Impact (`dependents`) follows incoming edges; undirected edges are traversed
  both ways; unresolved references are not traversed. BFS with a visited set: it terminates and each element
  appears once.
- Paths: simple paths, shortest first, undirected by default; models and diagrams only as endpoints unless
  `throughHubs`; length, count and visit budget limits with `truncated`.
- Results in a stable order: listings and `find` by ID (code-unit comparison); `relations` by direction (outgoing
  first), edge kind, other end, key, via and pointer; `impact` by depth and then ID (a result truncated by
  `limit` is a prefix of the full one); `search` by score and then ID. Offset/limit pagination with `nextOffset`
  and the engine `generation` in every result.
- Arguments must be plain objects with known keys; out-of-range values, unknown keys, types or kinds and an
  oversized search text fail with `INVALID_ARGUMENT` (limits in `src/query/limits.ts`).
- Paths are sequences of distinct nodes; between two neighbours only the first edge in edge order is used, so
  parallel edges do not multiply paths.
- Every result reports degradation and the excluded documents (REQ-022).

## Consequences
- Positive: one consistent graph; agents get typed errors instead of silently clamped answers.
- Negative / costs: ownership makes impact broad by default; callers narrow it with `kinds` and `maxDepth`.

## Affected elements
FEAT-004, REQ-016..019; `src/query/`.

## Verification
PLAN-002 S6 tests over the garage corpus (`test/query/`).
