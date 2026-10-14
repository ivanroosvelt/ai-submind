---
id: NFR-006
type: quality-attribute
name: "Confinamiento de rutas"
status: active
evidence: declared-doc
summary: "Ninguna lectura o escritura fuera de knowledge/; las tools no aceptan rutas arbitrarias."
aliases: ["path traversal"]
tags: [seguridad]
relations:
  tests: []
  decisions: []
uncertainties: []
---

# NFR-006 · Confinamiento de rutas

## Requisito
Normalización de rutas, rechazo de `..`, rutas absolutas y symlinks que salgan de `knowledge/` con `PATH_OUTSIDE_KNOWLEDGE`; MCP y API HTTP referencian por ID de modelo/diagrama, no por ruta.

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Intentos de path traversal | 100 % rechazados | prueba S7 |

## Alcance
Motor, MCP, API HTTP, CLI (`--knowledge` confinado a la raíz, DEC-001).

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
