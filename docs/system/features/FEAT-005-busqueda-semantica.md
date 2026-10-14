---
id: FEAT-005
type: feature
name: "Búsqueda semántica"
status: proposed
evidence: declared-doc
summary: "Búsqueda por similitud con embeddings locales opcionales. Fuera de PLAN-002 (posterior)."
aliases: ["semantica", "embeddings"]
tags: [consultas, posterior]
implementation: none
code: []
test_code: []
relations:
  entities: []
  functions: []
  interfaces: [API-001]
  integrations: []
  depends_on: [FEAT-004]
  decisions: []
uncertainties:
  - "Modelo de embeddings y forma de descarga (DEC-007)."
---

# FEAT-005 · Búsqueda semántica

## Descripción
Módulo opcional (DEC-007): proveedor de embeddings (ACT-004), vector store propio por coseno en `knowledge/.ai-submind/`, invalidado por hash. Fuera de PLAN-002.

## Comportamiento
REQ-020.

## Estados y transiciones
Índice: `absent` → `building` → `ready` → `stale` → `building`.

## Dependencias
FEAT-004.

## Riesgos
Peso de dependencias (onnxruntime ~301 MB) para `npx`.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
