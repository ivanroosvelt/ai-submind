---
id: PLAN-002
title: "Estructura base de ai-submind: gestor de diagramas en knowledge/ con motor propio, MCP y UI JointJS"
status: in_progress
created: 2026-10-14
updated: 2026-10-14
class: T2
related: [DEC-001, DEC-002, DEC-003, DEC-004, DEC-005, DEC-006, DEC-007, DEC-008, EDR-006, REP-003]
blockers: []
next_action: "S6 (consultas y búsqueda léxica): diseño con subagente Plan, implementación con subagentes, revisión change-verifier."
stages:
  - id: S1
    name: "Decisiones aceptadas y modelo estructural registrado"
    status: verified
    evidence: "2026-10-14 scripts/check: entorno 0 errores 0 advertencias; modelo 86 elementos 0 errores 0 advertencias; 42 pruebas OK. Fichas ACT-001..004, REQ-001..040, NFR-001..011, VAL-001..007, FEAT-001..009, ENT-001..005, API-001..003; DEC-001..007 active con affects."
  - id: S2
    name: "Especificación del formato y JSON Schema (clases, secuencia, layout)"
    status: verified
    evidence: "2026-10-14 spec/format/README.md + schema/1.0 (defs, ai-submind, model, layout) compilan en Ajv 8.20.0 Ajv2020 strict. Prototipo desechable (scratchpad check.mjs: schema + pasada referencial + canonicalizador): valid/garaje 0 hallazgos e idempotente; 32/32 casos invalid/ con exactamente el conjunto de códigos esperado; canonical/input reescrito = canonical/expected. Revisión independiente change-verifier: aprobado con observaciones (H1-H12), corregidas H1-H11; H12 reproducibilidad pendiente hasta S4. Ficha API-004. scripts/check: entorno 0/0; modelo 87 elementos 0 errores 0 advertencias; 42 pruebas OK."
  - id: S3
    name: "Andamiaje del paquete TypeScript, pruebas y code_roots"
    status: verified
    evidence: "2026-10-14 DEC-008 (paquete único, Vitest 5.0.4, ESLint 10.12.0 + typescript-eslint 8.71.2, Prettier 3.9.10, TypeScript 6.0.3) y EDR-006 (scripts/check ejecuta npm run check; CI con setup-node + npm ci, aprobado por el usuario como G3). npm ci + scripts/check: entorno 0/0; modelo 0/0; 42 pruebas herramientas OK; producto typecheck+lint+formato OK, 1 prueba Vitest OK. npm run build genera dist/; node dist/cli/main.js imprime ai-submind. Negativos: sin node_modules → exit 1 con 'npm ci'; error de tipos en src/ → exit 1. code_roots [src/]. Build de UI diferido a S9 (sin código de UI). Revisión change-verifier: aprobado con observaciones (H1-H10), corregidas H1-H6, H8 (a S12), H10; re-revisión aprobada (devEngines aplicado por npm 10.9.8, control negativo EBADDEVENGINES). Commit 6392f37; CI validate run 38640883010 success (Python 3.10 y 3.12, Node v22.23.3: npm ci, entorno 0/0, modelo 0/0, 42 pruebas, producto lint/formato/Vitest 1/1)."
  - id: S4
    name: "Núcleo de formato: serialización canónica y validación"
    status: verified
    evidence: "2026-10-14 src/format (canonical, document, semantic, knowledge, schema, findings, types) con Ajv 8.20.0 y dependency-cruiser 18.6.0 (DEC-009). test/format/corpus.test.ts: garaje 0 hallazgos y 5/5 archivos canónicos; 33/33 casos invalid/ con exactamente sus códigos; canonical/input (manifiesto, pedidos, sequence) = expected byte a byte e idempotente (cierra H12 de S2). test/format/rules.test.ts: 32 pruebas (symlinks, FIFO, directorios no previstos, UTF-8, U+2028/CR, lectura tolerante con punteros originales, conjuntos, CODE_REF_MISSING, ciclos, BigInt, escapes). scripts/check: entorno 0/0; modelo 0/0; 42 pruebas herramientas; producto typecheck+lint+formato+deps+78 Vitest OK. Mutaciones: ciclo temporal → npm run deps exit 1; sin mapeo de punteros o con regex /m → fallan sus pruebas. change-verifier: aprobado con observaciones (H1-H12, corregidas salvo H9 → S5 y H12 → commit aparte); re-revisión aprobada con observaciones (N1-N7, corregidas)."
  - id: S5
    name: "Motor de conocimiento: carga, grafo, transacciones, rename, recarga"
    status: verified
    evidence: "2026-10-14 src/engine (engine, store, rename, ids, diff, errors) sobre src/format; DEC-011. test/engine/engine.test.ts (32): carga ok/degradada, limpieza de temporales, escritura canónica con revisión, creación con expectedRevision null, lote inválido sin escritura (snapshot idéntico), unknown key rechazada antes de serializar (H9), versión distinta rechazada, lote aceptado en knowledge/ degradado si no añade errores, rutas fuera/no documento/duplicadas, symlink no escrito, DOCUMENT_INVALID en invalid_parse y read_only, REVISION_CONFLICT por revisión vieja y por cambio externo no recargado, transacciones concurrentes serializadas, rename (prefijos, referencias, layout, mover modelo y layout, colisión directa y derivada, INVALID_ID, NOT_FOUND, RENAME_BLOCKED, errores previos renombrados), recarga con diff semántico sin eco de escrituras propias, watcher agrupa ráfaga en un evento, archivo que se invalida y se recupera. test/engine/ids.test.ts (44): seg/slug, tabla §3.3, sufijos, truncado y límites de longitud. Mutaciones (chequeo de disco, validación previa, regla de errores nuevos, traducción en rename, bloqueo): cada una rompe una prueba. Watcher 5/5 corridas estables. Regla depcruise engine-on-format con control negativo. Medición 10 010 elementos: open 121 ms, transacción 50 ms, rename 56 ms, recarga 44 ms. scripts/check: entorno 0/0; modelo 91 elementos 0/0; 42 pruebas herramientas; producto typecheck+lint+formato+deps+154 Vitest OK. change-verifier: aprobado con observaciones (H1-H10, corregidas con pruebas de regresión); re-revisión aprobada con observaciones R1-R3, corregidas (evidencia, clave por subjects vacíos, status().localError)."
  - id: S6
    name: "Consultas estructuradas y búsqueda léxica"
    status: proposed
    evidence: ""
  - id: S7
    name: "CLI y daemon por proyecto con seguridad local"
    status: proposed
    evidence: ""
  - id: S8
    name: "Servidor MCP (Streamable HTTP + proxy stdio) con tools de consulta y administración"
    status: proposed
    evidence: ""
  - id: S9
    name: "UI web JointJS: explorar y ajustar layout"
    status: proposed
    evidence: ""
  - id: S10
    name: "Integridad con git: conflictos, duplicados, referencias rotas, gitignore"
    status: proposed
    evidence: ""
  - id: S11
    name: "UI de diagramas de secuencia (etapa madura)"
    status: proposed
    evidence: ""
  - id: S12
    name: "Empaquetado npx, e2e en repo de prueba y auditoría de licencias"
    status: proposed
    evidence: ""
  - id: S13
    name: "Cierre: eliminar UMJ.pdf, regenerar, verificación independiente, archivar"
    status: proposed
    evidence: ""
