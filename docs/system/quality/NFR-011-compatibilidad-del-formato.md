---
id: NFR-011
type: quality-attribute
name: "Compatibilidad del formato"
status: proposed
evidence: inferred
summary: "Versionado semántico del formato y migración explícita, nunca reescritura silenciosa de versión."
aliases: ["versionado", "migracion"]
tags: [datos, migraciones]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Política de migración y P14 (versión más nueva que el binario: solo lectura o exclusión)."
---

# NFR-011 · Compatibilidad del formato

## Requisito
El formato está versionado (DEC-002). Propuesta: versionado semántico; versiones anteriores soportadas se leen y se migran solo con operación explícita; nunca se reescribe la versión en silencio.

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Reescrituras silenciosas de versión | 0 | pruebas S4 |

## Alcance
Archivos de `knowledge/`.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
