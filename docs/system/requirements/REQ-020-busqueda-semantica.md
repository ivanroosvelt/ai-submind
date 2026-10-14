---
id: REQ-020
type: requirement
name: "Búsqueda semántica"
status: proposed
evidence: declared-doc
summary: "ACT-002 puede buscar por texto libre y recibir elementos ordenados por similitud con puntuación. Fuera de PLAN-002"
aliases: ["embeddings", "semantica"]
tags: [consultas, posterior]
relations:
  actors: [ACT-002, ACT-004]
  features: [FEAT-005]
  constraints: [NFR-002]
  depends_on: [REQ-038]
  decisions: []
uncertainties:
  - "Modelo de embeddings y descarga (DEC-007)."
---

# REQ-020 · Búsqueda semántica

## Enunciado

ACT-002 puede buscar por texto libre y recibir elementos ordenados por similitud con puntuación. Fuera de PLAN-002.

## Fuente

Usuario [A]; DEC-007. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado el índice desactualizado, cuando se consulta, entonces indica `stale` o reindexa incrementalmente antes.
2. Dado el proveedor no disponible, entonces error `SEMANTIC_UNAVAILABLE` y el resto de tools siguen operativas.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

Todo el requerimiento queda fuera de PLAN-002 (plan posterior, DEC-007).
