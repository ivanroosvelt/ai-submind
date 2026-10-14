---
id: DEC-007
type: decision
name: "Lexical search always available and optional local semantic search"
status: active
evidence: declared-doc
summary: "Structured queries + lexical search in the core; local embeddings as an optional module; derived indexes outside git."
aliases: [search, semantic, embeddings, lexical, queries]
tags: [queries, architecture]
relations:
  affects: [REQ-016, REQ-020, REQ-038, NFR-002, ACT-004, FEAT-004, FEAT-005]
  supersedes: []
uncertainties:
  - "Embeddings model and whether it is downloaded on demand or bundled."
---

# DEC-007 · Lexical search and optional semantic search

## Context
- User: smart queries = "Structured queries, Semantic search"; no embedded LLM [declared].
- `@huggingface/transformers` 4.3.1 pulls in `onnxruntime-node` (~301 MB); quantized all-MiniLM-L6-v2 ~23 MB [verified: npm].

## Alternatives considered
1. Mandatory embeddings — better recall; heavy installation for `npx`.
2. **Lexical in the core + optional embeddings** — lightweight `npx`; semantic search once enabled.
3. External embeddings API — lightweight; requires network, a key and sends content outside.

## Decision
- Core: structured queries over the graph (DEC-004) + lexical search (own BM25 or minisearch).
- Optional local embeddings module (optional dependency, model downloaded to the user's cache);
  own brute-force vector store (cosine) in `knowledge/.ai-submind/` (ignored by git),
  invalidated by content hash. Provider interface to add others later.
- Semantic search: after the core MVP.

## Consequences
- Positive: fast startup, works offline.
- Negative / costs: semantic search requires an additional installation step.

## Affected elements
MCP queries, performance (CAP-015).

## Verification
Pending: indexing and query benchmark with a sample corpus.
