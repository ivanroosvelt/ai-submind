---
id: VAL-001
type: validation
name: "Conformidad con el JSON Schema del formato"
status: active
evidence: declared-doc
summary: "Todo documento de knowledge/ cumple el JSON Schema 2020-12 de su versión."
aliases: ["json schema", "esquema"]
tags: [validacion]
implementation: none
code: []
test_code: []
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-001 · Conformidad con el JSON Schema del formato

## Regla
Colecciones permitidas, tipos de campos, campos obligatorios (`id`; `name`/`visibility` en elementos con nombre), enumeraciones (visibilidad, tipo y dirección de asociación, dirección de parámetro, tipo de mensaje, operador de fragmento) y `null` solo donde la spec lo admite (valor desconocido).

## Aplica a
ENT-001, ENT-002, ENT-003, ENT-004, ENT-005.

## Mensaje / código de error
Severidad error; código estable con JSON Pointer (REQ-012).

## Ejemplos

| Entrada | Resultado |
|---------|-----------|
| Clase sin `name` | error |
| `visibility: friend` | error |

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Gramática y códigos exactos: spec del formato (API-004, §10).
