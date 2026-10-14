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
uncertainties:
  - "Gramática exacta del ID (separadores, prefijo de tipo) se fija en S2 (DEC-003)."
---

# VAL-002 · Unicidad y formato de IDs de elemento

## Regla
IDs legibles con ámbito (p. ej. `Car`, `Car.start()`), únicos globalmente en `knowledge/` (DEC-003); colisiones al generar se resuelven con sufijo determinista; un id duplicado en disco (p. ej. tras merge) es error.

## Aplica a
ENT-003, ENT-004 y todo elemento con `id`.

## Mensaje / código de error
Severidad error; consultas sobre un id duplicado devuelven `AMBIGUOUS_ID`.

## Ejemplos

| Entrada | Resultado |
|---------|-----------|
| Dos elementos `Car` en modelos distintos | error, ambos reportados |
| id vacío | error |

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Gramática y códigos exactos: spec del formato (PLAN-002 S2).
