---
id: REP-001
title: "Descubrimiento inicial del repositorio (Stage 0)"
date: 2026-10-14
status: current
supersedes: []
---

# REP-001 · Descubrimiento inicial del repositorio

## Resumen
La rama de trabajo `v2` es una rama huérfana sin commits y con el árbol de trabajo vacío. Por
decisión del usuario (EDR-002) se trata como proyecto nuevo, sin relación con otras ramas.

## Hallazgos

| Hallazgo | Clasificación |
|----------|---------------|
| Rama actual `v2`, "No commits yet", árbol vacío, sin cambios pendientes | verificado (`git status`) |
| Remoto `origin` → repositorio `submind` | verificado (`git remote -v`) |
| Existen otras ramas locales y remotas; **fuera de alcance** por decisión del usuario | verificado / declarado |
| ~~Existe `origin/v2` con historia no relacionada~~ — **corrección**: era una referencia de seguimiento local obsoleta; `git ls-remote` mostró que el remoto solo tenía `master` | verificado (`git ls-remote --heads origin`) |
| Lenguajes, frameworks, dependencias, build | no existen (árbol vacío) — verificado |
| Puntos de entrada, módulos, servicios, entidades, API, esquemas, pruebas, despliegue | no existen — verificado |
| Instrucciones para agentes (Claude, Copilot, otros) en `v2` | no existen — verificado |
| Documentación funcional o técnica en `v2` | no existe — verificado |
| Propósito y alcance del producto | desconocido |
| Herramientas disponibles en el entorno local: Python 3.14, Node.js 22, Git; pnpm no instalado | verificado (`--version`) |

## Convenciones detectadas
Ninguna en `v2`. Se adoptan: documentación en español, Conventional Commits en español
(`AGENTS.md` §14).

## Riesgos
- Sin definición del producto, el modelo estructural solo puede inicializarse vacío: cualquier
  elemento de producto creado ahora sería inventado.
- Las ramas antiguas siguen existiendo en local y remoto; no se tocan (borrarlas es irreversible).
- Publicación: el riesgo de sobrescribir `origin/v2` resultó inexistente (ver corrección arriba y REP-002).

## Próximas acciones
Diseño del entorno (Stage 1) y bootstrap según PLAN-001.
