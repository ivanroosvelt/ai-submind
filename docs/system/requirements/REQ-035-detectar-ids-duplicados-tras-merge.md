---
id: REQ-035
type: requirement
name: "Detectar IDs duplicados tras merge"
status: active
evidence: declared-doc
summary: "ai-submind debe reportar cada id duplicado con sus ubicaciones"
aliases: []
tags: [integridad]
relations:
  actors: [ACT-003]
  features: [FEAT-008]
  constraints: [VAL-002]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-035 · Detectar IDs duplicados tras merge

## Enunciado

ai-submind debe reportar cada id duplicado con sus ubicaciones.

## Fuente

Usuario [U]; DEC-003. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Las consultas por ese id devuelven `AMBIGUOUS_ID`; las escrituras que lo afecten se bloquean.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

Reparación asistida (reasignar id y referencias): posterior; REQ-039 sirve de base.