---

# PLAN-002 · Estructura base de ai-submind

## Objetivo
`npx ai-submind` en cualquier repositorio levanta un servidor local que gestiona diagramas guardados como
JSON canónico en `knowledge/` (versionado con git), los valida contra un formato propio derivado de UMJ,
permite a agentes consultarlos y administrarlos vía MCP y a personas explorarlos y ajustar su layout
en una UI JointJS.

## Alcance
- Incluye: diagramas de clases (render + layout, S9) y secuencia (formato + validación en S2/S4; render y layout como etapa madura S11);
  motor embebido (DEC-004); consultas estructuradas y léxicas; daemon + proxy MCP (DEC-005); UI explorar +
  layout (DEC-006); integridad post-merge.
- Excluye (plan posterior): búsqueda semántica con embeddings (DEC-007), migraciones de formato (DEC-010), merge driver semántico de git,
  lenguaje de caminos, importadores XMI, nuevos tipos de diagrama, edición de modelo desde la UI.

## Análisis (salida de task-intake e impact-analysis)
```
Clase: T2 · Elementos previos: sin elementos registrados (modelo vacío).
Perspectivas: aplican todas. security (servidor local, escritura de archivos, MCP), data/migrations
  (versión de formato), contracts (schema, MCP, API UI), environment (CAP-011/014/015 se desbloquean).
Cobertura: CAP-011 deferred → la implementa el agente principal (AGENTS.md §5); revisar tras S3 si
  conviene skill de stack. CAP-014 deferred → cubierta por DEC-002/004; ampliar model-update/impact-analysis
  con reglas de formato tras S4. CAP-013 partial → checklist de DEC-005 en change-verifier.
  CAP-012 partial → framework de pruebas en S3.
Ruta: requirements-analysis (hecho, REP-003) → decision-record (DEC-001..007) → staged-plan (este)
  → model-update/system-modeler (S1) → implementación S2..S11 → verify-change + change-verifier (S13).
Hechos: REP-003. Inferencias: escala ~10k elementos; un usuario local. Dudas no bloqueantes: en las DEC.
```
Integraciones: S2 (contrato) antes de S4..S9; S5 antes de S6/S8/S9; S7 antes de S8/S9; S10 tras S5;
S11 tras S9/S10; S12 tras S7..S11.

