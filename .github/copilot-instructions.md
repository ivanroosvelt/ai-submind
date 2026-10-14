# Instrucciones para GitHub Copilot

Este archivo es un **adaptador**. GitHub Copilot no admite importar otros archivos desde
`copilot-instructions.md`, así que el contenido de `AGENTS.md` se incrusta abajo y
`scripts/regen` lo mantiene sincronizado (el validador falla si diverge). **No editar el bloque
incrustado: editar `AGENTS.md` y ejecutar `scripts/regen`.**

## Solo para Copilot

- Copilot no carga los agentes ni skills de `.claude/` de forma garantizada. Cuando
  `AGENTS.md` indique usar un skill o agente, **leer su archivo y seguir su procedimiento**:
  skill `<nombre>` → `.claude/skills/<nombre>/SKILL.md`; agente `<nombre>` →
  `.claude/agents/<nombre>.md`.
- La revisión independiente (AGENTS.md §10) la hace una persona en el PR o una sesión
  distinta; Copilot no aprueba sus propios cambios del entorno.
- Para comandos, usar los de `scripts/` (AGENTS.md §12).

<!-- BEGIN AGENTS.md · generado por scripts/regen · sha256:9812a4f35e2023f6 · no editar -->
# AGENTS.md — submind

Fuente canónica de instrucciones para todo agente de IA que trabaje en este repositorio
(Claude Code, GitHub Copilot u otros). Los archivos específicos de cada herramienta
(`CLAUDE.md`, `.github/copilot-instructions.md`) solo adaptan este documento; si algo
contradice a este archivo, prevalece este archivo.

## 0. Estado actual

- Proyecto **greenfield**: rama `v2` iniciada sin historia previa (EDR-002).
- Producto `ai-submind` en construcción (PLAN-002): paquete npm TypeScript en `src/`, pruebas en `test/`
  (DEC-001, DEC-008). Ver `docs/system/context.md` antes de suponer cualquier comportamiento.
- Entorno de orquestación: estado y verificación en el último informe de `docs/reports/current/`.

## 1. Misión y principios

1. **Código** define el comportamiento ejecutable; el **modelo estructural** (`docs/system/`)
   describe el sistema y sus relaciones; **Git** conserva su evolución; **agentes y skills**
   mantienen el proceso que mantiene coherentes a los tres.
2. **Una fuente por concepto.** Cada regla, elemento o decisión vive en un único archivo
   canónico; el resto lo referencia por ruta o ID. No copiar reglas entre archivos.
3. **Orquestación ≠ producto.** `.ai/`, `.claude/`, `.github/` y este archivo describen *cómo*
   trabajar. `docs/system/` describe *qué* es el producto. Cambiar uno no reescribe el otro.
4. **Atomicidad.** Todo elemento con significado propio tiene ID estable y ficha individual;
   las relaciones se declaran con IDs, no solo en prosa.
5. **Evidencia antes que afirmación.** Distinguir siempre: verificado en código, declarado en
   documentación, inferido, desconocido. Nunca inventar funcionalidades, relaciones,
   resultados, commits ni decisiones.
6. **Proporcionalidad.** El proceso escala con el riesgo del cambio (§4). Los cambios triviales
   no requieren planes.

## 2. Orden de lectura y precedencia

Antes de cualquier tarea de desarrollo:

1. Este archivo.
2. Adaptador de tu herramienta (`CLAUDE.md` o `.github/copilot-instructions.md`).
3. Políticas: `.ai/policies/governance.md`, `.ai/policies/lifecycle.md`,
   `.ai/policies/verification.md`.
4. Estado del producto: `docs/system/README.md` → `docs/system/context.md` →
   `docs/system/inventory/INDEX.md`.
5. Planes en curso: `docs/plans/active/`. Si hay uno relacionado, **reanudar** (§8), no empezar otro.
6. El skill o agente que corresponda (§5), leyendo su archivo antes de seguirlo.

