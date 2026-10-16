---
name: requirements-analysis
description: Descompone una petición de producto de ai-submind en requerimientos atómicos y verificables - actores, permisos, casos de uso, reglas de negocio, entradas/salidas, validaciones, estados, errores y requisitos no funcionales - separando hechos de supuestos. Usar ante cualquier funcionalidad nueva, cambio de comportamiento o petición ambigua.
---

# requirements-analysis

ID: SKL-008 · Canónico: `AGENTS.md` §4, §7 · Contexto: `docs/system/context.md`

## Entradas
Petición del usuario o documento fuente; `docs/system/` vigente.

## Procedimiento
1. **Fuente**: citar de dónde sale cada requisito (usuario, documento, código). Sin fuente = supuesto.
2. **Actores**: quién usa o es afectado (personas, sistemas externos). Buscar existentes
   (`scripts/sysq list ACT`). Permisos de cada uno sobre la funcionalidad.
3. **Requerimientos atómicos**: uno por comportamiento observable. Formato:
   "<Actor> puede/debe <acción> para <resultado>" + criterios de aceptación verificables
   (dado / cuando / entonces).
4. **Por cada requerimiento** revisar: reglas de negocio · entradas, salidas y validaciones ·
   estados y transiciones · errores y casos límite · datos que crea/lee/modifica ·
   privacidad y seguridad · requisitos no funcionales (rendimiento, disponibilidad, accesibilidad).
5. **Validaciones** con significado propio (reutilizadas o con reglas no triviales) → ficha VAL.
6. **Conflictos**: contradicciones con REQ/DEC existentes → señalar, no resolver en silencio.
7. **Preguntas**: lista priorizada; marcar las bloqueantes.
8. Si hay que escribir fichas → `model-update`.

## Salida
Lista de ACT/REQ/NFR/VAL propuestos con criterios de aceptación; tabla de perspectivas; preguntas.

## Ejemplo de criterio de aceptación
"Dado un usuario sin permiso de edición, cuando intenta guardar, entonces el sistema rechaza la
operación y no modifica el documento." (verificable, sin detalle de implementación)

## Límites
No decide diseño técnico ni marca `active` sin confirmación.
