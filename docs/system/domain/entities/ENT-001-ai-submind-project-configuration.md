---
id: ENT-001
type: entity
name: "ai-submind project configuration"
status: active
evidence: declared-doc
summary: "Manifest knowledge/ai-submind.json with format version and project configuration."
aliases: ["ai-submind.json", "manifest"]
tags: [format, data]
implementation: none
code: []
test_code: []
relations:
  related: []
  validations: [VAL-001, VAL-004, VAL-006]
  decisions: []
uncertainties: []
---

# ENT-001 · ai-submind project configuration

## Description
Root document of `knowledge/`; its presence indicates an initialized directory (REQ-002).

## Properties

| Property | Type | Required | Constraints |
|----------|------|----------|-------------|
| format_version | text `MAJOR.MINOR` | yes | VAL-004 |
| name | text | no |  |
| documentation | Markdown text | no |  |

## Invariants
Unique per `knowledge/`.

## Persistence
`knowledge/ai-submind.json`, canonical serialization.

## Lifecycle
Created by `ai-submind init`; never overwritten on re-initialization.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Indicative properties; the exact definition is the spec and the JSON Schema (API-004).