Precedencia ante conflicto: instrucción explícita del usuario > este archivo > políticas de
`.ai/policies/` > adaptador de herramienta > skill/agente. Un conflicto detectado se reporta
y se corrige en la fuente canónica; no se resuelve en silencio.

## 3. Mapa del repositorio

| Ruta | Contenido | Naturaleza |
|------|-----------|------------|
| `AGENTS.md` | Contrato operativo (este archivo) | canónico |
| `CLAUDE.md`, `.github/copilot-instructions.md` | Adaptadores por herramienta | adaptador |
| `.claude/agents/` | Agentes (formato nativo Claude Code) | canónico |
| `.claude/skills/` | Skills (formato nativo Agent Skills) | canónico |
| `.ai/registry/components.yaml` | IDs de agentes y skills ↔ archivo nativo | canónico |
| `.ai/registry/capabilities.yaml` | Capacidades y quién las provee | canónico |
| `.ai/registry/coverage.yaml` | Perspectivas de análisis ↔ capacidades | canónico |
| `.ai/registry/agents-index.md`, `.ai/registry/skills-index.md` | Índices | generado |
| `.ai/policies/` | Gobierno, ciclo de vida, verificación | canónico |
| `.ai/decisions/` | Decisiones sobre el entorno (EDR-NNN) | canónico |
| `docs/system/` | Modelo estructural del producto | canónico |
| `docs/system/schema.yaml` | Tipos, prefijos y relaciones permitidas | canónico |
| `docs/system/inventory/INDEX.md`, `docs/system/traceability/MATRIX.md` | Inventario y trazabilidad | generado |
| `docs/plans/active/`, `docs/plans/archive/` | Planes por etapas | operativo / histórico |
| `docs/reports/current/`, `docs/reports/archive/` | Informes | operativo / histórico |
| `docs/templates/` | Plantillas de fichas, planes, decisiones, informes | canónico |
| `scripts/` | Validadores, generadores y consulta (`sysq`) | herramienta |

Los archivos **generados** nunca se editan a mano: se regeneran con `scripts/regen`.

## 4. Protocolo de análisis de tareas

Toda tarea empieza con el skill `task-intake` (SKL-001). Resultado mínimo:

- **Clase**:
  - **T0 trivial** — sin cambio de comportamiento ni de modelo (erratas, formato).
    Implementar y verificar; sin plan.
  - **T1 estándar** — cambio acotado en uno o pocos elementos. Análisis de impacto breve
    en la respuesta o en el commit; actualizar modelo; verificar.
  - **T2 compleja** — varios elementos, integraciones, migraciones, decisiones nuevas o
    cambios del propio entorno. Plan por etapas en `docs/plans/active/` (§8).
- **Perspectivas**: recorrer `.ai/registry/coverage.yaml`; marcar cada una como
  *aplica* / *no aplica (motivo)*. Atención especial a seguridad, datos, contratos y migraciones.
- **Cobertura**: para cada perspectiva aplicable, identificar la capacidad y su proveedor en
  `.ai/registry/capabilities.yaml`. Capacidad `partial`/`deferred`/`gap` ⇒ declararlo y decidir
  si se amplía un componente existente (preferido) o se crea uno nuevo (§9).
- **Hechos vs. inferencias vs. dudas**, por separado. Las dudas bloqueantes se preguntan;
  las no bloqueantes se registran como `uncertainties` en la ficha o plan.

## 5. Selección de agentes y skills

Índices: `.ai/registry/agents-index.md` y `.ai/registry/skills-index.md`.

| Necesidad | Usar |
|-----------|------|
| Arrancar cualquier tarea | skill `task-intake` |
| Requerimientos, actores, permisos, reglas, validaciones | skill `requirements-analysis`; delegar en agente `requirements-analyst` si el análisis es amplio |
| Qué se rompe si cambio X; leer un diff | skill `impact-analysis` |
| Tarea T2 o reanudación | skill `staged-plan` |
| Crear/actualizar/retirar fichas del modelo | skill `model-update`; agente `system-modeler` para lotes grandes |
| Decisión con alternativas | skill `decision-record` |
| Cerrar cualquier cambio T1/T2 | skill `verify-change`; agente `change-verifier` para revisión independiente |
| Cambiar agentes, skills, políticas o este archivo | skill `environment-audit`; agente `environment-steward` |

