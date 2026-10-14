---
id: REQ-039
type: requirement
name: "Renombrar id con reescritura de referencias"
status: active
evidence: declared-doc
summary: "ACT-002 puede renombrar el id de un elemento y el motor reescribe atómicamente todas sus referencias"
aliases: ["rename"]
tags: [mcp, integridad]
relations:
  actors: [ACT-002]
  features: [FEAT-006, FEAT-002]
  constraints: [VAL-002, VAL-003]
  depends_on: [REQ-026]
  decisions: []
uncertainties: []
---

# REQ-039 · Renombrar id con reescritura de referencias

## Enunciado

ACT-002 puede renombrar el id de un elemento y el motor reescribe atómicamente todas sus referencias.

## Fuente

Usuario (2026-10-14); DEC-003. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un rename, entonces se actualizan referencias en modelos, diagramas y layout en una sola transacción.
2. Dado un id destino ya existente, entonces se rechaza sin escribir.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
