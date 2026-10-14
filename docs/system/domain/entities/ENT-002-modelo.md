---
id: ENT-002
type: entity
name: "Modelo"
status: active
evidence: declared-doc
summary: "Un modelo UML con sus elementos, relaciones y diagramas, guardado en un único archivo."
aliases: ["model", "models"]
tags: [formato, datos]
implementation: none
code: []
test_code: []
relations:
  related: [ENT-003, ENT-004]
  validations: [VAL-001, VAL-002, VAL-003, VAL-006, VAL-007]
  decisions: []
uncertainties: []
---

# ENT-002 · Modelo

## Descripción
Raíz de un árbol de elementos; dueño de todas las relaciones (asociaciones, generalizaciones, dependencias, realizaciones) y de sus diagramas como conjuntos de referencias (DEC-002).

## Propiedades

| Propiedad | Tipo | Obligatoria | Restricciones |
|-----------|------|-------------|---------------|
| format_version | texto `MAYOR.MENOR` | sí | VAL-004 |
| id | ID de archivo | sí | VAL-002; igual al nombre del archivo |
| name | texto | sí |  |
| elementos/relaciones/diagramas | colecciones | no | VAL-001, VAL-007 |

## Invariantes
Ver VAL-003, VAL-007.

## Persistencia
`knowledge/models/<model-id>.json` (un archivo por modelo, no fragmentado).

## Ciclo de vida
Creado y modificado vía MCP (REQ-021, REQ-023) o editado a mano y revalidado.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Propiedades indicativas; la definición exacta es la spec y el JSON Schema (API-004).
