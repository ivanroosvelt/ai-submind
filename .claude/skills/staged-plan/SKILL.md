---
name: staged-plan
description: Crea, ejecuta, reanuda, cierra y archiva planes por etapas verificables (docs/plans) para tareas complejas T2 e integraciones en ai-submind. Usar al iniciar una tarea T2, al retomar trabajo interrumpido o al terminar/cancelar un plan.
---

# staged-plan

ID: SKL-003 · Canónico: `AGENTS.md` §8 · Plantilla: `docs/templates/plan.md`

## Entradas
Modo (crear, ejecutar, reanudar, cerrar); salida de `task-intake` e `impact-analysis`; plan existente si se reanuda.

## Procedimiento
Según el modo:

### Modos

### Crear
1. `scripts/sysq claim PLAN` → ID.
2. Copiar `docs/templates/plan.md` a `docs/plans/active/<ID>-<slug>.md`.
3. Rellenar objetivo, alcance/exclusiones, salida de `task-intake` e `impact-analysis`.
4. Etapas pequeñas e independientes, cada una con: criterios de entrada, acciones, pruebas,
   criterios de salida. Las integraciones pre/post son etapas propias.
5. `status: ready` (o `proposed` si requiere aprobación), `next_action` concreto.

### Ejecutar una etapa
`in_progress` → acciones → `executed` → verificación → `verified` con `evidence`
(comando + resultado real, o ruta de archivo). Actualizar `next_action` y la bitácora.
Si se bloquea: `blocked` + `blockers` en el plan; continuar solo con etapas independientes y seguras.

### Reanudar
1. Leer el plan: estado, última evidencia, `next_action`.
2. `git status` y `git log --oneline` desde la última evidencia; inspeccionar cambios ocurridos.
3. Revalidar criterios de entrada de la siguiente etapa (pueden haber caducado).
4. Continuar desde el primer punto realmente pendiente; registrar "reanudado" en la bitácora.

### Cerrar
1. Todas las etapas `verified` o `cancelled` (motivo). `scripts/check` en verde.
2. `status: completed` (o `cancelled`/`superseded`), resultado y referencias a commits si existen.
3. Mover a `docs/plans/archive/` (`git mv` si el archivo está versionado).
4. Reabrir un archivado: devolver a `active/`, estado `in_progress`, entrada de bitácora "reabierto: motivo";
   no borrar evidencias previas.

## Salida
Plan en `docs/plans/active/` (o archivado) con estados, evidencias y `next_action` reales.

## Límites
No marca `verified` sin evidencia; no ejecuta etapas con operaciones de `AGENTS.md` §11 sin autorización.

## Calidad
`executed` nunca se reporta como `verified`. El plan permite a otro agente continuar sin la conversación.

## Verificación
`scripts/validate-ai-environment` valida ubicación, estados, evidencias y `next_action`.
