---
id: VAL-001
type: validation
name: "Conformance with the format JSON Schema"
status: active
evidence: verified-code
summary: "Every document in knowledge/ complies with the JSON Schema 2020-12 of its version."
aliases: ["json schema", "schema"]
tags: [validation]
implementation: verified
code:
  - src/format/document.ts#parseDocument
  - src/format/schema.ts#SchemaSet
  - src/format/schema.ts#schemaVersion
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
relations:
  tests: []
  decisions: [DEC-020]
uncertainties: []
---

# VAL-001 · Conformance with the format JSON Schema

## Rule
Each document is validated with the schema of its own supported version (1.1 or 1.0; spec §10.1, §11), so a 1.1 key in a 1.0 document is `SCHEMA_VIOLATION`.
Allowed collections, field types, required fields (`id`; `name`/`visibility` on named elements), enumerations (visibility, association kind and direction, parameter direction, message kind, fragment operator) and `null` only where the spec allows it (unknown value).

## Applies to
ENT-001, ENT-002, ENT-003, ENT-004, ENT-005.

## Message / error code
Severity error; stable code with JSON Pointer (REQ-012).

## Examples

| Input | Result |
|-------|--------|
| Class without `name` | error |
| `visibility: friend` | error |

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Exact grammar and codes: format spec (API-004, §10).
