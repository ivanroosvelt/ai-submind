---
id: DEC-005
type: decision
name: "Daemon único por proyecto con proxy MCP stdio"
status: active
evidence: declared-doc
summary: "Un proceso por proyecto sirve UI y MCP (Streamable HTTP en loopback); `ai-submind mcp` por stdio se conecta o lo arranca. Un solo escritor."
aliases: [daemon, proceso, mcp, stdio, http, lockfile]
tags: [arquitectura, seguridad, contratos]
relations:
  affects: [REQ-001, REQ-003, REQ-004, REQ-037, NFR-004, NFR-005, NFR-006, FEAT-001, API-001, API-002, API-003]
  supersedes: []
uncertainties:
  - "Apagado del daemon: manual, por inactividad o al cerrar el último cliente."
---

# DEC-005 · Daemon único por proyecto con proxy MCP stdio

## Contexto
- Usuario eligió "Daemon único + MCP proxy" (2026-10-14) [declarado].
- SDK MCP v2 estable: `@modelcontextprotocol/server` 2.3.1; transportes stdio y Streamable HTTP [verificado: npm].
- Claude Code registra servidores stdio vía `.mcp.json` con `npx` [verificado: tech-research].
- Registro previsto: `{"mcpServers":{"ai-submind":{"type":"stdio","command":"npx","args":["-y","ai-submind","mcp"]}}}` [inferido].

## Alternativas consideradas
1. **Daemon + proxy stdio** — un solo escritor, UI y agentes ven el mismo estado.
2. Proceso stdio por agente — simple; varios escritores y UI separada.
3. Solo HTTP — sin proxy; peor integración con clientes que esperan stdio.

## Decisión
- `npx ai-submind` (o `ai-submind serve`): inicia el daemon del proyecto; HTTP en `127.0.0.1` (puerto libre),
  sirve UI, API de la UI y endpoint MCP Streamable HTTP.
- `npx ai-submind mcp`: transporte stdio; localiza el daemon por `knowledge/.ai-submind/runtime.json`
  (pid, puerto, token) y lo arranca si no existe; reenvía mensajes. Logs solo a stderr.
- Lockfile garantiza un daemon por proyecto.
- Seguridad: bind solo loopback; token aleatorio por sesión en `runtime.json` (permisos 0600);
  validación de `Host`/`Origin` (anti DNS-rebinding); rutas confinadas a `knowledge/`.

## Consecuencias
- Positivas: consistencia y sin carreras de escritura.
- Negativas / costes: gestión de ciclo de vida del daemon y recuperación de lockfiles huérfanos.

## Elementos afectados
CLI, MCP, UI, seguridad (CAP-013).

## Verificación
Pendiente: pruebas de arranque concurrente, lock huérfano, rechazo de Origin ajeno, cliente MCP real.
