---
id: NFR-006
type: quality-attribute
name: "Path confinement"
status: active
evidence: declared-doc
summary: "No read or write outside knowledge/; tools do not accept arbitrary paths."
aliases: ["path traversal"]
tags: [security]
relations:
  tests: []
  decisions: []
uncertainties: []
---

# NFR-006 · Path confinement

## Requirement
Path normalization, rejection of `..`, absolute paths and symlinks that leave `knowledge/` with `PATH_OUTSIDE_KNOWLEDGE`; MCP and the HTTP API reference by model/diagram ID, not by path.

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Path traversal attempts | 100 % rejected | S7 test |

## Scope
Engine, MCP, HTTP API, CLI (`--knowledge` confined to the root, DEC-001).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
