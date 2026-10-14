---
id: REQ-012
type: requirement
name: "Informe de validación"
status: active
evidence: declared-doc
summary: "ACT-002 puede pedir la validación de todo `knowledge/` por MCP y ACT-001 puede ejecutarla por CLI (CI, pre-commit)"
aliases: ["validate"]
tags: [validacion]
relations:
  actors: [ACT-001, ACT-002]
  features: [FEAT-003, FEAT-001]
  constraints: []
  depends_on: [REQ-011]
  decisions: []
uncertainties: []
---

# REQ-012 · Informe de validación

## Enunciado

ACT-002 puede pedir la validación de todo `knowledge/` por MCP y ACT-001 puede ejecutarla por CLI (CI, pre-commit).

## Fuente

Supuesto del analista. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Cada hallazgo incluye severidad, código, archivo, JSON Pointer, id afectado y mensaje.
2. El subcomando CLI sale con código ≠ 0 si hay errores.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
