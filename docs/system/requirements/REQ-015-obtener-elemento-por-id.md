---
id: REQ-015
type: requirement
name: "Obtener elemento por id"
status: active
evidence: declared-doc
summary: "ACT-002 puede obtener un elemento con su tipo, su dueño y su archivo"
aliases: []
tags: [consultas]
relations:
  actors: [ACT-002]
  features: [FEAT-004]
  constraints: [VAL-002]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-015 · Obtener elemento por id

## Enunciado

ACT-002 puede obtener un elemento con su tipo, su dueño y su archivo.

## Fuente

Usuario [U]. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un id inexistente, entonces error `NOT_FOUND`.
2. Dado un id duplicado (VAL-002), entonces error `AMBIGUOUS_ID` con las ubicaciones.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
