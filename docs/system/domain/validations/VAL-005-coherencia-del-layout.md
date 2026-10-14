---
id: VAL-005
type: validation
name: "Coherencia del layout"
status: active
evidence: declared-doc
summary: "El layout referencia un diagrama existente; entradas huérfanas son aviso; números finitos."
aliases: ["layout orphan"]
tags: [validacion]
implementation: none
code: []
test_code: []
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-005 · Coherencia del layout

## Regla
`layout/<diagram-id>.json` corresponde a un diagrama existente; entradas de elementos que ya no están en el diagrama → aviso `LAYOUT_ORPHAN`; coordenadas enteras y finitas (DEC-002).

## Aplica a
ENT-005.

## Mensaje / código de error
Aviso (`LAYOUT_ORPHAN`) o error (diagrama inexistente, valores no finitos).

## Ejemplos

| Entrada | Resultado |
|---------|-----------|
| Posición de un elemento quitado del diagrama | aviso LAYOUT_ORPHAN |
| x = NaN | error |

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Gramática y códigos exactos: spec del formato (PLAN-002 S2).
