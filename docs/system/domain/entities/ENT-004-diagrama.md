---
id: ENT-004
type: entity
name: "Diagrama"
status: active
evidence: declared-doc
summary: "Vista de un modelo con tipo declarado (clases o secuencia) formada por referencias a elementos."
aliases: ["diagram", "class diagram", "sequence diagram"]
tags: [formato, datos]
implementation: none
code: []
test_code: []
relations:
  related: [ENT-003]
  validations: [VAL-001, VAL-002, VAL-003]
  decisions: []
uncertainties: []
---

# ENT-004 · Diagrama

## Descripción
Conjunto de referencias a elementos del modelo, sin layout; `kind` declara el tipo de diagrama y los tipos de elemento admitidos (DEC-002).

## Propiedades

| Propiedad | Tipo | Obligatoria | Restricciones |
|-----------|------|-------------|---------------|
| id | ID de archivo | sí | VAL-002; nombra su layout |
| name | texto | sí |  |
| kind | enumeración | sí | clases, secuencia; extensible (REQ-013) |
| elementos | lista de idref | no | VAL-003 |

## Invariantes
Solo referencia elementos admitidos por su `kind`.

## Persistencia
Dentro de ENT-002.

## Ciclo de vida
Gestionado vía MCP (REQ-025).

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Propiedades indicativas; la definición exacta es la spec y el JSON Schema (API-004).
