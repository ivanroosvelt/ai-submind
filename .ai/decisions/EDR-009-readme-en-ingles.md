---
id: EDR-009
title: "README.md raíz en inglés y nombre del repositorio ai-submind"
status: accepted
date: 2026-10-16
affects: [AGENTS.md, README.md, .claude/agents/documenter.md, docs/system/context.md, docs/system/decisions/DEC-001-node-typescript-npx-stack.md, .ai/decisions/EDR-007-idioma-ingles-para-codigo-spec-y-modelo.md, .ai/decisions/EDR-008-agente-documenter-readme.md]
supersedes: []
---

# EDR-009 · README.md raíz en inglés y nombre del repositorio ai-submind

## Contexto
- EDR-007 y EDR-008 fijan el `README.md` del repositorio en español.
- El `README.md` raíz es también la página del paquete en npm (PLAN-004); el público de npm lee en inglés.
- Usuario, 2026-10-16: «renómbralo, restablece la rama principal con v2 y reemplaza npm y git a ai-submind,
  readme en inglés». El repositorio de GitHub pasa de `tejo` a `ai-submind`.

## Alternativas consideradas
1. **README raíz en inglés** — una sola fuente, que npm muestra tal cual.
2. README en inglés solo dentro del tarball (copiado al empaquetar) y el del repositorio en español — dos
   fuentes del mismo contenido (AGENTS.md §1.2) y un paso de build más.
3. Mantenerlo en español — contradice la petición y limita a quien llega desde npm.

## Decisión
Alternativa 1. `README.md` raíz en inglés; excepción explícita a EDR-007 (el resto de la documentación del
proceso sigue en español). `documenter` (AGT-005) lo mantiene en inglés. El entorno y el modelo nombran el
producto y el repositorio `ai-submind`; `submind` queda solo como nombre del directorio local.

## Consecuencias
- Positivas: página de npm legible; README y paquete con el mismo nombre que el repositorio.
- Negativas / costes: un documento en inglés entre la documentación en español; los informes históricos
  (`docs/reports/`) conservan el nombre `submind`.

## Verificación
- `scripts/check` en verde; revisión `change-verifier` (cambio autorreferencial, AGENTS.md §10).
