---
id: REQ-040
type: requirement
name: "Explorar y ajustar layout de diagramas de secuencia"
status: active
evidence: declared-doc
summary: "ACT-001 puede ver diagramas de secuencia renderizados y ajustar su layout (etapa madura S11 de PLAN-002)"
aliases: ["secuencia", "sequence"]
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-009]
  constraints: [VAL-005, VAL-007]
  depends_on: [REQ-028, REQ-029]
  decisions: []
uncertainties: []
---

# REQ-040 · Explorar y ajustar layout de diagramas de secuencia

## Enunciado

ACT-001 puede ver diagramas de secuencia renderizados y ajustar su layout (etapa madura S11 de PLAN-002).

## Fuente

Usuario (2026-10-14, render de secuencia en PLAN-002 S11); DEC-006. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Render de lifelines, activaciones, mensajes (síncrono, asíncrono, respuesta, creación, destrucción), fragmentos combinados con operandos y guardas e interaction use.
2. Orden de eventos = orden del array del modelo; reordenar lifelines persiste layout canónico.
3. Navegación clase ↔ lifeline.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
