---
id: REQ-004
type: requirement
name: "Servir UI web local"
status: active
evidence: declared-doc
summary: "ACT-001 puede abrir la UI en el navegador"
aliases: ["ui", "navegador"]
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-001, FEAT-007]
  constraints: [NFR-004]
  depends_on: [REQ-037]
  decisions: []
uncertainties:
  - "Cómo recibe el navegador el token (NFR-004)."
---

# REQ-004 · Servir UI web local

## Enunciado

ACT-001 puede abrir la UI en el navegador para explorar diagramas servidos por el daemon.

## Fuente

Usuario [U]; DEC-005, DEC-006. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado el daemon listo, cuando se abre la URL informada, entonces la UI se sirve solo en 127.0.0.1 y exige el token de sesión.
2. Dado el puerto preferido ocupado, cuando arranca, entonces usa un puerto libre y lo registra en `runtime.json`.
3. Dado `ai-submind stop`, cuando termina, entonces no queda nada escuchando.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
