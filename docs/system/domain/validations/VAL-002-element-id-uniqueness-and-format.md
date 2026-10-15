---
id: VAL-002
type: validation
name: "Element ID uniqueness and format"
status: active
evidence: verified-code
summary: "Every id is readable, non-empty, conforms to the grammar and is unique across all of knowledge/."
aliases: ["duplicate id", "uniqueness"]
tags: [validation]
implementation: verified
code:
  - src/format/semantic.ts#checkKnowledge
  - spec/format/schema/1.0/defs.schema.json
  - src/engine/ids.ts#deriveId
  - src/query/filters.ts#resolveId
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
  - test/engine/ids.test.ts
  - test/query/query.test.ts
relations:
  tests: []
  decisions: []
uncertainties:
  - "Derivation and collision suffixes (spec §3.3) are implemented as engine functions; they are applied when creating elements without an id (REQ-023, PLAN-002 S8)."
---

# VAL-002 · Element ID uniqueness and format

## Rule
Readable scoped IDs (e.g. `Car`, `Car.start()`) conforming to the grammar of spec §3.1 (file ID for models and diagrams, element ID for the rest), globally unique in `knowledge/` (DEC-003); collisions on generation are resolved with a deterministic suffix; a duplicate id on disk (e.g. after a merge) is an error.

## Applies to
ENT-003, ENT-004 and every element with an `id`.

## Message / error code
Severity error; queries on a duplicate id return `AMBIGUOUS_ID`.

## Examples

| Input | Result |
|-------|--------|
| Two `Car` elements in different models | error, both reported |
| empty id | error |

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Exact grammar and codes: format spec (API-004, §10).
