---
id: REQ-011
type: requirement
name: "Validar al leer y antes de escribir"
status: active
evidence: declared-doc
summary: "ai-submind debe validar todo documento al cargarlo y antes de cada escritura"
aliases: ["validacion"]
tags: [validacion]
relations:
  actors: []
  features: [FEAT-003, FEAT-002]
  constraints: [VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, VAL-006, VAL-007]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-011 · Validar al leer y antes de escribir

## Enunciado

ai-submind debe validar todo documento al cargarlo y antes de cada escritura.

## Fuente

Usuario [U]; DEC-002, DEC-004. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dada una operación que produciría un documento inválido, cuando se ejecuta, entonces se rechaza completa y `knowledge/` no cambia.
2. Dado un archivo inválido en disco, cuando se carga, entonces se reporta y no admite escrituras (REQ-022).

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
