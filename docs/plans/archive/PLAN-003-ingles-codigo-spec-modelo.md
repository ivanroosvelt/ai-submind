---
id: PLAN-003
title: "Código, spec y modelo estructural en inglés (EDR-007)"
status: completed
created: 2026-10-14
updated: 2026-10-14
class: T2
related: [EDR-007, PLAN-002, DEC-009, API-004, FEAT-003]
blockers: []
next_action: "Ninguna: plan completado."
stages:
  - id: S1
    name: "Código del producto en inglés (src/, test/)"
    status: verified
    evidence: "2026-10-14 src/format y test/format en inglés (comentarios, mensajes de Finding, nombres de pruebas), junto con las correcciones de la revisión de PLAN-002 S4. npm run check: 78 Vitest OK. test/smoke.test.ts, package.json (description) y .dependency-cruiser.cjs traducidos tras la revisión (H2, H3)."
  - id: S2
    name: "Especificación del formato en inglés (spec/)"
    status: verified
    evidence: "2026-10-14 spec/format/README.md (§1-§13), examples/README.md, títulos de schemas (formato json.dumps intacto), 33 descripciones de expected.json. Corpus renombrado a inglés: valid/garaje → valid/garage (modelos garage, types; diagrama overview), canonical pedidos → orders, 32 casos invalid/ con nombres en inglés. Cobertura no ASCII conservada (Línea, vehículo). canonical/expected = serialize(input) en los 3 archivos; garage canónico. npm run check: 78 Vitest OK."
  - id: S3
    name: "Modelo estructural en inglés (docs/system/, plantillas de fichas, generadores)"
    status: verified
    evidence: "2026-10-14 89 fichas traducidas en 5 lotes (system-modeler) con guía de terminología común; slugs renombrados (git mv); README, context, conventions, glossary (reordenado), comentarios de schema.yaml y 10 plantillas de fichas. Sin enlaces a nombres antiguos fuera de generados. Generadores INDEX/MATRIX en inglés (S4). scripts/validate-system-model 0/0 y validate-ai-environment 0/0 tras scripts/regen."
  - id: S4
    name: "Herramientas en inglés (scripts/: comentarios y mensajes)"
    status: verified
    evidence: "2026-10-14 scripts/ (check, regen, sysq, validate-*, smtools/*.py, tests/*.py) en inglés: comentarios, docstrings, ayuda CLI, mensajes de Finding, banners y etiquetas de sysq; códigos de hallazgo, subcomandos y flags sin cambios. Salida de INDEX.md y MATRIX.md en inglés; cabecera de docs/system/inventory/id-ledger.txt en inglés. Se mantienen en español (documentación del entorno, EDR-007): salida de agents-index.md, skills-index.md, marcador del bloque Copilot y REQUIRED_SECTIONS de env.py. scripts/regen: actualiza INDEX.md y MATRIX.md. scripts/check: entorno 0/0, modelo 89 elementos 0/0, 42 pruebas de herramientas OK, npm run check OK (78 Vitest). sysq show FEAT-003 y find format OK. Pendiente revisión de change-verifier."
  - id: S5
    name: "Cierre: rutas citadas, regen, check, change-verifier, EDR-007 accepted"
    status: verified
    evidence: "2026-10-14 Sin rutas antiguas fuera de evidencia histórica (PLAN-002 lo anota en su bitácora). scripts/regen; scripts/check: entorno 0/0, modelo 0/0 (89), 42 pruebas herramientas, 78 Vitest, deps sin violaciones. change-verifier: aprobado con observaciones H1-H7 (corregidas: plantilla decision.md A/B, smoke test, package.json, .dependency-cruiser.cjs, ortografía estadounidense, búsqueda en inglés en task-intake/model-update, texto del plan, nota de citas traducidas); re-revisión aprobada con 3 menores corregidas. EDR-007 accepted."
---

# PLAN-003 · Código, spec y modelo en inglés

## Objetivo
Aplicar EDR-007: código, pruebas, herramientas, spec y modelo estructural en inglés; el resto de la
documentación sigue en español.

## Alcance
- Incluye: `src/`, `test/`, `scripts/`, `spec/`, `docs/system/` (fichas, slugs, aliases, DEC, context,
  glosario, convenciones, README, generados), plantillas de fichas del modelo.
- Excluye: `AGENTS.md` (salvo §14), `.ai/`, `.claude/`, `.github/`, planes, informes, `README.md` raíz,
  plantillas de plan/informe/agente/skill, mensajes de commit.

## Análisis (salida de task-intake e impact-analysis)
```
Clase: T2 (cambio de regla del entorno + ~110 fichas + spec + código).
Perspectivas: contracts aplica (códigos de hallazgo y claves no cambian; solo textos); data no aplica
  (formato de archivo idéntico); security no aplica; environment aplica (AGENTS.md §14, generadores,
  validadores → change-verifier obligatorio).
Riesgos: renombrar slugs rompe rutas citadas en planes/informes/fichas → grep y actualizar en S5;
  pruebas de scripts/tests que comparan textos de salida; spec/format/examples son canónicos byte a byte
  (se renombran casos, archivos e IDs del corpus; los archivos válidos y `canonical/expected` deben seguir canónicos byte a byte).
Hechos: usuario, 2026-10-14. Dudas: ninguna bloqueante.
```

## Etapas

### S1 · Código del producto
- Criterios de entrada: PLAN-002 S4 revisada por change-verifier y corregida.
- Acciones: comentarios, mensajes de `Finding.message`, nombres de `describe`/`it` en inglés.
- Pruebas: `npm run check`.

### S2 · Spec
- Acciones: `spec/format/README.md`, `examples/README.md`, `description` de `expected.json`, `title` de schemas.
- Pruebas: corpus Vitest (forma canónica de `valid/` y `canonical/expected` = `serialize(input)`).

### S3 · Modelo
- Acciones: traducir fichas y documentos de `docs/system/`; slugs en inglés (`git mv`); plantillas de fichas;
  textos de generadores en `scripts/smtools/model.py`; `scripts/regen`.
- Pruebas: `scripts/validate-system-model`, `scripts/check`.

### S4 · Herramientas
- Acciones: comentarios y mensajes de `scripts/` y sus pruebas.
- Pruebas: `scripts/check`.

### S5 · Cierre
- Acciones: actualizar rutas citadas en planes/informes; `scripts/regen`; `scripts/check`; change-verifier;
  EDR-007 `accepted`; archivar plan.

## Riesgos y bloqueos
- Traducciones por lotes con subagentes: revisar que IDs, claves de front matter y relaciones no cambian.

## Bitácora
- 2026-10-14 · creado por instrucción del usuario («todo debe ir en inglés»; alcance: código, spec, modelo).
- 2026-10-14 · S4 ejecutada (environment-steward); pendiente revisión independiente de change-verifier (AGENTS.md §10).

- 2026-10-14 · revisión change-verifier y re-revisión; correcciones aplicadas; EDR-007 accepted; plan completado y archivado.

## Resultado (al cerrar)
Código, pruebas, herramientas, spec y modelo estructural en inglés; resto de la documentación en español (EDR-007, AGENTS.md §14). Sin cambios de comportamiento: 78 pruebas de producto y 42 de herramientas en verde; mismos IDs, relaciones y códigos de hallazgo.
