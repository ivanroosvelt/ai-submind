---
id: NFR-003
type: quality-attribute
name: "Diff y merge amigables con Git"
status: active
evidence: declared-doc
summary: "Serialización canónica y layout separado para diffs mínimos y legibles."
aliases: ["determinista", "canonico"]
tags: [calidad, datos]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Merge driver semántico de git: plan posterior."
---

# NFR-003 · Diff y merge amigables con Git

## Requisito
Toda escritura usa la serialización canónica (REQ-005); el layout vive en archivos separados del modelo; un cambio lógico no reordena contenido ajeno. Un archivo por modelo (DEC-002) acepta más conflictos de merge, mitigados con detección post-merge (FEAT-008).

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Ida y vuelta lectura→escritura | sin diff | pruebas S4 |
| Líneas cambiadas al editar un elemento | solo las del elemento y sus referencias | pruebas S4/S5 |

## Alcance
Archivos de `knowledge/` escritos por ai-submind.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
