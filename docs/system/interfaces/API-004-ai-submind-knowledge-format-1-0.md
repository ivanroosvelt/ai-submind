---
id: API-004
type: interface
name: "ai-submind knowledge format 1.1 (1.0 supported)"
status: active
evidence: verified-code
summary: "Contract for knowledge/ files: spec spec/format/README.md, JSON Schema 2020-12 in spec/format/schema/1.1/ (current) and 1.0/ (earlier supported), migration guides in spec/format/migrations/."
aliases: ["format 1.0", "format 1.1", "json schema", "format spec", "format_version", "umj"]
tags: [format, contracts, data]
implementation: verified
code:
  - src/format/index.ts
  - src/format/knowledge.ts#validateKnowledgeDir
  - src/format/canonical.ts#serialize
  - src/engine/engine.ts#Engine
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
  - test/engine/engine.test.ts
  - test/daemon/cli.test.ts
relations:
  providers: []
  consumers: [ACT-001, ACT-002, FEAT-002, FEAT-007]
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  validations: [VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, VAL-006, VAL-007]
  tests: []
  decisions: [DEC-002, DEC-003, DEC-010, DEC-020]
uncertainties:
  - "Extensions beyond 1.1 (association qualifiers, OCL constraints, new diagram types) will be added as minor or major versions."
---

# API-004 · ai-submind knowledge format 1.1 (1.0 supported)

## Contract
Canonical source: [`spec/format/README.md`](../../../spec/format/README.md) (semantics) and
[`spec/format/schema/1.1/`](../../../spec/format/schema/1.1/) (structure and key order:
`defs`, `ai-submind`, `model`, `layout`; the earlier supported version keeps
[`spec/format/schema/1.0/`](../../../spec/format/schema/1.0/)). Migration guides with a tested before/after corpus in
[`spec/format/migrations/`](../../../spec/format/migrations/1.0-to-1.1/README.md) (DEC-010, DEC-020). Corpus of valid, invalid and canonical examples in
[`spec/format/examples/`](../../../spec/format/examples/README.md). This card only links; it does not repeat rules.

Summary: manifest `knowledge/ai-submind.json`, one file per model, one layout per diagram; readable
IDs in a global namespace (file ID for models and diagrams, element ID for the rest);
`{"idref": ...}` references across models without additional syntax; extensions `stereotypes`, `tags`,
`documentation`, `code_refs`, `external_id` and (1.1) `links`; operation `behavior` (1.1); canonical serialization;
stable validation codes.

## Operations

| Operation | Input | Output | Errors |
|-----------|-------|--------|--------|
| read / validate `knowledge/` | files | loaded documents + report `{code, severity, file, pointer, message}` | codes from spec §10.4 |
| write document | valid document | file in canonical form (§9), keeping its `format_version` | write rejected if `conflicted`, `invalid_parse` or unsupported version; `MIGRATION_REQUIRED` for 1.1 keys on a 1.0 document or a version change |
| migrate 1.0 → 1.1 | `dryRun?` | every 1.0 document rewritten as 1.1 in one transaction; `migrated` paths | `MIGRATE_BLOCKED` while a 1.0 document does not load |

## Authentication and permissions
Not applicable: files of the host Git repository; access is controlled by the file system and Git.

## Versioning and compatibility
Versioning rules: spec §11 (NFR-011).
