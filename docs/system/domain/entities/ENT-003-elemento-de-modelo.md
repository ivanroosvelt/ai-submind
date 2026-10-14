---
id: ENT-003
type: entity
name: "Elemento de modelo"
status: active
evidence: declared-doc
summary: "Elemento UML de un modelo (clase, interfaz, atributo, operación, relación, interacción, lifeline, mensaje, etc.)."
aliases: ["elemento", "element"]
tags: [formato, datos]
implementation: none
code: []
test_code: []
relations:
  related: []
  validations: [VAL-001, VAL-002, VAL-003, VAL-007]
  decisions: []
uncertainties:
  - "Propiedades exactas pendientes de la spec y JSON Schema (S2)."
  - "Si cada tipo UML (clase, lifeline, ...) tendrá ficha ENT propia tras S2."
---

# ENT-003 · Elemento de modelo

## Descripción
Concepto genérico para todo elemento con `id` dentro de un modelo; su tipo lo da la colección que lo contiene. Catálogo inicial: diagramas de clases y de secuencia (derivado de UMJ).

## Propiedades

| Propiedad | Tipo | Obligatoria | Restricciones |
|-----------|------|-------------|---------------|
| id | id legible con ámbito | sí | VAL-002; estable al cambiar name |
| name | texto | según tipo |  |
| visibility | enumeración | según tipo | VAL-001 |
| external_id | texto | no | ids de herramientas importadas (DEC-003) |

## Invariantes
`null` = valor desconocido; no se sustituye por defecto. Renombrar `id` solo vía motor (REQ-039).

## Persistencia
Dentro de ENT-002.

## Ciclo de vida
Crear/actualizar/eliminar vía MCP; rename reescribe referencias.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Propiedades indicativas; la definición exacta es la spec y el JSON Schema (PLAN-002 S2).
