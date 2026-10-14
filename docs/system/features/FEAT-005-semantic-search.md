---
id: FEAT-005
type: feature
name: "Semantic search"
status: proposed
evidence: declared-doc
summary: "Similarity search with optional local embeddings. Outside PLAN-002 (later)."
aliases: ["semantic", "embeddings"]
tags: [queries, later]
implementation: none
code: []
test_code: []
relations:
  entities: []
  functions: []
  interfaces: [API-001]
  integrations: []
  depends_on: [FEAT-004]
  decisions: []
uncertainties:
  - "Embeddings model and download method (DEC-007)."
---

# FEAT-005 · Semantic search

## Description
Optional module (DEC-007): embeddings provider (ACT-004), own cosine vector store in `knowledge/.ai-submind/`, invalidated by hash. Outside PLAN-002.

## Behavior
REQ-020.

## States and transitions
Index: `absent` → `building` → `ready` → `stale` → `building`.

## Dependencies
FEAT-004.

## Risks
Dependency weight (onnxruntime ~301 MB) for `npx`.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
