---
id: REQ-003
type: requirement
name: "Exponer servidor MCP"
status: active
evidence: declared-doc
summary: "ACT-002 debe poder conectarse al servidor MCP `ai-submind`"
aliases: ["mcp", "stdio", "proxy"]
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-001, FEAT-004, FEAT-006]
  constraints: [NFR-004, NFR-010]
  depends_on: [REQ-037]
  decisions: []
uncertainties: []
---

# REQ-003 · Exponer servidor MCP

## Enunciado

ACT-002 debe poder conectarse al servidor MCP `ai-submind` para consultar y administrar el conocimiento.

## Fuente

Usuario [U]; DEC-005. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado `npx ai-submind mcp` lanzado por un cliente, cuando no hay daemon, entonces lo arranca y reenvía los mensajes por stdio.
2. Dado el cliente conectado, cuando lista tools, entonces recibe las de consulta y administración con esquemas tipados.
3. Dado transporte stdio, cuando se registran eventos, entonces los logs van solo a stderr.
4. Dado un cliente HTTP, cuando usa el endpoint Streamable HTTP del daemon con token válido, entonces accede a las mismas tools.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
