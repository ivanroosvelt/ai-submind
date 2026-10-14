---
id: NFR-009
type: quality-attribute
name: "Cumplimiento de licencias"
status: active
evidence: declared-doc
summary: "Dependencias con licencia compatible, clean-room para software propietario y spec UMJ reescrita y citada."
aliases: ["licencias", "clean-room", "rea"]
tags: [licencias]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Licencia propia de ai-submind sin definir (DEC-001)."
---

# NFR-009 · Cumplimiento de licencias

## Requisito
Dependencias con licencia compatible; copyleft fuerte requiere revisión; JointJS+ solo clean-room por documentación pública y comportamiento; REA solo sobre artefactos sin fuente cuando la licencia lo permita (DEC-006). La spec del formato reescribe UMJ con palabras propias y lo cita (CC BY-NC-ND 4.0, DEC-002).

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Dependencias con licencia no revisada | 0 | auditoría S12 |

## Alcance
Dependencias, UI, especificación.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
