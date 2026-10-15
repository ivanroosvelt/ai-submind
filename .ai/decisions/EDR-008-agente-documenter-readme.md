---
id: EDR-008
title: "Agente documenter para mantener el README en cada ciclo"
status: accepted
date: 2026-10-15
affects: [AGENTS.md, .claude/agents/documenter.md, .claude/skills/verify-change/SKILL.md, .ai/registry/components.yaml, .ai/registry/capabilities.yaml, .ai/registry/coverage.yaml]
supersedes: []
---

# EDR-008 · Agente documenter para el README

## Contexto
- `README.md` sigue describiendo el proyecto como «producto aún no definido», aunque PLAN-002 ya implementó
  formato, motor, consultas, CLI, daemon y MCP: nadie es responsable de mantenerlo.
- Ninguna capacidad del registro cubre la documentación de uso: CAP-016 detecta documentación obsoleta del
  entorno y el modelo, pero no actualiza el README.
- Usuario, 2026-10-15: «crea un agente documenter que se encargue de actualizar el readme en cada ciclo de
  ser necesario».

## Alternativas consideradas
1. Añadir un paso a `verify-change` — mezcla verificar con producir y deja al mismo contexto revisarse.
2. **Agente nuevo `documenter` invocado en cada ciclo** — contexto aislado, herramientas acotadas a
   editar el README; lo pide el usuario explícitamente.
3. Ampliar `system-modeler` — su alcance es `docs/system/` (inglés) y el README es documentación en español.
4. Ampliar `environment-steward` o dar a SKL-007/AGT-003 (CAP-016) la tarea de actualizar — su ámbito es el
   entorno de IA, no el producto, y AGT-003 debe seguir siendo solo verificador.

## Decisión
Alternativa 2. AGT-005 `documenter`, capacidad CAP-017 «Documentación de uso (README)», perspectiva
`traceability`. `AGENTS.md` §5 añade la fila y §6 lo invoca al final de la fase 4 de cada ciclo T1/T2, antes
de verificar, para que su cambio entre en la revisión de `change-verifier`; decide él si hace falta cambiar
algo. `verify-change` comprueba que se invocó. Herramientas sin `Write`: solo edita el README existente.
El README sigue en español (EDR-007).

## Consecuencias
- Positivas: README alineado con el estado real en cada ciclo; responsable explícito.
- Negativas / costes: una invocación más por ciclo (barata si no hay cambios visibles).

## Verificación
- `scripts/check` en verde.
- Revisión `change-verifier` (G2, 2026-10-15): aprobado con observaciones 1–7; corregidas 1 (invocación en
  fase 4, antes de verificar), 2 (paso en `verify-change`), 3 (sin `Write`), 4 (formato de AGENTS.md §6) y 5
  (alternativas); 6–7 informativas.
