---
id: VAL-005
type: validation
name: "Layout consistency"
status: active
evidence: verified-code
summary: "The layout references an existing diagram; orphan entries are a warning; finite numbers."
aliases: ["layout orphan"]
tags: [validation]
implementation: verified
code:
  - src/format/semantic.ts#checkKnowledge
  - spec/format/schema/1.0/layout.schema.json
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-005 · Layout consistency

## Rule
`layout/<diagram-id>.json` corresponds to an existing diagram; entries for elements no longer in the diagram → warning `LAYOUT_ORPHAN`; integer and finite coordinates (DEC-002). In sequence diagrams only lifelines (`nodes`) and messages (`edges`) have entries; executions, fragments and rows are never persisted (DEC-018).

## Applies to
ENT-005.

## Message / error code
Warning (`LAYOUT_ORPHAN`) or error (non-existent diagram, non-finite values).

## Examples

| Input | Result |
|-------|--------|
| Position of an element removed from the diagram | warning LAYOUT_ORPHAN |
| x = NaN | error |

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Exact grammar and codes: format spec (API-004, §10).
