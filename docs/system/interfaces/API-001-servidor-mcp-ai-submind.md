---
id: API-001
type: interface
name: "Servidor MCP ai-submind"
status: active
evidence: declared-doc
summary: "Tools MCP tipadas de consulta y administración del conocimiento, por stdio (proxy) o Streamable HTTP."
aliases: ["mcp", "tools mcp", "streamable http"]
tags: [contratos]
implementation: none
code: []
test_code: []
relations:
  providers: []
  consumers: [ACT-002]
  entities: [ENT-002, ENT-003, ENT-004]
  validations: [VAL-001, VAL-002, VAL-003, VAL-006, VAL-007]
  tests: []
  decisions: []
uncertainties:
  - "P9: tools de layout (auto-layout) para agentes."
  - "Versionado del contrato MCP."
---

# API-001 · Servidor MCP ai-submind

## Contrato
Servidor MCP `ai-submind` (SDK `@modelcontextprotocol/server` v2) servido por el daemon en Streamable HTTP; `ai-submind mcp` actúa como proxy stdio (DEC-005). Recursos: modelos, diagramas, schema.

## Operaciones

| Operación | Entrada | Salida | Errores |
|-----------|---------|--------|---------|
| listar modelos/diagramas | filtros | ids, nombres, tipo, validez |  |
| obtener elemento | id | elemento, tipo, dueño, archivo | NOT_FOUND, AMBIGUOUS_ID |
| buscar / búsqueda léxica | filtros o texto, paginación | elementos ordenados |  |
| relaciones, impacto | id, tipos, profundidad | grafo | NOT_FOUND |
| crear modelo, crear/actualizar/eliminar elemento, gestionar diagramas | operación, expected_revision | resultado y diff | REVISION_CONFLICT, REFERENCED, DOCUMENT_INVALID, errores de VAL |
| lote atómico | lista de operaciones | todo o nada | idem |
| rename | id, nuevo id | referencias reescritas | colisión, NOT_FOUND |
| validar | - | informe de hallazgos |  |

## Autenticación y permisos
Token de sesión y loopback (NFR-004); rutas confinadas (NFR-006). Escritura de modelo solo por este canal (DEC-006).

## Versionado y compatibilidad
Esquemas de entrada/salida tipados; versionado del contrato por definir.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Nombres de operaciones indicativos; se fijan en la etapa correspondiente del plan.
