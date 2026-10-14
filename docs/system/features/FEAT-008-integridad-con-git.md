---
id: FEAT-008
type: feature
name: "Integridad con Git"
status: active
evidence: declared-doc
summary: "Detección de conflictos de merge, IDs duplicados y referencias rotas, expuesta en CLI, MCP y UI."
aliases: ["git", "merge", "conflictos"]
tags: [integridad]
implementation: none
code: []
test_code: []
relations:
  entities: []
  functions: []
  interfaces: []
  integrations: []
  depends_on: [FEAT-002, FEAT-003]
  decisions: []
uncertainties:
  - "Reparación asistida de ids duplicados: posterior."
---

# FEAT-008 · Integridad con Git

## Descripción
Diagnóstico post-merge sin reparación silenciosa; `init` añade `.ai-submind/` a `.gitignore`. PLAN-002 S10.

## Comportamiento
REQ-034..036.

## Estados y transiciones
Ver estados de documento en FEAT-002.

## Dependencias
FEAT-002, FEAT-003.

## Riesgos
Más conflictos por archivo de modelo único (DEC-002).

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
