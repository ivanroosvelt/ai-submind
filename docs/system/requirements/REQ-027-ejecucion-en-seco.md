---
id: REQ-027
type: requirement
name: "Ejecución en seco"
status: proposed
evidence: inferred
summary: "Cualquier operación de escritura admite `dry_run` que devuelve validación y diff sin escribir"
aliases: ["dry run"]
tags: [mcp, posterior]
relations:
  actors: [ACT-002]
  features: [FEAT-006]
  constraints: []
  depends_on: []
  decisions: []
uncertainties:
  - "Incremento posterior según el anexo; confirmar si entra en PLAN-002."
---

# REQ-027 · Ejecución en seco

## Enunciado

Cualquier operación de escritura admite `dry_run` que devuelve validación y diff sin escribir.

## Fuente

Supuesto del analista. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado `dry_run: true`, entonces `knowledge/` no cambia.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
