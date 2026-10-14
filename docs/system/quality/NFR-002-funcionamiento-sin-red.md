---
id: NFR-002
type: quality-attribute
name: "Funcionamiento sin red"
status: active
evidence: declared-doc
summary: "Todas las funciones del núcleo operan offline."
aliases: ["offline"]
tags: [calidad]
relations:
  tests: []
  decisions: []
uncertainties: []
---

# NFR-002 · Funcionamiento sin red

## Requisito
CLI, motor, consultas, búsqueda léxica, MCP y UI funcionan sin acceso a red. La búsqueda semántica puede requerir descargar un modelo una vez (DEC-007).

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Llamadas de red del núcleo | 0 | prueba con red deshabilitada (S12) |

## Alcance
Núcleo completo; excluye la descarga del modelo de embeddings.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