La implementación de código la realiza el agente principal siguiendo este archivo
(no existe agente de implementación: CAP-011 parcial, EDR-006).

## 6. Ciclo de desarrollo

Fases obligatorias para T1/T2 (T0 solo 4 y 5). Detalle de evidencias en `.ai/policies/verification.md`.

1. **Comprensión** — leer instrucciones (§2), modelo vigente (`scripts/sysq find <término>`,
   `scripts/sysq show <ID>`), código y pruebas relevantes; fijar objetivo y criterios de aceptación.
2. **Impacto** — `impact-analysis`: elementos afectados (`scripts/sysq impact <ID>`), riesgos,
   integraciones previas/posteriores, perspectivas sin cobertura, fichas a modificar.
3. **Planificación** — unidades pequeñas con resultado y prueba cada una; en T2, plan con etapas
   y puntos de reanudación.
4. **Implementación** — cambios acotados, sin refactorizaciones ajenas; **modelo estructural
   actualizado en la misma unidad lógica** (mismo commit o mismo PR); decisiones nuevas registradas.
5. **Verificación** — pruebas pertinentes, validadores (`scripts/check`), contratos, referencias,
   contradicciones código/documentación, criterios de aceptación. Editar archivos no es éxito.
6. **Cierre** — `scripts/regen`, evidencias registradas, estado real de cada etapa, plan
   archivado si terminó, resumen con implementado / verificado / pendiente / bloqueado.

## 7. Modelo estructural del producto

- Convenciones completas: `docs/system/conventions.md`. Esquema: `docs/system/schema.yaml`.
- IDs `PREFIJO-NNN`, únicos, permanentes, nunca reutilizados. Reservar con
  `scripts/sysq claim <PREFIJO>` (escribe el ledger). Retirar = `status: retired`, nunca borrar la ficha.
- Las relaciones se declaran **solo en el origen** con las claves de `schema.yaml`; las
  inversas las calcula `scripts/sysq`. No mantener grafos duplicados a mano.
- `implementation` y `evidence` separan *existe documentado* de *existe en código*:
  `implemented`/`verified` exigen rutas en `code` (y pruebas para `verified`), comprobadas por el validador.
- La ficha describe el **estado vigente**. La historia está en Git; enlazar commits solo si existen
  (nunca inventar hashes ni marcar como integrado algo sin commit).
- Si cambia el comportamiento de un elemento: actualizar ficha, relaciones, validaciones y pruebas
  relacionadas, registrar la decisión si cambió, identificar incompatibilidades/migraciones.

## 8. Planes, etapas y reanudación

- Planes T2 en `docs/plans/active/PLAN-NNN-<slug>.md` desde `docs/templates/plan.md`.
- Estados de plan: `proposed, ready, in_progress, blocked, verified, completed, cancelled, superseded`.
  Estados de etapa: `proposed, ready, in_progress, blocked, executed, verified, cancelled`.
  **`executed` ≠ `verified`**: verificada exige `evidence`.
- Todo plan activo mantiene `next_action` (punto de reanudación) actualizado.
- **Reanudar**: localizar plan activo → leer estado y última evidencia → `git status` y
  `git log` desde la última evidencia → revalidar criterios de entrada de la siguiente etapa →
  continuar desde el primer punto realmente pendiente. No depender del historial de conversación.
- Al terminar o cancelar: mover a `docs/plans/archive/` conservando ID, resultado, etapas y evidencias.
  Reabrir un plan archivado se registra en su sección de bitácora; no se sobrescribe la evidencia.

## 9. Integraciones previas y posteriores

