---
id: NFR-010
type: quality-attribute
name: "Observabilidad"
status: proposed
evidence: inferred
summary: "Logs a stderr con nivel configurable y sin contenido de knowledge/ por defecto (supuesto)."
aliases: ["logs", "logging"]
tags: [calidad]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Nivel configurable y política de contenido en logs son supuestos del analista."
---

# NFR-010 · Observabilidad

## Requisito
Logs a stderr (obligatorio en stdio, REQ-003) con nivel configurable; por defecto no se registra contenido de `knowledge/`.

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Escrituras en stdout en modo mcp | 0 fuera del protocolo | prueba S8 |

## Alcance
CLI, daemon, proxy MCP.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
