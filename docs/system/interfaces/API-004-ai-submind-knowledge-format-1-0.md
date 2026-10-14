---
id: API-004
type: interface
name: "ai-submind knowledge format 1.0"
status: active
evidence: verified-code
summary: "Contract for knowledge/ files: spec spec/format/README.md and JSON Schema 2020-12 in spec/format/schema/1.0/."
aliases: ["format 1.0", "json schema", "format spec", "format_version", "umj"]
tags: [format, contracts, data]
implementation: partial
code:
  - src/format/index.ts
  - src/format/knowledge.ts#validateKnowledgeDir
  - src/format/canonical.ts#serialize
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
relations:
  providers: []
  consumers: [ACT-001, ACT-002, FEAT-002, FEAT-007]
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  validations: [VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, VAL-006, VAL-007]
  tests: []
  decisions: [DEC-002, DEC-003]
uncertainties:
  - "Operation «read / validate» implemented (PLAN-002 S4); «write document» and the rejection of writes on non-writable documents arrive with the engine (PLAN-002 S5)."
  - "Extensions outside v1.0 (association qualifiers, OCL constraints, new diagram types) will be added as minor or major versions."
---

# API-004 · ai-submind knowledge format 1.0

## Contract
Canonical source: [`spec/format/README.md`](../../../spec/format/README.md) (semantics) and
[`spec/format/schema/1.0/`](../../../spec/format/schema/1.0/) (structure and key order:
`defs`, `ai-submind`, `model`, `layout`). Corpus of valid, invalid and canonical examples in
[`spec/format/examples/`](../../../spec/format/examples/README.md). This card only links; it does not repeat rules.

Summary: manifest `knowledge/ai-submind.json`, one file per model, one layout per diagram; readable
IDs in a global namespace (file ID for models and diagrams, element ID for the rest);
`{"idref": ...}` references across models without additional syntax; extensions `stereotypes`, `tags`,
`documentation`, `code_refs`, `external_id`; canonical serialization; stable validation codes.

## Operations

| Operation | Input | Output | Errors |
|-----------|-------|--------|--------|
| read / validate `knowledge/` | files | loaded documents + report `{code, severity, file, pointer, message}` | codes from spec §10.4 |
| write document | valid document | file in canonical form (§9) | write rejected if `conflicted`, `invalid_parse` or unsupported version |

## Authentication and permissions
Not applicable: files of the host Git repository; access is controlled by the file system and Git.

## Versioning and compatibility
Versioning rules: spec §11 (NFR-011).
