---
id: REQ-026
type: requirement
name: "Operaciones por lotes atómicas"
status: active
evidence: declared-doc
summary: "ACT-002 puede aplicar un lote de operaciones que se valida completo y se persiste todo o nada"
aliases: ["batch", "transaccion"]
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-006, FEAT-002]
  constraints: [NFR-005]
  depends_on: [REQ-011]
  decisions: []
uncertainties: []
---

# REQ-026 · Operaciones por lotes atómicas

## Enunciado

ACT-002 puede aplicar un lote de operaciones que se valida completo y se persiste todo o nada.

## Fuente

Supuesto del analista; DEC-004 (transacciones). Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un lote con una operación inválida, cuando se aplica, entonces no se escribe nada y se devuelven los errores.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
