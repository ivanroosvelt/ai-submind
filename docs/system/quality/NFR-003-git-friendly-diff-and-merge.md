---
id: NFR-003
type: quality-attribute
name: "Git-friendly diff and merge"
status: active
evidence: declared-doc
summary: "Canonical serialization and separate layout for minimal, readable diffs."
aliases: ["deterministic", "canonical"]
tags: [quality, data]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Semantic git merge driver: later plan."
---

# NFR-003 · Git-friendly diff and merge

## Requirement
Every write uses the canonical serialization (REQ-005); the layout lives in files separate from the model; a logical change does not reorder unrelated content. One file per model (DEC-002) accepts more merge conflicts, mitigated with post-merge detection (FEAT-008).

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Read→write round trip | no diff | `test/format/corpus.test.ts` (canonicalization) |
| Lines changed when editing an element | only those of the element and its references | inferred from canonical serialization; no line-level diff test |

## Scope
Files in `knowledge/` written by ai-submind.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
