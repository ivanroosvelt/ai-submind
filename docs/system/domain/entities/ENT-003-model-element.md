---
id: ENT-003
type: entity
name: "Model element"
status: active
evidence: declared-doc
summary: "UML element of a model (class, interface, attribute, operation, relationship, interaction, lifeline, message, etc.)."
aliases: ["element"]
tags: [format, data]
implementation: none
code: []
test_code: []
relations:
  related: []
  validations: [VAL-001, VAL-002, VAL-003, VAL-007]
  decisions: []
uncertainties: []
---

# ENT-003 · Model element

## Description
Generic concept for every element with an `id` inside a model; its type is given by the collection that contains it. Initial catalog: class diagrams and sequence diagrams (derived from UMJ).

## Properties

| Property | Type | Required | Constraints |
|----------|------|----------|-------------|
| id | readable scoped id | yes | VAL-002; stable when name changes |
| name | text | depending on type |  |
| visibility | enumeration | depending on type | VAL-001 |
| external_id | text | no | ids from imported tools (DEC-003) |

## Invariants
`null` = unknown value; it is not replaced by a default. Renaming `id` only via the engine (REQ-039).

## Persistence
Inside ENT-002.

## Lifecycle
Create/update/delete via MCP; rename rewrites references.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Indicative properties; the exact definition is the spec and the JSON Schema (API-004); the concrete UML types (class, lifeline, ...) have no ENT card of their own: their single source is the spec.
