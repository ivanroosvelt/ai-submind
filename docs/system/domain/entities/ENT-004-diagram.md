---
id: ENT-004
type: entity
name: "Diagram"
status: active
evidence: declared-doc
summary: "View of a model with a declared type (class or sequence) made of references to elements."
aliases: ["class diagram", "sequence diagram"]
tags: [format, data]
implementation: none
code: []
test_code: []
relations:
  related: [ENT-003]
  validations: [VAL-001, VAL-002, VAL-003]
  decisions: []
uncertainties: []
---

# ENT-004 · Diagram

## Description
Set of references to model elements, without layout; `kind` declares the diagram type and the allowed element types (DEC-002).

## Properties

| Property | Type | Required | Constraints |
|----------|------|----------|-------------|
| id | file ID | yes | VAL-002; names its layout |
| name | text | yes |  |
| kind | enumeration | yes | class, sequence; extensible (REQ-013) |
| elements | list of idref | no | VAL-003 |

## Invariants
Only references elements allowed by its `kind`.

## Persistence
Inside ENT-002.

## Lifecycle
Managed via MCP (REQ-025).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Indicative properties; the exact definition is the spec and the JSON Schema (API-004).