`impact-analysis` detecta integraciones necesarias (esquemas antes de servicios, migraciones antes
de habilitar funciones, contratos antes que consumidores, clientes generados después de cambiar una
API, e2e tras conectar sistemas, permisos tras nuevos actores, trazabilidad tras cambios de dominio).
Cada integración del producto se documenta como ficha `INT-NNN` (`docs/templates/integration.md`)
y se ejecuta como etapas de un plan. Operaciones externas: ver §11.

## 10. Mantenimiento del entorno (agentes, skills, políticas)

- Ciclo de vida completo (crear / actualizar / retirar, cuándo auditar): `.ai/policies/lifecycle.md`.
- Ampliar un componente existente antes que crear uno nuevo. No crear un skill por cada tarea puntual.
- Todo cambio de componente actualiza en la misma operación: archivo nativo,
  `.ai/registry/components.yaml`, `.ai/registry/capabilities.yaml` si cambia la cobertura,
  `scripts/regen`, y una EDR si cambia una regla.
- **Cambios autorreferenciales** (instrucciones, skills, agentes, políticas, validadores): un
  agente no valida su propio cambio. Requieren `scripts/check` en verde y revisión del agente
  `change-verifier` o de una persona. Los que tocan seguridad, permisos, aprobaciones, secretos o
  capacidad de borrar datos requieren **aprobación humana explícita**.
- **Condición de parada**: como máximo dos iteraciones de modificación del entorno por tarea sin
  mejora verificable (un error menos en validadores, una capacidad más cubierta, una prueba más);
  después, detenerse y reportar.

## 11. Seguridad y operaciones destructivas

Requieren autorización explícita del usuario en la conversación actual (la autorización no se hereda
entre tareas): borrar archivos o ramas ajenos a la tarea, `git push --force`, reescritura de historia,
`git reset --hard`, despliegues, migraciones de datos, llamadas a servicios externos que publiquen o
modifiquen datos, cambios de permisos o de configuración de CI/secretos.

Nunca: commitear secretos, credenciales o datos personales; desactivar validadores para "pasar";
afirmar resultados no ejecutados. Commits y push solo cuando el usuario lo pida.

## 12. Verificación

| Comando | Qué valida |
|---------|------------|
| `scripts/check` | Todo lo siguiente + pruebas de las herramientas + `npm run check` del producto (tipos, lint, formato, Vitest; requiere `npm ci`). Lo ejecuta CI |
| `scripts/validate-ai-environment` | Entradas, adaptadores, registro, formato nativo, cobertura, planes, ledger, referencias, duplicidades |
| `scripts/validate-system-model` | Fichas, IDs, relaciones, rutas de código/pruebas, implementación vs evidencia, generados al día |
| `scripts/validate-system-model --since <rev>` | Además avisa si cambió código sin cambiar el modelo |
| `scripts/regen` | Regenera inventario, matriz, índices y bloque embebido de Copilot |

Errores bloquean; advertencias se revisan y se justifican en el cierre.

## 13. Criterios de finalización y reporte

Una tarea T1/T2 está terminada cuando: criterios de aceptación cubiertos con evidencia;
`scripts/check` sin errores; modelo y generados actualizados; decisiones registradas;
plan archivado o con `next_action` vigente. El reporte final distingue **implementado,
verificado, pendiente y bloqueado**, e incluye pruebas ejecutadas con su resultado real,
riesgos y limitaciones.

## 14. Convenciones

- Idioma (EDR-007): **inglés** para código y pruebas (`src/`, `test/`, `scripts/`), especificación (`spec/`)
  y modelo estructural (`docs/system/`, plantillas de fichas); **español** para el resto de la documentación
  (este archivo, adaptadores, `.ai/`, `.claude/`, planes, informes). Identificadores, nombres de archivos de
  agentes/skills y claves de esquema en inglés (`kebab-case` / `snake_case`).
- Commits: Conventional Commits en español (`feat(core): ...`), referenciando IDs afectados
  en el cuerpo (`Refs: REQ-001, FEAT-002`).
- Decisiones del producto: `docs/system/decisions/DEC-NNN-*.md`. Decisiones del entorno:
  `.ai/decisions/EDR-NNN-*.md`.
<!-- END AGENTS.md -->
