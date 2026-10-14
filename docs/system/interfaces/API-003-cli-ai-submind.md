---
id: API-003
type: interface
name: "CLI ai-submind"
status: active
evidence: declared-doc
summary: "Comando ai-submind (npx) con subcomandos serve, mcp, init, status, stop y validación."
aliases: ["cli", "npx", "comando"]
tags: [contratos]
implementation: none
code: []
test_code: []
relations:
  providers: []
  consumers: [ACT-001, ACT-002]
  entities: [ENT-001]
  validations: []
  tests: []
  decisions: []
uncertainties:
  - "Nombre del subcomando de validación (p. ej. `validate`)."
  - "P11: puerto por defecto y apertura automática del navegador."
---

# API-003 · CLI ai-submind

## Contrato
Binario `ai-submind` del paquete npm (DEC-001). Raíz = git root del cwd (o cwd); `--knowledge <dir>` confinado a la raíz.

## Operaciones

| Operación | Entrada | Salida | Errores |
|-----------|---------|--------|---------|
| `ai-submind` / `serve` | opciones | daemon en marcha, URL de la UI en stderr | Node < 22, lock |
| `mcp` | - | proxy stdio al daemon (lo arranca si falta) |  |
| `init` | - | estructura mínima de knowledge/ y .gitignore | no sobrescribe |
| `status`, `stop` | - | estado/parada del daemon |  |
| validar | - | informe; código ≠ 0 si hay errores |  |

## Autenticación y permisos
Usuario local; sin autenticación propia.

## Versionado y compatibilidad
Subcomandos y opciones estables a partir de la primera publicación.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Nombres de operaciones indicativos; se fijan en la etapa correspondiente del plan.
