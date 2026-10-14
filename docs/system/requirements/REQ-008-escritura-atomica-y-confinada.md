---
id: REQ-008
type: requirement
name: "Escritura atómica y confinada"
status: active
evidence: declared-doc
summary: "Toda escritura de ai-submind debe ser atómica y confinada a `knowledge/`"
aliases: ["atomico"]
tags: [seguridad, datos]
relations:
  actors: []
  features: [FEAT-002]
  constraints: [NFR-006]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-008 · Escritura atómica y confinada

## Enunciado

Toda escritura de ai-submind debe ser atómica y confinada a `knowledge/`.

## Fuente

Supuesto del analista; DEC-004, DEC-005. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un proceso matado durante una escritura, cuando se reinicia, entonces cada archivo está en su versión anterior o nueva, nunca truncado.
2. Dada una ruta fuera de `knowledge/` (`..`, absoluta, symlink externo), cuando se intenta leer o escribir, entonces error `PATH_OUTSIDE_KNOWLEDGE`.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
