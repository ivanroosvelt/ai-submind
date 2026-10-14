---
name: task-intake
description: Primer paso obligatorio de cualquier tarea de desarrollo en submind. Clasifica la tarea (T0/T1/T2), recorre las perspectivas de análisis, comprueba qué agentes y skills la cubren, detecta capacidades ausentes y separa hechos, inferencias y dudas. Usar al recibir una petición nueva o al retomar trabajo.
---

# task-intake

ID: SKL-001 · Canónico: `AGENTS.md` §4–§5 · Perspectivas: `.ai/registry/coverage.yaml`

## Activación
Toda petición que pueda cambiar código, modelo, planes o entorno. No hace falta para preguntas
puramente informativas.

## Entradas
Petición; `docs/plans/active/` (¿hay plan relacionado?); `git status`; modelo vigente.

## Procedimiento
1. **¿Reanudación?** Si un plan activo cubre la petición → `staged-plan` (modo reanudar) y parar aquí.
2. **Objetivo y criterios de aceptación**: una frase de objetivo y criterios verificables.
   Si no se pueden formular, es una duda bloqueante → preguntar.
3. **Localizar el modelo**: `scripts/sysq find <término>` por cada término de dominio de la petición.
   Anotar IDs encontrados o "sin elementos registrados".
4. **Clasificar** T0/T1/T2 según `AGENTS.md` §4. En duda entre dos clases, elegir la mayor.
5. **Perspectivas**: para cada entrada de `coverage.yaml`, marcar `aplica` / `no aplica: <motivo>`.
6. **Cobertura**: para cada perspectiva aplicable, capacidades → proveedores en
   `.ai/registry/capabilities.yaml`. Si el estado es `partial`/`deferred`/`gap`, decidir:
   ampliar componente (preferido), crear uno (`environment-audit`), o asumir la limitación y declararla.
7. **Ruta de ejecución**: lista ordenada de skills/agentes a usar (tabla de `AGENTS.md` §5).
8. **Hechos / inferencias / dudas** por separado.

## Salida (formato)
```
Clase: T1 · Objetivo: ... · Criterios: [...]
Elementos: REQ-003, FEAT-001 | sin elementos registrados
Perspectivas: aplica [actors, security, ...]; no aplica [data: sin persistencia, ...]
Cobertura: security → CAP-013 (partial: ...) → se asume / se amplía ...
Ruta: requirements-analysis → model-update → (implementación) → verify-change
Hechos: ... · Inferencias: ... · Dudas: ... (bloqueantes marcadas)
```
En T1 basta con incluirlo en la respuesta; en T2 se copia al plan.

## Calidad
Ninguna perspectiva omitida en silencio; seguridad, datos, contratos y migraciones siempre con motivo
explícito si no aplican.

## Límites
No implementa ni escribe fichas: solo analiza y enruta.
