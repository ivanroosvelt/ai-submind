---
id: REQ-038
type: requirement
name: "Búsqueda léxica"
status: active
evidence: declared-doc
summary: "ACT-002 puede buscar elementos por texto libre con ranking léxico"
aliases: ["bm25", "texto libre", "minisearch"]
tags: [consultas]
relations:
  actors: [ACT-002]
  features: [FEAT-004]
  constraints: [NFR-002]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-038 · Búsqueda léxica

## Enunciado

ACT-002 puede buscar elementos por texto libre con ranking léxico.

## Fuente

Usuario [A]; DEC-007. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Resultados ordenados por relevancia, deterministas ante empate.
2. Funciona offline y sin dependencias opcionales.
3. Índice derivado reconstruible, fuera de git si se persiste.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
