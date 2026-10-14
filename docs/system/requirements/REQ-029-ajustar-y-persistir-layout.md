---
id: REQ-029
type: requirement
name: "Ajustar y persistir layout"
status: active
evidence: declared-doc
summary: "ACT-001 puede mover elementos y vértices de enlaces y el layout se guarda en `knowledge/layout/`"
aliases: []
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-007]
  constraints: [VAL-005, NFR-005]
  depends_on: [REQ-010, REQ-028]
  decisions: []
uncertainties:
  - "P9: si el agente MCP también puede modificar layout."
---

# REQ-029 · Ajustar y persistir layout

## Enunciado

ACT-001 puede mover elementos y vértices de enlaces y el layout se guarda en `knowledge/layout/`.

## Fuente

Usuario [A]; DEC-006. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un movimiento, cuando se suelta, entonces se persiste (con debounce) y sobrevive a recargas.
2. Dado que el diagrama cambió en disco desde que se abrió, cuando se guarda layout, entonces se rechaza con aviso y se recarga.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
