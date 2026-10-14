---
id: FEAT-004
type: feature
name: "Consultas estructuradas y búsqueda léxica"
status: active
evidence: declared-doc
summary: "Consultas deterministas sobre el grafo (listar, obtener, buscar, relaciones, impacto) y búsqueda léxica."
aliases: ["consultas", "query", "busqueda"]
tags: [consultas]
implementation: none
code: []
test_code: []
relations:
  entities: []
  functions: []
  interfaces: [API-001]
  integrations: []
  depends_on: [FEAT-002]
  decisions: []
uncertainties:
  - "Motor léxico: BM25 propio o minisearch (DEC-007)."
---

# FEAT-004 · Consultas estructuradas y búsqueda léxica

## Descripción
Consultas de solo lectura sobre el motor (DEC-004) y búsqueda léxica de texto libre (DEC-007), expuestas por MCP. PLAN-002 S6.

## Comportamiento
REQ-014..018, REQ-038 (REQ-019 propuesta).

## Estados y transiciones
Sin estados propios; resultados en orden estable, sin efectos en disco.

## Dependencias
FEAT-002.

## Riesgos
Ciclos en impacto (terminación garantizada).

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
