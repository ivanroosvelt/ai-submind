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
  - "Herramienta de detección de ciclos entre módulos: se fija en PLAN-002 S4, cuando exista más de un módulo (paquete único por DEC-008)."
---

# NFR-008 · Modularidad

## Requisito
Módulos desacoplados por interfaces dentro de un paquete único (DEC-001, DEC-008), en `src/<módulo>/`: núcleo de formato, motor, consultas, búsqueda, MCP, servidor HTTP, UI, CLI. Sin dependencias cíclicas; MCP y UI usan el mismo motor.

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Ciclos entre módulos | 0 | análisis de dependencias (herramienta por decidir en PLAN-002 S4) |

## Alcance
Todo el código del producto.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
