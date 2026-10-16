---
id: DEC-003
type: decision
name: "Human-readable IDs with reference guarantee and maintenance"
status: active
evidence: declared-doc
summary: "Elements use readable IDs (scoped slugs) and the engine guarantees uniqueness and rewrites references on rename."
aliases: [ids, idref, slug, rename, references]
tags: [format, data, integrity]
relations:
  affects: [REQ-023, REQ-035, REQ-039, VAL-002, VAL-003, ENT-003, FEAT-006, API-004]
  supersedes: []
uncertainties: []
---

# DEC-003 · Readable IDs with reference guarantee

## Context
- User (2026-10-14): "readable with guarantee/maintenance of references" [declared].
- UMJ uses `id` + `{"idref": ...}`; it keeps the IDs of the source tool [verified: paper].

## Alternatives considered
1. Generated (ULID) — no collisions; opaque diffs.
2. **Readable with maintenance** — readable diffs and queries; requires refactoring references.
3. Unique per model — simple; cross references more complex.

## Decision
- Readable IDs derived from the scoped name (e.g. `Car`, `Car.yearOfProduction`, `Car.start()`),
  unique across all of `knowledge/`; collisions resolved with a deterministic suffix.
- A single namespace for all of `knowledge/` (elements, models and diagrams); therefore a
  reference to another model is a plain, unqualified `idref` (user, 2026-10-14). Grammar and
  deterministic derivation: spec §3 (API-004).
- The ID is stable: changing `name` does not change the `id`. Renaming an `id` only via an engine operation
  (`rename`), which atomically rewrites all references (model, diagrams, layout).
- Mandatory validation: global uniqueness, every reference resolves to an element of a compatible type.
- IDs from imported external tools are kept in a separate field (`external_id`).

## Consequences
- Positive: readability in git and in MCP queries.
- Negative / costs: manual edits that rename ids break references → detected by the validator, not silently repaired.

## Affected elements
Format (DEC-002), engine (DEC-004), MCP administration tools.

## Verification
`test/engine/engine.test.ts` (rename of an element, its prefixed IDs and every reference in models, diagrams and layout) and `test/integrity/merge.test.ts` (duplicate IDs after a real git merge, REQ-035).
