---
id: FEAT-003
type: feature
name: "Knowledge format, layout and validation"
status: active
evidence: verified-code
summary: "Own format derived from UMJ with JSON Schema 2020-12 (current 1.1, earlier 1.0 supported), canonical serialization, separate layout, validation and explicit migrate 1.0 → 1.1."
aliases: ["format", "umj", "json schema", "spec"]
tags: [format, contracts]
implementation: verified
code:
  - src/format/index.ts
  - src/format/canonical.ts#serialize
  - src/format/knowledge.ts#validateKnowledgeDir
  - src/format/schema.ts#schemaVersion
  - src/engine/engine.ts#Engine
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
  - test/engine/engine.test.ts
relations:
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  functions: []
  interfaces: [API-004]
  integrations: []
  depends_on: []
  decisions: [DEC-002, DEC-003, DEC-009, DEC-010, DEC-020]
uncertainties: []
---

# FEAT-003 · Knowledge format, layout and validation

## Description
Spec in English (EDR-007) citing UMJ, versioned schemas, canonical serialization and validator (Ajv + referential pass) (DEC-002, DEC-003). Contract: API-004 (`spec/format/`), with extensions `stereotypes`, `tags`, `documentation`, `code_refs`, `external_id`. Implementation in `src/format/` (PLAN-002 S4, DEC-009): schema-driven canonical serializer (`serialize`), four-phase validation (`parseDocument`: file, version, schema with Ajv; `checkKnowledge`: references and semantic rules) and confined reading of `knowledge/` (`validateKnowledgeDir`). Writes go through the engine (FEAT-002), which validates before writing and rejects non-writable documents; layout files are written only when the UI saves a moved diagram or an agent calls `auto_layout_diagram` (REQ-010, API-002, API-001); the validation report is exposed by `ai-submind validate` (API-003) and the MCP `validate` tool (API-001) (REQ-012). Tests: corpus `spec/format/examples` and rules without a static case.

## Behavior
REQ-009..013.

## States and transitions
No states of its own.

## Dependencies
None (base of the others).

## Risks
Merge conflicts due to a single model file (NFR-003).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
