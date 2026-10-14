---
id: FEAT-003
type: feature
name: "Formato de conocimiento, layout y validación"
status: active
evidence: declared-doc
summary: "Formato propio derivado de UMJ con JSON Schema 2020-12, serialización canónica, layout separado y validación."
aliases: ["formato", "umj", "json schema", "spec"]
tags: [formato, contratos]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  functions: []
  interfaces: []
  integrations: []
  depends_on: []
  decisions: []
uncertainties:
  - "P15: extensiones más allá del layout (documentación, etiquetas, enlaces a código)."
  - "P18: ubicación de la spec en el repo y en el paquete."
---

# FEAT-003 · Formato de conocimiento, layout y validación

## Descripción
Spec en español con cita a UMJ, schemas versionados, serialización canónica y validador (Ajv + pasada referencial) (DEC-002, DEC-003). PLAN-002 S2 y S4.

## Comportamiento
REQ-009..013.

## Estados y transiciones
Sin estados propios.

## Dependencias
Ninguna (base de las demás).

## Riesgos
Conflictos de merge por archivo de modelo único (NFR-003).

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
