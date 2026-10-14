---
id: FEAT-007
type: feature
name: "Visor web JointJS de diagramas de clases"
status: active
evidence: declared-doc
summary: "UI local con @joint/core para explorar diagramas de clases y ajustar y persistir su layout."
aliases: ["ui", "visor", "jointjs"]
tags: [ui]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-004, ENT-005]
  functions: []
  interfaces: [API-002]
  integrations: []
  depends_on: [FEAT-001, FEAT-002]
  decisions: []
uncertainties:
  - "Framework de la UI: vanilla TS o librería ligera (DEC-006)."
---

# FEAT-007 · Visor web JointJS de diagramas de clases

## Descripción
UI con `@joint/core` y shapes UML propias, auto-layout dagre, zoom/pan, selección, detalle, navegación, refresco en vivo; solo escribe layout (DEC-006). PLAN-002 S9.

## Comportamiento
REQ-028..033.

## Estados y transiciones
Sin estados propios de UI más allá de selección y vista.

## Dependencias
FEAT-001 (daemon sirve la UI), FEAT-002.

## Riesgos
Esfuerzo propio en shapes y herramientas (sin JointJS+).

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
