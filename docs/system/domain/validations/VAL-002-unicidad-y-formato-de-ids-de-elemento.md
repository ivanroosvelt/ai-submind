---
id: VAL-002
type: validation
name: "Unicidad y formato de IDs de elemento"
status: active
evidence: declared-doc
summary: "Cada id es legible, no vacío, conforme a la gramática y único en todo knowledge/."
aliases: ["id duplicado", "unicidad"]
tags: [validacion]
implementation: none
code: []
test_code: []
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-002 · Unicidad y formato de IDs de elemento

## Regla
IDs legibles con ámbito (p. ej. `Car`, `Car.start()`) conformes a la gramática de la spec §3.1 (ID de archivo para modelos y diagramas, ID de elemento para el resto), únicos globalmente en `knowledge/` (DEC-003); colisiones al generar se resuelven con sufijo determinista; un id duplicado en disco (p. ej. tras merge) es error.

## Aplica a
ENT-003, ENT-004 y todo elemento con `id`.

## Mensaje / código de error
Severidad error; consultas sobre un id duplicado devuelven `AMBIGUOUS_ID`.

## Ejemplos

| Entrada | Resultado |
|---------|-----------|
| Dos elementos `Car` en modelos distintos | error, ambos reportados |
| id vacío | error |

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Gramática y códigos exactos: spec del formato (API-004, §10).