## Etapas

### S1 · Decisiones aceptadas y modelo estructural registrado
- Depende de: aprobación del usuario.
- Criterios de entrada: DEC-001..007 revisadas.
- Acciones: DEC a `active`; fichas ACT/REQ/NFR/VAL/FEAT desde REP-003 Anexo A, ajustadas a las DEC;
  actualizar `docs/system/context.md` y glosario; `affects` de cada DEC.
- Pruebas: `scripts/check`.
- Criterios de salida: modelo validado, `scripts/regen` aplicado.

### S2 · Especificación del formato y JSON Schema
- Depende de: S1.
- Acciones: spec en español con cita a UMJ (sin reproducir su texto); schemas 2020-12 de `ai-submind.json`,
  modelo (clases, secuencia, relaciones, diagramas) y layout; gramática de IDs (DEC-003); orden canónico;
  ejemplos válidos e inválidos (incluido el ejemplo Car reexpresado).
- Pruebas: ejemplos válidos pasan, inválidos fallan con error esperado (en S4).
- Criterios de salida: spec + schemas + ejemplos versionados; ficha API/ENT del formato.

### S3 · Andamiaje del paquete
- Acciones: `package.json` (name y bin `ai-submind`, engines ≥22, ESM; DEC-001), tsconfig estricto, framework de pruebas
  (decidir node:test vs vitest), lint/format, build de UI; `code_roots` en `schema.yaml`; integrar pruebas
  del producto en `scripts/check`.
- Criterios de salida: `npm test` y `scripts/check` en verde con una prueba trivial.

### S4 · Núcleo de formato
- Acciones: serializador canónico; validación Ajv + pasada referencial (unicidad, idref, tipos, invariantes);
  errores con ruta JSON y código estable.
- Pruebas: ida y vuelta sin diff; ejemplos S2; marcadores de conflicto detectados.

