---
id: REQ-010
type: requirement
name: "Layout separado del modelo"
status: active
evidence: declared-doc
summary: "ai-submind debe guardar el layout de cada diagrama en un archivo propio como extensión del formato"
aliases: ["layout"]
tags: [formato, ui]
relations:
  actors: []
  features: [FEAT-003]
  constraints: [VAL-005, NFR-003]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-010 · Layout separado del modelo

## Enunciado

ai-submind debe guardar el layout de cada diagrama en un archivo propio como extensión del formato.

## Fuente

Usuario [U]; paper UMJ; DEC-002. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un diagrama sin layout, cuando se abre, entonces se muestra con layout automático y no se escribe nada hasta que el usuario mueva algo.
2. Dado un elemento movido, cuando se guarda, entonces solo cambia `knowledge/layout/<diagram-id>.json`.
3. Dada una entrada de layout de un elemento ausente del diagrama, cuando se valida, entonces aviso `LAYOUT_ORPHAN`.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
