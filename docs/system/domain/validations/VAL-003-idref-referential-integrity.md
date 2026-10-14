---
id: VAL-003
type: validation
name: "idref referential integrity"
status: active
evidence: verified-code
summary: "Every reference resolves to an existing element of a type compatible with the key."
aliases: ["idref", "broken reference"]
tags: [validation]
implementation: verified
code:
  - src/format/semantic.ts#checkKnowledge
  - src/format/semantic.ts#indexDocuments
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-003 · idref referential integrity

## Rule
Every `idref` points to an existing id of a compatible type (e.g. generalization ends → class; realization supplier → interface; message events → occurrence specification; `covered` → lifeline; class diagram → elements allowed by its `kind`).

Since IDs are global (DEC-003), a reference to another model is a plain `idref`.

## Applies to
ENT-002, ENT-003, ENT-004, ENT-005.

## Message / error code
Severity error; broken references are reported without blocking the loading of the rest (REQ-036).

## Examples

| Input | Result |
|-------|--------|
| Generalization towards a non-existent id | error |
| `covered` pointing to a class | error |

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Exact grammar and codes: format spec (API-004, §10).
