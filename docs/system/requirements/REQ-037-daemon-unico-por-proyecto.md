---
id: REQ-037
type: requirement
name: "Daemon único por proyecto"
status: active
evidence: declared-doc
summary: "ai-submind debe ejecutar un único daemon por proyecto que sirve UI y MCP, gestionable con `status` y `stop`"
aliases: ["daemon", "lockfile", "runtime.json"]
tags: [proceso]
relations:
  actors: [ACT-001, ACT-002]
  features: [FEAT-001]
  constraints: [NFR-004, NFR-005]
  depends_on: []
  decisions: []
uncertainties:
  - "Apagado: manual, por inactividad o al cerrar el último cliente (DEC-005)."
---

# REQ-037 · Daemon único por proyecto

## Enunciado

ai-submind debe ejecutar un único daemon por proyecto que sirve UI y MCP, gestionable con `status` y `stop`.

## Fuente

Usuario (2026-10-14); DEC-005. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dados dos arranques concurrentes en el mismo proyecto, entonces solo uno crea el daemon (lockfile) y el otro lo reutiliza.
2. Dado un lockfile huérfano (pid muerto), cuando se arranca, entonces se recupera.
3. El daemon escribe `knowledge/.ai-submind/runtime.json` (pid, puerto, token) con permisos 0600.
4. `ai-submind status` informa estado; `ai-submind stop` lo detiene.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
