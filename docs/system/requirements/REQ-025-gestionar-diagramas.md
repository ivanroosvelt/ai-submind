---
id: REQ-025
type: requirement
name: "Gestionar diagramas"
status: active
evidence: declared-doc
summary: "ACT-002 puede crear, renombrar y eliminar diagramas y añadir o quitar referencias a elementos"
aliases: []
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: [VAL-003]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-025 · Gestionar diagramas

## Enunciado

ACT-002 puede crear, renombrar y eliminar diagramas y añadir o quitar referencias a elementos.

## Fuente

Usuario [U]. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un elemento de tipo no admitido por el `kind` del diagrama, cuando se añade, entonces error de VAL-003.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
