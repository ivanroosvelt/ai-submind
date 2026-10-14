---
id: FEAT-006
type: feature
name: "Administración del conocimiento vía MCP"
status: active
evidence: declared-doc
summary: "Tools MCP para crear, modificar, eliminar y renombrar modelos, elementos y diagramas, en lotes atómicos."
aliases: ["administracion", "crud", "mcp"]
tags: [mcp]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-002, ENT-003, ENT-004]
  functions: []
  interfaces: [API-001]
  integrations: []
  depends_on: [FEAT-001, FEAT-002]
  decisions: []
uncertainties: []
---

# FEAT-006 · Administración del conocimiento vía MCP

## Descripción
Tools de administración del servidor MCP (API-001) sobre el motor; únicas vías de cambio del modelo (DEC-006). PLAN-002 S8.

## Comportamiento
REQ-021, REQ-023..027, REQ-039 (REQ-027 propuesta).

## Estados y transiciones
Sin estados propios.

## Dependencias
FEAT-002, FEAT-004 (mismo servidor MCP), FEAT-001 (daemon).

## Riesgos
Borrados en cascada; colisiones de ids generados.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
