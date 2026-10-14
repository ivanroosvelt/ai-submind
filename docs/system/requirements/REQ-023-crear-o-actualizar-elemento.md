---
id: REQ-023
type: requirement
name: "Crear o actualizar elemento"
status: active
evidence: declared-doc
summary: "ACT-002 puede crear o modificar cualquier elemento del formato"
aliases: []
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: [VAL-001, VAL-002, VAL-003, NFR-005]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-023 · Crear o actualizar elemento

## Enunciado

ACT-002 puede crear o modificar cualquier elemento del formato.

## Fuente

Usuario [U]; DEC-003. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un elemento sin id, cuando se crea, entonces el motor asigna un id legible derivado del nombre con ámbito, único global, con sufijo determinista ante colisión.
2. Dado un cambio de `name`, entonces el `id` no cambia.
3. Dado un campo `null`, entonces se conserva como `null` (desconocido).
4. Dada una actualización con `expected_revision` distinta de la actual, entonces error `REVISION_CONFLICT`.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
