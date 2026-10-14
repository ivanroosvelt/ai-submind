---
id: NFR-007
type: quality-attribute
name: "Performance"
status: proposed
evidence: inferred
summary: "Time targets with ~10k elements per project (unconfirmed assumption)."
aliases: ["performance", "scale"]
tags: [quality]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Thresholds and scale not confirmed by the user."
  - "CAP-015 (performance) deferred in the environment."
---

# NFR-007 · Performance

## Requirement
Inferred target scale: ~10,000 elements per project and ~300 per diagram (DEC-004 cites ~10k). Thresholds proposed by the analyst.

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Startup and indexing (10k elements) | ≤3 s | benchmark |
| Structured query p95 | ≤200 ms | benchmark |
| Rendering a 300-element diagram | ≤2 s | browser |
| Reindexing on external change | ≤2 s | S5 test |

## Scope
Engine, queries, UI.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
