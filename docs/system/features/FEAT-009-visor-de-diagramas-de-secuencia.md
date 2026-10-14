---
id: FEAT-009
type: feature
name: "Visor de diagramas de secuencia"
status: active
evidence: declared-doc
summary: "Render y ajuste de layout de diagramas de secuencia en la UI (etapa madura S11 de PLAN-002)."
aliases: ["secuencia", "sequence diagram", "lifeline"]
tags: [ui]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-004, ENT-005]
  functions: []
  interfaces: [API-002]
  integrations: []
  depends_on: [FEAT-007, FEAT-008]
  decisions: []
uncertainties: []
---

# FEAT-009 · Visor de diagramas de secuencia

## Descripción
Shapes propias de lifeline, activación, mensajes, fragmentos combinados e interaction use; layout de secuencia propio; navegación clase ↔ lifeline (DEC-006). PLAN-002 S11, tras S9 y S10.

## Comportamiento
REQ-040.

## Estados y transiciones
Sin estados propios.

## Dependencias
FEAT-007, FEAT-008.

## Riesgos
Complejidad de fragmentos anidados.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
