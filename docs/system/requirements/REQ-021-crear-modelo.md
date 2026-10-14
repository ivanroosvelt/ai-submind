---
id: REQ-021
type: requirement
name: "Crear modelo"
status: active
evidence: declared-doc
summary: "ACT-002 puede crear un modelo vacío con nombre"
aliases: []
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: [VAL-002]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-021 · Crear modelo

## Enunciado

ACT-002 puede crear un modelo vacío con nombre.

## Fuente

Usuario [U]; DEC-002. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un nombre, cuando se crea, entonces se escribe `knowledge/models/<model-id>.json` canónico con id legible único.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
