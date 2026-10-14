---
id: NFR-001
type: quality-attribute
name: "Portability"
status: active
evidence: declared-doc
summary: "Works on Linux, macOS and Windows with Node ≥22 using only npx, without Docker or native compilation."
aliases: ["portable", "npx", "cross-platform"]
tags: [quality]
relations:
  tests: []
  decisions: []
uncertainties:
  - "CI matrix per operating system not yet defined."
---

# NFR-001 · Portability

## Requirement
ai-submind is installed and run with `npx ai-submind` on Node ≥22 (DEC-001) without Docker, without external services and without native compilation when installing the core.

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Supported OSes | Linux, macOS, Windows | e2e in S12 (at least Linux; the rest to be decided) |
| Native dependencies of the core | 0 | dependency audit in S12 |

## Scope
The whole product except the optional embeddings module (DEC-007).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
