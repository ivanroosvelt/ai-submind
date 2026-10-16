---
id: EDR-007
title: "Código, especificación y modelo estructural en inglés; el resto de la documentación en español"
status: accepted
date: 2026-10-14
affects: [AGENTS.md, .github/copilot-instructions.md, docs/system/, docs/templates/, spec/, src/, test/, scripts/, package.json, .dependency-cruiser.cjs, .claude/skills/task-intake/, .claude/skills/model-update/, .claude/skills/decision-record/]
supersedes: []
---

# EDR-007 · Código, spec y modelo en inglés

## Contexto
- AGENTS.md §14 fijaba toda la documentación en español y solo identificadores en inglés.
- El producto `ai-submind` se distribuye como paquete npm público con un formato de archivo propio
  (spec 1.0): el código, sus mensajes, la especificación y el modelo que los describe tienen como
  audiencia a cualquier persona o agente que use el paquete, no solo al equipo.
- Mezclar idiomas ya generaba incoherencias: los mensajes de Ajv (`SCHEMA_VIOLATION`) salen en inglés y
  los del validador propio en español (DEC-009, duda abierta).
- Usuario, 2026-10-14: «todo debe ir en inglés»; alcance precisado: «código, spec, modelo, solo
  documentación en español».

## Alternativas consideradas
1. Mantener §14 (todo en español) — contradice la instrucción del usuario.
2. **Inglés para código, spec y modelo; español para el resto de la documentación.**
3. Todo el repositorio en inglés — descartado por el usuario.

## Decisión
Alternativa 2.
- **Inglés**: código y pruebas (`src/`, `test/`, `scripts/`: comentarios, mensajes, nombres de pruebas),
  especificación del formato (`spec/`), modelo estructural (`docs/system/`: fichas, slugs de archivo,
  aliases, DEC, contexto, glosario, convenciones, generados), plantillas de fichas del modelo
  (`docs/templates/` salvo `plan.md`, `report.md`, `agent.md`, `skill.md`, `README.md`) y el bloque DEC de
  `docs/templates/decision.md`; metadatos del paquete (`package.json`) y configuración de herramientas
  (`.dependency-cruiser.cjs`).
- **Español**: documentación del proceso y del entorno — `AGENTS.md`, adaptadores, `.ai/` (políticas,
  registro, EDR), `.claude/` (agentes, skills), planes, informes, plantillas de planes/informes/agentes/
  skills, `docs/templates/README.md`, bloque EDR de `docs/templates/decision.md`. El `README.md` raíz pasó a inglés (EDR-009).
- Commits: siguen en español (no son código, spec ni modelo).
- Búsqueda: `aliases` en inglés; para localizar fichas, `scripts/sysq find` con el término en inglés
  (task-intake, model-update). Las citas de personas en DEC se traducen; `docs/system/decisions/README.md` lo
  declara y el original queda en el historial de Git.
- Los IDs no cambian; los slugs de archivo de fichas se renombran (conventions.md lo permite) y las rutas
  citadas se actualizan.
- Migración por etapas en PLAN-003.

## Consecuencias
- Positivas: producto, contrato y modelo legibles por cualquier usuario del paquete; mensajes de
  hallazgos coherentes con los de Ajv (cierra la duda de DEC-009).
- Negativas / costes: traducción de ~110 fichas, la spec y los generadores; rutas citadas en planes e
  informes cambian; `sysq find` con términos en español deja de encontrar por alias.

## Verificación
- Instrucción y alcance: usuario, 2026-10-14, en la conversación de PLAN-003.
- `scripts/check` en verde tras cada etapa (entorno 0/0, modelo 0/0, 42 pruebas de herramientas, 78 Vitest).
- Revisión `change-verifier` (contexto limpio): aprobado con observaciones H1–H7, corregidas; re-revisión
  aprobada con 3 observaciones menores, corregidas.
