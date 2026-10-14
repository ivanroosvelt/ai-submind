---
id: NFR-008
type: quality-attribute
name: "Modularidad"
status: active
evidence: declared-doc
summary: "Módulos propios con interfaces explícitas y sin ciclos; MCP y UI comparten el núcleo."
aliases: ["modular", "arquitectura"]
tags: [arquitectura]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Paquete único vs monorepo con workspaces (DEC-001)."
---

# NFR-008 · Modularidad

## Requisito
Módulos desacoplados por interfaces (DEC-001): núcleo de formato, motor, consultas, búsqueda, MCP, servidor HTTP, UI, CLI. Sin dependencias cíclicas; MCP y UI usan el mismo motor.

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Ciclos entre módulos | 0 | análisis de dependencias (herramienta por decidir en S3) |

## Alcance
Todo el código del producto.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
