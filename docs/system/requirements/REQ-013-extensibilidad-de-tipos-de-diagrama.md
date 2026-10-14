---
id: REQ-013
type: requirement
name: "Extensibilidad de tipos de diagrama"
status: active
evidence: declared-doc
summary: "El formato debe permitir añadir tipos de diagrama y de elemento sin romper documentos existentes"
aliases: ["kind", "extension"]
tags: [formato]
relations:
  actors: []
  features: [FEAT-003]
  constraints: [NFR-011]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-013 · Extensibilidad de tipos de diagrama

## Enunciado

El formato debe permitir añadir tipos de diagrama y de elemento sin romper documentos existentes.

## Fuente

Usuario [U]; DEC-002. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un documento de versión N, cuando se añade un tipo nuevo en una versión menor N+1, entonces sigue validando.
2. Todo diagrama declara su `kind` y el registro de tipos admitidos.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

Nuevos tipos de diagrama concretos: plan posterior. En PLAN-002 solo el diseño extensible.