### S5 · Motor de conocimiento
- Criterios de entrada: toda escritura pasa por la validación de schema antes de `serialize` (que descarta claves
  desconocidas: revisión S4, H9).
- Acciones: carga de `knowledge/`, grafo e índices (tipo, refs directas/inversas), transacciones por lote
  con validación previa, revisión optimista, escritura atómica, `rename` con reescritura de referencias,
  watcher con recarga y diff semántico.
- Pruebas: transacción inválida no escribe; conflicto de revisión; rename actualiza modelo/diagramas/layout;
  edición externa recargada.

### S6 · Consultas
- Acciones: listar/obtener, por tipo/propiedad, vecinos, referencias inversas, impacto, caminos simples (REQ-019, DEC-004), búsqueda léxica.
- Pruebas: corpus de ejemplo con resultados esperados.

### S7 · CLI y daemon
- Acciones: resolución de raíz (git root), `serve`, `mcp`, `status`, `stop`, `init`; lockfile y
  `runtime.json` (0600, token); HTTP en 127.0.0.1; validación Host/Origin; confinamiento de rutas.
- Pruebas: arranque doble usa el mismo daemon; lock huérfano recuperado; Origin ajeno rechazado; path traversal rechazado.

### S8 · Servidor MCP
- Acciones: `@modelcontextprotocol/server` v2; tools de consulta (S6) y administración (crear/modificar/
  eliminar elementos y diagramas, lotes, rename, validar); proxy stdio; recursos (modelos, diagramas, schema).
- Pruebas: cliente MCP real (stdio y HTTP) ejecuta flujo crear→consultar→validar; errores tipados.

### S9 · UI JointJS
- Acciones: shapes UML propias (clase, interfaz, enum, data type, relaciones); auto-layout dagre;
  zoom/pan, selección, navegación entre diagramas; mover persiste layout; refresco en vivo (SSE/WS).
  Secuencia: S11.
- Pruebas: render de ejemplos; mover nodo escribe `layout/<id>.json` canónico; verificación en navegador.

### S10 · Integridad con git
- Acciones: `init` añade `.ai-submind/` a `.gitignore`; diagnóstico post-merge (conflictos, duplicados, refs
  rotas) expuesto en CLI, MCP y UI; sin reparación silenciosa.
- Pruebas: escenario de merge conflictivo en repo temporal.

### S11 · UI de diagramas de secuencia (etapa madura)
- Depende de: S9 y S10 verificadas (UI de clases estable, layout persistente e integridad git operativos).
- Criterios de entrada: formato de secuencia (S2) validado por S4; motor y consultas cubren interacciones.
- Acciones: shapes propias de lifeline, activación, mensajes (síncrono, asíncrono, respuesta, creación,
  destrucción), fragmentos combinados con operandos y guardas, interaction use; layout de secuencia propio
  (orden de eventos = orden del array; posición horizontal de lifelines y alturas persistidas en layout);
  navegación clase ↔ lifeline.
- Pruebas: render de ejemplos de secuencia (incluidos fragmentos anidados y llamadas sin respuesta);
  reordenar lifelines persiste layout canónico; verificación en navegador.
- Criterios de salida: diagramas de secuencia explorables con layout ajustable como los de clases.

### S12 · Empaquetado y e2e
- Acciones: `npm pack`; `npx` del tarball en repo de prueba; auditoría de licencias de dependencias;
  ejemplo `.mcp.json`; README de uso.
- Pruebas: e2e completo: init → serve → MCP crea diagrama → UI lo muestra → git diff legible.

### S13 · Cierre
- Acciones: confirmar que la spec cubre lo necesario de UMJ; eliminar `UMJ.pdf` (sin trackear);
  `scripts/regen`; `verify-change`; revisión `change-verifier`; archivar plan.
- Criterios de salida: AGENTS.md §13.

