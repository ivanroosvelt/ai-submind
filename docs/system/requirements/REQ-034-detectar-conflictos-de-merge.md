---
id: REQ-034
type: requirement
name: "Detectar conflictos de merge"
status: active
evidence: declared-doc
summary: "ai-submind debe detectar marcadores de conflicto en `knowledge/`, marcar el archivo `conflicted` y no sobrescribirlo"
aliases: []
tags: [integridad]
relations:
  actors: [ACT-003]
  features: [FEAT-008]
  constraints: [VAL-006]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-034 · Detectar conflictos de merge

## Enunciado

ai-submind debe detectar marcadores de conflicto en `knowledge/`, marcar el archivo `conflicted` y no sobrescribirlo.

## Fuente

Usuario [U]. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Diagnóstico visible en CLI, MCP y UI, sin reparación silenciosa.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
