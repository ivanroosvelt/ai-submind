---
id: ACT-004
type: actor
name: "Embeddings provider"
status: proposed
evidence: declared-doc
summary: "Optional local module that converts text into vectors for semantic search (outside PLAN-002)."
aliases: ["embeddings", "embeddings model"]
tags: [external-system, later]
relations:
  specializes: []
uncertainties:
  - "Specific embeddings model and whether it is downloaded on demand or bundled (DEC-007)."
---

# ACT-004 · Embeddings provider

## Description
Optional local embeddings module with a provider interface (DEC-007). It only receives text and returns vectors.
Outside PLAN-002 (semantic search comes later).

## Goals
Enable REQ-020.

## Permissions

| Resource / operation | Allowed | Conditions |
|---------------------|-----------|-------------|
| Receive element text | yes | local, no network except for downloading the model |
| Write to `knowledge/` | no | indexes in `knowledge/.ai-submind/` (ignored by git) |
