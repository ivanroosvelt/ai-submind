---
id: NFR-005
type: quality-attribute
name: "Concurrencia de escritura"
status: active
evidence: declared-doc
summary: "Un solo escritor por proyecto y control optimista por revisión; nunca se pierden cambios ajenos."
aliases: ["lock", "revision", "concurrencia"]
tags: [datos, integridad]
relations:
  tests: []
  decisions: []
uncertainties: []
---

# NFR-005 · Concurrencia de escritura

## Requisito
Un daemon por proyecto (lockfile, DEC-005) es el único escritor; escrituras serializadas en proceso; control optimista por hash de revisión por documento (DEC-004); cambios externos concurrentes producen `REVISION_CONFLICT`, nunca sobrescritura silenciosa.

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Arranques concurrentes | un único daemon | prueba S7 |
| Escritura con revisión obsoleta | REVISION_CONFLICT | prueba S5 |

## Alcance
Motor (FEAT-002), MCP y UI.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
