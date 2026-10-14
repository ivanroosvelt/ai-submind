---
id: VAL-006
type: validation
name: "Integridad de archivo"
status: active
evidence: declared-doc
summary: "JSON parseable, UTF-8, sin marcadores de conflicto Git y ruta dentro de knowledge/."
aliases: ["conflicto de merge", "json invalido"]
tags: [validacion]
implementation: none
code: []
test_code: []
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-006 · Integridad de archivo

## Regla
Antes de validar el esquema: archivo UTF-8, JSON parseable, sin marcadores `<<<<<<<`/`=======`/`>>>>>>>`, ruta confinada a `knowledge/`.

## Aplica a
Todo archivo de `knowledge/` salvo `.ai-submind/`.

## Mensaje / código de error
Error; estado de documento `invalid_parse` o `conflicted`, con línea/columna.

## Ejemplos

| Entrada | Resultado |
|---------|-----------|
| Archivo con marcadores de conflicto | conflicted, escrituras bloqueadas |
| JSON truncado | invalid_parse |

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Gramática y códigos exactos: spec del formato (API-004, §10).
