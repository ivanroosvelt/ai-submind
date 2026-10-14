---
id: NFR-011
type: quality-attribute
name: "Format compatibility"
status: active
evidence: inferred
summary: "Semantic versioning of the format and explicit migration, never a silent version rewrite."
aliases: ["versioning", "migration"]
tags: [data, migrations]
relations:
  tests: []
  decisions: [DEC-002]
uncertainties: []
---

# NFR-011 · Format compatibility

## Requirement
The format is versioned (DEC-002). Proposal: semantic versioning; earlier supported versions are read and migrated only through an explicit operation; the version is never silently rewritten; a version later than the supported one, or an earlier one without migration, is opened read-only with tolerant reading (spec §11, API-004).

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Silent version rewrites | 0 | S4 tests |

## Scope
Files in `knowledge/`.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
