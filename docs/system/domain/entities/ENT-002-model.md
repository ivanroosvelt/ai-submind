---
id: ENT-002
type: entity
name: "Model"
status: active
evidence: verified-code
summary: "A UML model with its elements, relationships and diagrams, stored in a single file."
aliases: ["models"]
tags: [format, data]
implementation: verified
code:
  - src/format/types.ts#Model
  - spec/format/schema/1.0/model.schema.json
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
relations:
  related: [ENT-003, ENT-004]
  validations: [VAL-001, VAL-002, VAL-003, VAL-006, VAL-007]
  decisions: []
uncertainties: []
---

# ENT-002 · Model

## Description
Root of an element tree; owner of all relationships (associations, generalizations, dependencies, realizations) and of its diagrams as sets of references (DEC-002).

## Properties

| Property | Type | Required | Constraints |
|----------|------|----------|-------------|
| format_version | text `MAJOR.MINOR` | yes | VAL-004 |
| id | file ID | yes | VAL-002; equal to the file name |
| name | text | yes |  |
| elements/relationships/diagrams | collections | no | VAL-001, VAL-007 |

## Invariants
See VAL-003, VAL-007.

## Persistence
`knowledge/models/<model-id>.json` (one file per model, not fragmented).

## Lifecycle
Created and modified via MCP (REQ-021, REQ-023) or edited by hand and revalidated.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Indicative properties; the exact definition is the spec and the JSON Schema (API-004).
