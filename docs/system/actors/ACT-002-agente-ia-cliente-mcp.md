---
id: ACT-002
type: actor
name: "Agente IA (cliente MCP)"
status: active
evidence: declared-doc
summary: "Agente o herramienta que consulta y administra el conocimiento vía el servidor MCP ai-submind."
aliases: ["agente", "cliente mcp", "llm", "claude code"]
tags: [sistema-externo]
relations:
  specializes: []
uncertainties:
  - "P9: si el agente puede modificar layout (p. ej. pedir auto-layout) por MCP."
---

# ACT-002 · Agente IA (cliente MCP)

## Descripción
Cliente MCP (p. ej. Claude Code) que lanza `npx ai-submind mcp` por stdio o se conecta por Streamable HTTP
al daemon del proyecto (DEC-005).

## Objetivos
Consultar el modelo (estructura, relaciones, impacto, búsqueda) y crear o modificar modelos, elementos y diagramas.

## Permisos

| Recurso / operación | Permitido | Condiciones |
|---------------------|-----------|-------------|
| Tools de consulta | sí | solo lectura (API-001) |
| Tools de administración (crear/modificar/eliminar/rename/lotes/validar) | sí | validación previa, todo o nada (REQ-011, REQ-026) |
| Rutas fuera de `knowledge/` | no | NFR-006 |
| Modificar layout | por decidir | ver incertidumbre |
