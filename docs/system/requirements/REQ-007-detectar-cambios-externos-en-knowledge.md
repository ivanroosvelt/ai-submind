---
id: REQ-007
type: requirement
name: "Detectar cambios externos en knowledge/"
status: active
evidence: declared-doc
summary: "ai-submind debe revalidar y reindexar cuando ACT-001 o ACT-003 modifican `knowledge/` fuera de ai-submind"
aliases: ["watcher", "recarga"]
tags: [motor]
relations:
  actors: [ACT-001, ACT-003]
  features: [FEAT-002]
  constraints: [NFR-005, NFR-007]
  depends_on: [REQ-006]
  decisions: []
uncertainties: []
---

# REQ-007 · Detectar cambios externos en knowledge/

## Enunciado

ai-submind debe revalidar y reindexar cuando ACT-001 o ACT-003 modifican `knowledge/` fuera de ai-submind.

## Fuente

Usuario [U]; DEC-004. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado el daemon activo, cuando un archivo cambia en disco, entonces se revalida, reindexa y la UI se refresca (REQ-030).
2. Dado un cambio externo sobre un documento con una escritura en curso, cuando la escritura confirma, entonces se rechaza con `REVISION_CONFLICT`.
3. Dado un checkout que cambia muchos archivos, entonces el reindexado se agrupa sin exponer estados intermedios como error.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
