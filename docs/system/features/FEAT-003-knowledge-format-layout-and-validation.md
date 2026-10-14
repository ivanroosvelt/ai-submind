---
id: FEAT-003
type: feature
name: "Knowledge format, layout and validation"
status: active
evidence: verified-code
summary: "Own format derived from UMJ with JSON Schema 2020-12, canonical serialization, separate layout and validation."
aliases: ["format", "umj", "json schema", "spec"]
tags: [format, contracts]
implementation: partial
code:
  - src/format/index.ts
  - src/format/canonical.ts#serialize
  - src/format/knowledge.ts#validateKnowledgeDir
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
relations:
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  functions: []
  interfaces: [API-004]
  integrations: []
  depends_on: []
  decisions: [DEC-002, DEC-003, DEC-009]
uncertainties:
  - "Implemented: reading, validation (phases 1–4) and in-memory canonical serialization (PLAN-002 S4). Pending: validation before each write, atomic writes and rejection of writes on non-writable documents (REQ-011, S5), layout creation on first modification (REQ-010, S5/S9) and validation report via CLI and MCP (REQ-012, S7/S8)."
---

# FEAT-003 · Knowledge format, layout and validation

## Description
Spec in English (EDR-007) citing UMJ, versioned schemas, canonical serialization and validator (Ajv + referential pass) (DEC-002, DEC-003). Contract: API-004 (`spec/format/`), with extensions `stereotypes`, `tags`, `documentation`, `code_refs`, `external_id`. Implementation in `src/format/` (PLAN-002 S4, DEC-009): schema-driven canonical serializer (`serialize`), four-phase validation (`parseDocument`: file, version, schema with Ajv; `checkKnowledge`: references and semantic rules) and confined reading of `knowledge/` (`validateKnowledgeDir`). Tests: corpus `spec/format/examples` and rules without a static case.

## Behavior
REQ-009..013.

## States and transitions
No states of its own.

## Dependencies
None (base of the others).

## Risks
Merge conflicts due to a single model file (NFR-003).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
