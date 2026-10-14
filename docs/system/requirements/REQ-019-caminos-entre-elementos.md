---
id: REQ-019
type: requirement
name: "Caminos entre elementos"
status: active
evidence: declared-doc
summary: "ACT-002 puede obtener los caminos más cortos entre dos elementos, con límite de longitud y número"
aliases: ["path"]
tags: [consultas]
relations:
  actors: [ACT-002]
  features: [FEAT-004]
  constraints: []
  depends_on: [REQ-017]
  decisions: []
uncertainties:
  - "Resuelto 2026-10-14: DEC-004 (aprobada) incluye caminos simples; entran en PLAN-002 S6. Lenguaje de caminos avanzado queda posterior."
---

# REQ-019 · Caminos entre elementos

## Enunciado

ACT-002 puede obtener los caminos más cortos entre dos elementos, con límite de longitud y número.

## Fuente

Usuario [A]; DEC-004. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un ciclo, entonces termina.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
