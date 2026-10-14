---
id: NFR-007
type: quality-attribute
name: "Rendimiento"
status: proposed
evidence: inferred
summary: "Objetivos de tiempo con ~10k elementos por proyecto (supuesto no confirmado)."
aliases: ["performance", "escala"]
tags: [calidad]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Umbrales y escala no confirmados por el usuario."
  - "CAP-015 (rendimiento) diferida en el entorno."
---

# NFR-007 · Rendimiento

## Requisito
Escala objetivo inferida: ~10 000 elementos por proyecto y ~300 por diagrama (DEC-004 cita ~10k). Umbrales propuestos por el analista.

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Arranque e indexado (10k elementos) | ≤3 s | benchmark |
| Consulta estructurada p95 | ≤200 ms | benchmark |
| Render de diagrama de 300 elementos | ≤2 s | navegador |
| Reindexado por cambio externo | ≤2 s | prueba S5 |

## Alcance
Motor, consultas, UI.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