## Riesgos y bloqueos
- Nombre npm: `submind` ocupado; se usa `ai-submind` (libre el 2026-10-14, DEC-001) → reconfirmar antes de publicar.
- Un archivo por modelo aumenta conflictos de merge → mitigado en S10, merge driver en plan posterior.
- Licencia de ai-submind sin definir (afecta publicación, no desarrollo).
- Daemon: procesos huérfanos y puertos → pruebas en S7.
- Dudas abiertas por etapa (de fichas `uncertainties`): S7 apagado del daemon, puerto, entrega del token al navegador; S8 si MCP puede modificar layout, init implícito en primera escritura; REQ-027 dry_run y NFR-007 umbrales sin confirmar.

## Bitácora
- 2026-10-14 · creado tras task-intake, REP-003 y respuestas del usuario (archivos, IDs, proceso, stack).
- 2026-10-14 · paquete y comando renombrados a `ai-submind` (DEC-001, DEC-005).
- 2026-10-14 · todo lo visible del producto renombrado a `ai-submind`: servidor MCP, `ai-submind.json`, `.ai-submind/` (DEC-001, DEC-002, DEC-005, DEC-007).
- 2026-10-14 · usuario aprueba DEC-001..007 y el plan; render de secuencia pasa a etapa madura S11 (empaquetado S12, cierre S13). Plan in_progress; S1 in_progress.
- 2026-10-14 · S1 verified (system-modeler; evidencia en front matter). REQ-019 caminos simples activado y añadido a S6 por DEC-004.

- 2026-10-14 · S2: usuario decide IDs globales simples (refs entre modelos sin cualificar), versión posterior → solo lectura, extensiones v1 `documentation`, `tags`, `code_refs`, `stereotypes`. Spec en `spec/format/`, `format_version` `MAYOR.MENOR` por archivo. Desviaciones de UMJ en spec §12. Nueva API-004; uncertainties resueltas en DEC-002/003, ENT-001..005, VAL-002/003/004/007, NFR-011 (active), FEAT-003.
- 2026-10-14 · S2 revisada por change-verifier: aprobado con observaciones. Corregido en spec: versión posterior → lectura tolerante en solo lectura (H1), reglas entre fases (H2), reglas de `rename` con cascada de prefijo, `RENAME_COLLISION`/`RENAME_BLOCKED` (H3, entrada de S5), derivación NFC/recortes/truncado (H4), mapeo `CODE_REF_INVALID` y `codes` como conjunto (H5), `visibility` (H6), escapes y orden en §9 (H7), patrón estricto de `code_refs.path` (H8); fichas REQ-009, DEC-002, ENT-002, ENT-004 (H9); corpus ampliado con kinds found/unknown, indicadores, style.text y 4 casos inválidos (H10); `UMJ.pdf` en `.git/info/exclude` (H11). H12: el corpus solo se comprueba con un prototipo del scratchpad hasta que S4 lo convierta en pruebas versionadas.

- 2026-10-14 · S3: usuario elige paquete único, Vitest y ESLint + typescript-eslint + Prettier (DEC-008) y aprueba el cambio de CI (EDR-006, G3). Build de UI con Vite diferido a S9; herramienta de ciclos (NFR-008) diferida a S4. `"private": true` hasta S12.
- 2026-10-14 · S3 verified: commit 6392f37 empujado a origin/v2; workflow validate 38640883010 en verde. devEngines ajustado a `^22.13.0 || ^24.0.0 || >=26.0.0` (Vitest 5 excluye Node 25). Avisos de CI no bloqueantes: acciones v4/v5 sobre Node 20 deprecado; ubuntu-latest migra a Ubuntu 26 desde 2026-10-19.

