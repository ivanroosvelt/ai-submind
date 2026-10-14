---
id: REQ-024
type: requirement
name: "Eliminar elemento"
status: active
evidence: declared-doc
summary: "ACT-002 puede eliminar un elemento"
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

# REQ-024 · Eliminar elemento

## Enunciado

ACT-002 puede eliminar un elemento.

## Fuente

Usuario [U]. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un elemento referenciado, cuando se elimina sin `cascade`, entonces error `REFERENCED` con la lista de referencias.
2. Con `cascade: true`, se limpian las referencias (modelo, diagramas, layout) y la respuesta lista lo afectado.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
