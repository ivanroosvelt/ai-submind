---
id: NFR-002
type: quality-attribute
name: "Offline operation"
status: active
evidence: declared-doc
summary: "All core functions operate offline."
aliases: ["offline"]
tags: [quality]
relations:
  tests: []
  decisions: []
uncertainties: []
---

# NFR-002 · Offline operation

## Requirement
CLI, engine, queries, lexical search, MCP and UI work without network access. Semantic search may require downloading a model once (DEC-007).

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Network calls from the core | 0 | test with network disabled (S12) |

## Scope
Entire core; excludes the download of the embeddings model.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