- 2026-10-14 · S4: usuario elige Ajv 8 y dependency-cruiser (DEC-009). Spec §10.4/§11: versión anterior sin migración (0.x) se trata como posterior (solo lectura). NFR-008 resuelta. VAL-002 `partial`: derivación de IDs (§3.3) pasa a S5. S4 executed; pendiente change-verifier.
- 2026-10-14 · S4 revisada por change-verifier: aprobado con observaciones (H1-H12). Corregidas H1 (punteros de documentos `read_only` mapeados al archivo leído), H2 (FEAT-003 `partial`), H3 (API-004 `partial`, sin repetir §11; NFR-011), H4 (marcador de conflicto tras U+2028), H5 (`uniqueItems` en `members`, `covered` y `elements` de diagrama + caso `schema-duplicate-reference-in-set`), H6 (multiplicidades con BigInt), H7 (rama `then` por `$ref` reemplaza, en línea refina), H8 (symlink hacia `.ai-submind/`, directorios no previstos, FIFO), H10 (caso canónico `sequence` y pruebas de lectura tolerante con fragmentos y layout), H11 (context). H9 → criterio de entrada de S5. H12: cambios del entorno (EDR-007, PLAN-003) van en commit aparte. La regla «versión anterior sin migración = solo lectura» (spec §11) es propuesta del agente: pendiente de confirmación del usuario.
- 2026-10-14 · re-revisión change-verifier: aprobado con observaciones N1-N7, corregidas: N1 VAL-004 `partial` y atribución separada; N2 lectura tolerante deduplica conjuntos; N3 evidencia; N4 mensaje de symlink; N5 pruebas de `covered` y `elements` repetidos; N6 marcadores tras CR; N7 aviso cuando la lectura tolerante no recupera nada. S4 verified.
- 2026-10-14 · PLAN-003 (EDR-007) traduce spec, corpus y modelo al inglés: la evidencia de S2/S4 cita nombres anteriores del corpus (`valid/garaje` → `valid/garage`, `pedidos` → `orders`, casos `invalid/` en inglés) y slugs anteriores de fichas; los IDs no cambian.

- 2026-10-14 · usuario confirma la regla «versión anterior sin migración = solo lectura» (spec §11) y pide un mecanismo de actualización sencillo: DEC-010 (proposed), guías versionadas from→to para agentes LLM con corpus antes/después y operación `migrate`; se implementa con el primer cambio de versión del formato (fuera de PLAN-002).

- 2026-10-14 · S5: usuario elige `node:fs.watch` recursivo, atomicidad por archivo y alcance documentos + rename + derivación (DEC-011). Crear/actualizar/borrar elementos con derivación y cascade (REQ-023/024) pasa a S8 sobre las transacciones. VAL-002 `verified`; FEAT-002 `partial`. Criterio de entrada H9 cumplido: `transact` valida las fases 1–3 sobre los datos tal como llegan antes de `serialize`. S5 executed; pendiente change-verifier.
- 2026-10-14 · S5 revisada por change-verifier: aprobado con observaciones (H1-H10), corregidas con pruebas de regresión: H1 (cada lote y rename recargan antes de validar; lote sobre documento cambiado → REVISION_CONFLICT), H2 (`status().watchError`; `error` solo con listener), H3 (hallazgos de fase 4 con `subjects`, spec §10.4; comparación por sujetos), H4 (mover solo archivos nombrados por su propio ID), H5 (rutas de documento no leídas bloquean rename), H6 (truncado recorta finales inválidos; sin espacio → INVALID_ID; spec §3.3), H7 (`representsName`), H8 (`.ai-submind` roto no impide abrir; TOCTOU y symlinks en DEC-011), H9 (datos no JSON → VALIDATION_FAILED; IDs resultantes inválidos → INVALID_ID), H10 (REQ-026 → DEC-011; `maxWaitMs`; lote vacío sin evento). scripts/check: entorno 0/0; modelo 0/0; 42 pruebas herramientas; 154 Vitest OK.
- 2026-10-14 · re-revisión change-verifier de S5: aprobado con observaciones R1-R3, corregidas. S5 verified; commit pedido por el usuario.

## Resultado (al cerrar)
