---
id: VAL-007
type: validation
name: "UMJ-derived model semantic rules"
status: active
evidence: verified-code
summary: "Semantic invariants: association direction, fragment order and ownership of relationships."
aliases: ["umj", "invariants"]
tags: [validation]
implementation: verified
code:
  - src/format/semantic.ts#checkKnowledge
  - src/format/semantic.ts#edgesInCycles
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-007 · UMJ-derived model semantic rules

## Rule
A directed association goes from the first to the second end; the order of the events array of an interaction is significant and is not reordered; relationships belong to the root model and packages only hold references (derived from UMJ, adaptable per DEC-002). In aggregation and composition `end1` is the whole. Deviations from UMJ: spec §12.

## Applies to
ENT-002, ENT-003.

## Message / error code
Severity error.

## Examples

| Input | Result |
|-------|--------|
| Package containing its own association | error |
| Reordering fragments when serializing | forbidden |

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Exact grammar and codes: format spec (API-004, §10).
