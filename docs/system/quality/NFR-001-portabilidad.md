---
id: NFR-001
type: quality-attribute
name: "Portabilidad"
status: active
evidence: declared-doc
summary: "Funciona en Linux, macOS y Windows con Node ≥22 solo con npx, sin Docker ni compilación nativa."
aliases: ["portable", "npx", "multiplataforma"]
tags: [calidad]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Matriz de CI por sistema operativo sin definir."
---

# NFR-001 · Portabilidad

## Requisito
ai-submind se instala y ejecuta con `npx ai-submind` sobre Node ≥22 (DEC-001) sin Docker, sin servicios externos y sin compilación nativa en la instalación del núcleo.

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| SO soportados | Linux, macOS, Windows | e2e en S12 (al menos Linux; resto por decidir) |
| Dependencias nativas del núcleo | 0 | auditoría de dependencias en S12 |

## Alcance
Todo el producto salvo el módulo opcional de embeddings (DEC-007).

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
