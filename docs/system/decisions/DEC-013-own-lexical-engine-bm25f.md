---
id: DEC-013
type: decision
name: "Own lexical engine: BM25F with Unicode folding and camelCase splitting, in memory"
status: proposed
evidence: declared-doc
summary: "Lexical search is an own in-memory BM25F index over name, id, tags, stereotypes and documentation, with accent and case folding, camelCase splitting and prefix matching; no dependency, not persisted."
aliases: [bm25, bm25f, minisearch, lexical, tokenizer, search]
tags: [queries]
relations:
  affects: [FEAT-004, REQ-038]
  supersedes: []
uncertainties:
  - "Weights, prefix weight and folding (ñ → n) are defaults chosen by the agent on 2026-10-14, pending confirmation by the user; the role of an association end is indexed as its name; enumeration literals and guards are not indexed yet."
---

# DEC-013 · Own lexical engine

## Context
- DEC-007 leaves the lexical engine open: own BM25 or minisearch [declared].
- REQ-038: relevance order deterministic on ties, offline, no optional dependencies, derived and rebuildable
  index [declared].
- IDs are readable and camelCase (`Car.yearOfProduction`); the corpus mixes languages [verified: corpus].

## Alternatives considered
1. minisearch — mature, fuzzy search; one more runtime dependency and its own tokenizer and ranking to adapt.
2. **Own BM25F** — small, deterministic, field weights and folding under our control; own maintenance.

## Decision
- Fields and weights: name 3, id 2, tags 2, stereotypes 2, documentation 1; models, diagrams and every element
  are indexed (a duplicate ID once, with the fields of all its occurrences).
- Text folding: NFKD, combining marks removed, lowercase; tokens are runs of letters and digits, plus their
  camelCase / acronym / letter-digit parts. No stopwords.
- Ranking: BM25F (k1 = 1.2, b = 0.75 per field); query terms of 3 or more characters also match index terms
  that start with them, with weight 0.5; per query term and document an exact match always wins over an
  expansion (otherwise a rare longer term such as `fueltype` outranks the exact `fuel`); ties by ID. Hits report
  the matched index terms and the fields where they occur.
- Index in memory, updated incrementally from the engine `change` diffs and rebuilt when needed; not persisted
  (if it ever is, under `.ai-submind/`).

## Consequences
- Positive: no dependency; accents and case never block a match.
- Negative / costs: no fuzzy matching or phrase queries.

## Affected elements
FEAT-004, REQ-038, DEC-007; `src/query/text.ts`, `src/query/lexical.ts`.

## Verification
PLAN-002 S6 tests (`test/query/`), including incremental update = full rebuild.
