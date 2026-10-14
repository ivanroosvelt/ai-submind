---
id: REQ-006
type: requirement
name: "Cargar e indexar knowledge/ al arrancar"
status: active
evidence: declared-doc
summary: "ai-submind debe cargar todo `knowledge/` y construir los índices de consulta al arrancar"
aliases: ["carga", "indice"]
tags: [motor]
relations:
  actors: []
  features: [FEAT-002]
  constraints: [NFR-007, VAL-006]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-006 · Cargar e indexar knowledge/ al arrancar

## Enunciado

ai-submind debe cargar todo `knowledge/` y construir los índices de consulta al arrancar.

## Fuente

Supuesto del analista; DEC-004. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado `knowledge/` con archivos válidos e inválidos, cuando arranca, entonces carga los válidos, marca los inválidos (REQ-022) y queda en estado `degraded` sin abortar.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
