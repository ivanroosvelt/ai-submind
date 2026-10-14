---
id: REP-002
title: "Resultado del bootstrap del entorno de desarrollo asistido por IA"
date: 2026-10-14
status: current
supersedes: []
---

# REP-002 · Resultado del bootstrap del entorno de IA

## Resumen
Entorno de orquestación operativo y verificado sobre la rama `v2` greenfield (EDR-002). El modelo
estructural del producto está inicializado (esquema, convenciones, plantillas, validadores) y
**vacío a propósito**: el producto aún no está definido y no se inventaron elementos. Plan: PLAN-001
(archivado, `completed`). Integrado en el commit inicial de `v2` y publicado en `origin/v2` (ver `git log`).

## Estructura e instrucciones

| Archivo | Rol | Relación con `AGENTS.md` |
|---------|-----|--------------------------|
| `AGENTS.md` | Contrato canónico | — |
| `CLAUDE.md` | Adaptador Claude Code | import nativo `@AGENTS.md` (EDR-001) |
| `.github/copilot-instructions.md` | Adaptador Copilot | `AGENTS.md` incrustado por `scripts/regen`, verificado por sha (EDR-001) |
| `.ai/policies/*.md` | Gobierno, ciclo de vida, verificación | detallan §10–§12 |

## Componentes (creados; ninguno modificado o retirado)
- Agentes: AGT-001 `requirements-analyst`, AGT-002 `system-modeler`, AGT-003 `change-verifier`
  (solo lectura), AGT-004 `environment-steward`.
- Skills: SKL-001 `task-intake`, SKL-002 `impact-analysis`, SKL-003 `staged-plan`, SKL-004
  `model-update`, SKL-005 `decision-record`, SKL-006 `verify-change`, SKL-007 `environment-audit`,
  SKL-008 `requirements-analysis`.
- Capacidades: 16 (CAP-001..016); 9 `covered`, 4 `partial`, 3 `deferred`, abiertas aceptadas por EDR-005.

## Modelo estructural
11 tipos (ACT, REQ, NFR, FEAT, ENT, FUN, VAL, API, INT, DEC, TST) en `docs/system/schema.yaml`;
relaciones declaradas en origen, inversas calculadas (EDR-004); ledgers append-only de IDs;
inventario y matriz generados. Elementos registrados: **0**.

## Validadores y resultados (ejecutados)

| Comando | Resultado |
|---------|-----------|
| `scripts/check` | exit 0 — entorno 0 errores; modelo 0 errores / 0 advertencias; 42 pruebas OK (Python 3.14) |
| `scripts/check --strict` | exit 0 — 0 errores, 0 advertencias en entorno y modelo; 42 pruebas OK |
| Python 3.12 | 34 pruebas OK en la revisión independiente 1 (versión anterior de la suite); 3.10 no probado localmente: lo cubre la matriz de CI |
| Carga nativa | Claude Code cargó los 8 skills en la sesión; los 4 agentes tras recargarse |

## Revisión independiente
1. Iteración 1 (agente general siguiendo `.claude/agents/change-verifier.md`, porque los agentes del
   proyecto aún no estaban cargados): **aprobado con observaciones**, H1–H10, corregidos.
2. Iteración 2 (agente `change-verifier` nativo): **aprobado con observaciones**, N1–N7.
   N1, N2, N6 y N7 se corrigieron con pruebas nuevas. **Estas correcciones no tuvieron una tercera
   revisión independiente**: la condición de parada de `AGENTS.md` §10 limita las iteraciones a dos.
   N3, N4 y N5 quedan como limitaciones documentadas.

## Implementado / verificado / pendiente / bloqueado
- **Implementado y verificado**: todo lo anterior (evidencias en PLAN-001).
- **Cerrado por el usuario (2026-10-14)**: orden explícita de "cerrar el bootstrapping" y publicar
  (force push autorizado). Se toma como aprobación humana del workflow de CI (G3). Commit y push hechos.
  El force no hizo falta: `v2` no existía en el remoto.
- **Pendiente**:
  - Fijar las acciones de CI por SHA en lugar de por tag.
  - Comprobar la primera ejecución del CI en GitHub.
- **Bloqueado**:
  - Definir el producto: faltan los datos (`docs/system/context.md`).

## Riesgos y limitaciones
- Copilot: no se verificó la carga real en VS Code ni en el agente de GitHub. El adaptador incrusta
  `AGENTS.md` y ordena leer los skills por ruta.
- Validadores: no detectan contradicciones semánticas, solo duplicación literal. El resto de
  limitaciones está en `.ai/policies/verification.md`.
- Capacidades `deferred` (implementación, datos, rendimiento): no hay especialistas hasta que exista
  un stack.

## Próximas acciones
1. Describir el producto y ejecutar `requirements-analysis` (REQ y ACT iniciales).
2. Registrar el stack como DEC-001 y declarar `code_roots`. Después, ejecutar `environment-audit` para revisar CAP-011, CAP-012 y CAP-014.
3. Fijar las acciones de CI por SHA.
