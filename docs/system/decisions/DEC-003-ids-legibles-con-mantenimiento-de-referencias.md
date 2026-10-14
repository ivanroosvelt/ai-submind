---
id: DEC-003
type: decision
name: "IDs legibles por humanos con garantía y mantenimiento de referencias"
status: active
evidence: declared-doc
summary: "Los elementos usan IDs legibles (slugs con ámbito) y el motor garantiza unicidad y reescribe referencias al renombrar."
aliases: [ids, idref, slug, rename, referencias]
tags: [formato, datos, integridad]
relations:
  affects: [REQ-023, REQ-035, REQ-039, VAL-002, VAL-003, ENT-003, FEAT-006, API-004]
  supersedes: []
uncertainties: []
---

# DEC-003 · IDs legibles con garantía de referencias

## Contexto
- Usuario (2026-10-14): "legibles con garantía/mantenimiento de referencias" [declarado].
- UMJ usa `id` + `{"idref": ...}`; conserva IDs de la herramienta de origen [verificado: paper].

## Alternativas consideradas
1. Generados (ULID) — sin colisiones; diffs opacos.
2. **Legibles con mantenimiento** — diffs y consultas legibles; exige refactor de referencias.
3. Únicos por modelo — simple; referencias cruzadas más complejas.

## Decisión
- IDs legibles derivados del nombre con ámbito (p. ej. `Car`, `Car.yearOfProduction`, `Car.start()`),
  únicos en todo `knowledge/`; colisiones resueltas con sufijo determinista.
- Espacio de nombres único para todo `knowledge/` (elementos, modelos y diagramas); por eso una
  referencia a otro modelo es un `idref` simple, sin cualificar (usuario, 2026-10-14). Gramática y
  derivación determinista: spec §3 (API-004).
- El ID es estable: cambiar `name` no cambia el `id`. Renombrar un `id` solo vía operación del motor
  (`rename`), que reescribe atómicamente todas las referencias (modelo, diagramas, layout).
- Validación obligatoria: unicidad global, toda referencia resuelve a un elemento de tipo compatible.
- IDs de herramientas externas importadas se conservan en un campo aparte (`external_id`).

## Consecuencias
- Positivas: legibilidad en git y en consultas MCP.
- Negativas / costes: ediciones manuales que renombran ids rompen referencias → detectadas por el validador, no reparadas en silencio.

## Elementos afectados
Formato (DEC-002), motor (DEC-004), herramientas MCP de administración.

## Verificación
Pendiente: pruebas de rename con referencias en modelo, diagramas y layout; detección de duplicados tras merge.
