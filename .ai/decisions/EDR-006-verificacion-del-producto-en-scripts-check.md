---
id: EDR-006
title: "scripts/check ejecuta la verificación del producto (npm run check) y CI instala Node"
status: accepted
date: 2026-10-14
affects: [scripts/check, .github/workflows/validate.yml, .ai/registry/capabilities.yaml, AGENTS.md, CAP-011, CAP-012]
supersedes: []
---

# EDR-006 · scripts/check ejecuta la verificación del producto y CI instala Node

## Contexto
- PLAN-002 S3 crea el paquete `ai-submind` con typecheck, lint, formato y pruebas Vitest (DEC-008).
- AGENTS.md §12: `scripts/check` es la verificación única que ejecuta CI. Sin integrar el producto,
  CI y `verify-change` no verían errores de código.
- EDR-005 aceptó CAP-011 `deferred` y CAP-012 `partial` por falta de stack y de framework de pruebas.

## Alternativas consideradas
1. Comando aparte (`npm run check`) fuera de `scripts/check` — dos puntos de verificación; fácil olvidarlo.
2. **`scripts/check` ejecuta `npm run check` si existe `package.json`**; falla (no omite) si falta npm o
   `node_modules`, para no dar verde sin probar el producto.

## Decisión
Alternativa 2.
- `scripts/check` añade la sección «Producto»; ausencia de npm o de dependencias es error con la acción
  a seguir (`npm ci`).
- CI (`validate.yml`): `actions/setup-node` (Node 22, caché npm) y `npm ci` antes de `scripts/check`.
- CAP-012 pasa a `covered` (SKL-006 ejecuta `scripts/check`). CAP-011 pasa a `partial` aceptada por esta
  EDR: el agente principal implementa; reevaluar un skill de stack tras PLAN-002 S5.
- AGENTS.md §0 y §5 reflejan el estado real (stack fijado).

## Consecuencias
- Positivas: una sola puerta de verificación local y en CI.
- Negativas: `scripts/check` requiere Node ≥22 y `npm ci`; CI algo más lento.

## Verificación
- Aprobación humana del cambio de CI (G3): usuario, 2026-10-14, en la conversación de PLAN-002 S3.
- 2026-10-14: `scripts/check` local en verde con la sección de producto.
- Pendiente: revisión `change-verifier`; ejecución real del workflow en GitHub (requiere push).
