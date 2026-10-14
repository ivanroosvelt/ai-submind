---
id: REQ-032
type: requirement
name: "UI sin edición de modelo"
status: active
evidence: declared-doc
summary: "La UI no ofrece crear, borrar, renombrar ni reconectar elementos; la API HTTP rechaza toda escritura que no sea layout"
aliases: []
tags: [ui, seguridad]
relations:
  actors: [ACT-001]
  features: [FEAT-007]
  constraints: []
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-032 · UI sin edición de modelo

## Enunciado

La UI no ofrece crear, borrar, renombrar ni reconectar elementos; la API HTTP rechaza toda escritura que no sea layout.

## Fuente

Usuario [A]; DEC-006. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dada una petición HTTP de escritura de modelo, entonces se rechaza.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
