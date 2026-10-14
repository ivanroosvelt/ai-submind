---
id: FEAT-001
type: feature
name: "CLI y daemon por proyecto"
status: active
evidence: declared-doc
summary: "Comando npx ai-submind que arranca un daemon único por proyecto y el proxy MCP stdio."
aliases: ["cli", "daemon", "serve"]
tags: [cli, proceso]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-001]
  functions: []
  interfaces: [API-003]
  integrations: []
  depends_on: [FEAT-002]
  decisions: []
uncertainties:
  - "Apagado del daemon: manual, por inactividad o al cerrar el último cliente (DEC-005)."
---

# FEAT-001 · CLI y daemon por proyecto

## Descripción
CLI `ai-submind` (API-003) y ciclo de vida del daemon: resolución de raíz, lockfile, `runtime.json`, HTTP en loopback (DEC-001, DEC-005). PLAN-002 S7.

## Comportamiento
REQ-001..004, REQ-012 (CLI), REQ-037.

## Estados y transiciones
Servidor: `starting` → `indexing` → `ready` | `degraded` → `stopping` → `stopped`; `ready ↔ degraded` según revalidaciones.

## Dependencias
FEAT-002 (motor).

## Riesgos
Procesos huérfanos, puertos ocupados, lock huérfano.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
