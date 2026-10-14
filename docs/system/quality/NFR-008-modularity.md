---
id: NFR-008
type: quality-attribute
name: "Modularity"
status: active
evidence: declared-doc
summary: "Own modules with explicit interfaces and no cycles; MCP and UI share the core."
aliases: ["modular", "architecture"]
tags: [architecture]
relations:
  tests: []
  decisions: [DEC-009]
uncertainties: []
---

# NFR-008 · Modularity

## Requirement
Modules decoupled through interfaces within a single package (DEC-001, DEC-008), in `src/<module>/`: format core, engine, queries, search, MCP, HTTP server, UI, CLI. No cyclic dependencies; MCP and UI use the same engine.

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Cycles between modules | 0 | `npm run deps` (dependency-cruiser, rule `no-circular`; DEC-009), part of `npm run check` |

## Scope
All product code. Rules in `.dependency-cruiser.cjs`: no cycles, `src/format` does not depend on other modules, no unresolvable imports nor imports of development dependencies from `src/`.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
