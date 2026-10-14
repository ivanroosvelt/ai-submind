---
id: ENT-005
type: entity
name: "Layout de diagrama"
status: active
evidence: declared-doc
summary: "Posiciones, tamaños, vértices de enlaces y estilo de un diagrama, separado del modelo."
aliases: ["layout", "posiciones"]
tags: [formato, datos]
implementation: none
code: []
test_code: []
relations:
  related: [ENT-004]
  validations: [VAL-001, VAL-005, VAL-006]
  decisions: []
uncertainties: []
---

# ENT-005 · Layout de diagrama

## Descripción
Extensión propia del formato (UMJ no define layout). En secuencia: posición horizontal de lifelines y alturas; el orden de eventos lo da el modelo.

## Propiedades

| Propiedad | Tipo | Obligatoria | Restricciones |
|-----------|------|-------------|---------------|
| diagram | idref | sí | VAL-005 |
| nodos | mapa id→posición/tamaño | no | enteros finitos |
| enlaces | mapa id→vértices | no |  |
| estilo | objeto | no | opcional |

## Invariantes
Ver VAL-005.

## Persistencia
`knowledge/layout/<diagram-id>.json`.

## Ciclo de vida
Se crea al mover algo en la UI (no antes, REQ-010); rename de ids lo actualiza (REQ-039).

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Propiedades indicativas; la definición exacta es la spec y el JSON Schema (API-004).
