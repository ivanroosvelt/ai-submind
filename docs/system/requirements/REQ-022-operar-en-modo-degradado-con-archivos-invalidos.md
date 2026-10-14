---
id: REQ-022
type: requirement
name: "Operar en modo degradado con archivos inválidos"
status: active
evidence: declared-doc
summary: "ai-submind debe seguir operando con los archivos válidos y bloquear escrituras sobre los inválidos"
aliases: ["degraded"]
tags: [motor]
relations:
  actors: [ACT-002]
  features: [FEAT-002]
  constraints: [VAL-006]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-022 · Operar en modo degradado con archivos inválidos

## Enunciado

ai-submind debe seguir operando con los archivos válidos y bloquear escrituras sobre los inválidos.

## Fuente

Supuesto del analista. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un archivo con JSON mal formado o marcadores de conflicto, cuando ACT-002 intenta modificar un elemento que vive en él, entonces error `DOCUMENT_INVALID` con detalle.
2. Las consultas indican que hay documentos excluidos.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
