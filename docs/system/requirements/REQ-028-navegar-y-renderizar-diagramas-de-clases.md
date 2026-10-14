---
id: REQ-028
type: requirement
name: "Navegar y renderizar diagramas de clases"
status: active
evidence: declared-doc
summary: "ACT-001 puede navegar modelos y diagramas y ver un diagrama de clases renderizado con JointJS"
aliases: ["jointjs", "render"]
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-007]
  constraints: [NFR-007]
  depends_on: [REQ-004]
  decisions: []
uncertainties: []
---

# REQ-028 · Navegar y renderizar diagramas de clases

## Enunciado

ACT-001 puede navegar modelos y diagramas y ver un diagrama de clases renderizado con JointJS.

## Fuente

Usuario [U][A]; DEC-006. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un diagrama sin layout guardado, entonces se aplica auto-layout (dagre).
2. Zoom, pan, selección y navegación entre diagramas.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

Diagramas de secuencia: REQ-040.
