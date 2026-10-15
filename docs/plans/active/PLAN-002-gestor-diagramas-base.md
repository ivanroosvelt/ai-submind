---
id: PLAN-002
title: "Estructura base de ai-submind: gestor de diagramas en knowledge/ con motor propio, MCP y UI JointJS"
status: in_progress
created: 2026-10-14
updated: 2026-10-15
class: T2
related: [DEC-001, DEC-002, DEC-003, DEC-004, DEC-005, DEC-006, DEC-007, DEC-008, EDR-006, REP-003]
blockers: []
next_action: "S10: integridad con git (diagnóstico post-merge en CLI, MCP y UI); empezar por task-intake/impact-analysis de S10."
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
    status: verified
    evidence: "2026-10-14 src/query (query, graph, traverse, filters, meta, limits, errors, lexical, text) sobre format y engine; RefSite.source, IndexedElement.parent y Engine.generation; DEC-012 y DEC-013. Diseño con subagente Plan; implementación con dos subagentes en paralelo (léxico y estructural). test/query: query.test.ts (23: listados, get con NOT_FOUND/AMBIGUOUS_ID, documento excluido, find con filtros y paginación, relations de Car 9 salientes/12 entrantes, grupos, impact con profundidad/tipos/ciclos, paths shortest/all/dirigidos/hubs/clique con truncado, search por fachada con filtros e incremental tras transact/rename/reload y reconstrucción por salto de generación), lexical.test.ts (10, incluida equivalencia incremental = reconstrucción en 15 consultas), text.test.ts (5). Diferencias con el diseño: search rental → [garage, Car]; 'fuel type enumeration' necesita el filtro type. Control negativo depcruise query-on-format-engine. Medición ~10,5k elementos: p95 find 2,5 ms, relations 0,02, impact 1,4, paths 15,7, search 7,6 (índice léxico 138 ms). Revisión change-verifier: aprobado con observaciones (H1-H10), corregidas: H1 eventos pendientes acotados (MAX_PENDING), H2 texto de búsqueda ≤1000 caracteres y ≤32 términos, H3 argumentos objeto plano con claves conocidas, H7 impacto truncado = prefijo del completo, H8 BFS de distancias cortado por presupuesto → truncated (sin prueba: requiere >200k nodos), H4/H9/H10 documentación y trazabilidad; mutaciones de H1 y H7 rompen sus pruebas. scripts/check: entorno 0/0; modelo 93 elementos 0/0; 42 pruebas herramientas; producto typecheck+lint+formato+deps+197 Vitest OK."
  - id: S7
    name: "CLI y daemon por proyecto con seguridad local"
    status: verified
    evidence: "2026-10-14 src/daemon (project, runtime, server) y src/cli (main, commands, node-version) según DEC-005/DEC-014; regla depcruise daemon-on-format-engine-query. test/daemon 39 pruebas (project 10+, server, cli con dist/ construido en beforeAll): arranque concurrente, carrera multiproceso de lock huérfano (8 rondas × 6 procesos; el código previo falla 3/3), guardia de recuperación, runtime.json 0600, .ai-submind 0700, daemon.log 0600, Host/Origin ajenos/ausentes/mayúsculas/null → 403, sin token → 401, Bearer y ?token= → 303 + cookie HttpOnly SameSite=Strict, solo 127.0.0.1, 7777 con respaldo, puerto explícito ocupado → error, inactividad y petición en curso, /api/stop, petición malformada → 400 sin caída, handler que lanza → 500, serve sin knowledge/ (REQ-002 CA1), init sin sobrescribir, validate 0/1/2, symlinks fuera de la raíz y raíz rechazados, ensureDaemon reutiliza pid, guarda de Node. Mutaciones: sin Origin o sin token fallan sus pruebas. scripts/check: entorno 0/0; modelo 94 elementos 0/0; 42 pruebas herramientas; producto typecheck+lint+formato+deps+236 Vitest OK; test/daemon 3/3 estables; sin daemons residuales. change-verifier: rechazado (H1-H10) → corregido → re-revisión aprobada con observaciones R1-R5, corregidas (R4 zombi en stop: informativo para S8)."
  - id: S8
    name: "Servidor MCP (Streamable HTTP + proxy stdio) con tools de consulta y administración"
    status: verified
    evidence: "2026-10-15 src/engine/edit.ts (create/update/delete con cascade, edit_diagram, lotes, dryRun, init implícito), dryRun y builder en engine.ts, src/mcp (tools, http), src/cli/proxy.ts y subcomando mcp, /mcp en el daemon; deps exactas @modelcontextprotocol/server 2.3.1, client 2.3.1, zod 4.6.7 (Apache-2.0/MIT/ISC); DEC-015, DEC-016. Pruebas: test/engine/edit.test.ts (cascade de cada elemento de garage sin errores ni avisos nuevos, interacción, lifeline, mensaje, __proto__), test/mcp tools/http/proxy (cliente MCP real por InMemory, HTTP y stdio: crear→consultar→validar, errores tipados, dryRun sin escritura, init implícito, 401/403 en /mcp, confinamiento de rutas, proxy arranca daemon, reintento por ECONNREFUSED y 401, stop con proxy conectado). Mutaciones: cada corrección revertida rompe su prueba. Watcher de S5: pruebas esperan a que FSEvents esté activo (writeUntilChange); 80/80 bajo 8 procesos paralelos (antes 7/64 fallos); DEC-011 lo registra. scripts/check ×3: entorno 0/0; modelo 96 elementos 0/0; 42 pruebas herramientas; producto typecheck+lint+formato+deps+272 Vitest OK; sin daemons residuales. change-verifier: aprobado con observaciones H1-H7 (corregidas); re-revisión aprobada con observaciones R1-R4 (R1, R2 corregidas; R3 informativa; R4 = cambio del entorno revisado aparte). README actualizado por documenter (AGT-005)."
  - id: S9
    name: "UI web JointJS: explorar y ajustar layout"
    status: verified
    evidence: "2026-10-15 commit d4c5436 (pushed origin/v2). scripts/check verde (entorno 0/0, modelo 0/0, 42 pruebas herramientas, producto typecheck+lint+formato+deps+294 Vitest). change-verifier: aprobado con observaciones H1-H9; H1-H3, H6-H9 corregidas, H4 → S12, H5 fuera del commit. Verificación en navegador del usuario (Safari, garaje): detectó desborde de texto y solapes por tamaños/posiciones heredados del ejemplo → tamaño explícito = mínimo, ejemplo regenerado, botón Auto-layout; re-verificación OK: Auto-layout guardó layout/overview.json (13 nodos, 09:33) sin solapes y con el texto dentro."
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
- Acciones (DEC-014): resolución de raíz (git root), `serve`, `status`, `stop`, `init`, `validate`; lockfile y
  `runtime.json` (0600, token); HTTP en 127.0.0.1:7777 con respaldo; token URL → cookie; validación Host/Origin;
  apagado por inactividad; `ensureDaemon` para el proxy de S8; confinamiento de `--knowledge`. El subcomando
  `mcp` (proxy stdio) pasa a S8 porque depende del SDK MCP.
- Pruebas: arranque doble usa el mismo daemon; lock huérfano recuperado; Origin/Host ajenos rechazados; sin token
  rechazado; solo loopback; `--knowledge` fuera de la raíz rechazado; init no sobrescribe; validate con código de salida.

### S8 · Servidor MCP
- Acciones: subcomando `mcp` (proxy stdio sobre `ensureDaemon` de S7); `@modelcontextprotocol/server` v2; tools de consulta (S6) y administración (crear/modificar/
  eliminar elementos y diagramas, lotes, rename, validar); proxy stdio; recursos (modelos, diagramas, schema);
  init implícito en la primera escritura y `dry_run` en toda escritura (DEC-015); el layout solo se limpia en cascada.
- Pruebas: cliente MCP real (stdio y HTTP) ejecuta flujo crear→consultar→validar; errores tipados; dry_run no escribe;
  primera escritura sin knowledge/ lo inicializa.

### S9 · UI JointJS
- Decisiones: DEC-017 (TypeScript sin framework, Vite → `dist/ui/`, SSE, tamaño determinista de shapes y
  módulo de layout común con `@dagrejs/dagre`, usado por la UI y la tool MCP).
- Acciones: shapes UML propias (clase, interfaz, enum, data type, relaciones); auto-layout dagre;
  zoom/pan, selección, navegación entre diagramas; mover persiste layout; refresco en vivo (SSE/WS);
  tool MCP de auto-layout de un diagrama con los tamaños de las shapes (DEC-015).
  Secuencia: S11.
- Pruebas: render de ejemplos; mover nodo escribe `layout/<id>.json` canónico; verificación en navegador.

### S10 · Integridad con git
- Acciones: `.ai-submind/` ya se autoignora desde S7 (DEC-014); diagnóstico post-merge (conflictos, duplicados, refs
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
  avisos de licencia de terceros (MPL-2.0 de `@joint/core`, empaquetado en `dist/ui`) en `dist/ui` y LICENSE del paquete (H4 de S9);
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
- Dudas abiertas por etapa (de fichas `uncertainties`): S7 apagado del daemon, puerto, entrega del token al navegador; NFR-007 umbrales sin confirmar (las de S8 se resolvieron en DEC-015).

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
- 2026-10-14 · S6: diseño con subagente Plan; defaults elegidos por el agente, pendientes de confirmación del usuario (pertenencia a paquete cuenta en impacto y caminos; asociación no dirigida en ambos sentidos; argumentos fuera de rango rechazados; prefijo activo; ñ → n; literales, roles y guardas sin indexar) registrados en DEC-012/DEC-013. S6 executed; pendiente change-verifier.
- 2026-10-14 · S6 revisada por change-verifier: aprobado con observaciones H1-H10, corregidas (detalle en la evidencia). DEC-012 y DEC-013 quedan `proposed` hasta que el usuario confirme los defaults (H6). S6 verified; commit y push pedidos por el usuario.
- 2026-10-14 · reanudado en S7 (rama v2, implementación nueva; árbol limpio salvo `graft/` sin trackear, ajeno). Usuario decide apagado stop + inactividad, puerto 7777 con respaldo, token URL → cookie y `knowledge/.ai-submind/` autoignorado: DEC-014 (active). `mcp` pasa a S8; S10 ya no edita el `.gitignore` raíz. S7 in_progress.
- 2026-10-14 · S7 executed (subagente implementador): src/daemon (project, runtime, server), src/cli (commands, node-version), test/daemon 27 pruebas; 224 Vitest OK. Desviaciones: `validate` solo lee (validateKnowledgeDir) para no vaciar `.ai-submind/tmp` de un daemon vivo; `startDaemon` devuelve `running` si otro daemon es dueño. Lint local falla solo por `packages/*/dist` (restos ignorados por git de la rama anterior). Pendiente change-verifier.
- 2026-10-14 · usuario confirma los defaults de DEC-012 y DEC-013 → active.
- 2026-10-14 · usuario autoriza borrar restos de la rama anterior: `packages/`, `.superpowers/`, `.worktrees/` (ignorados por git). `scripts/check` pasa completo en local.
- 2026-10-14 · S7 revisada por change-verifier: rechazado (H1 petición malformada tumbaba el daemon, H2 token en daemon.log 0644, H3 carrera de recuperación del lock con dos daemons, H4 FEAT-001/API-003 → partial, H5 symlinks colgantes, H6 raíz como knowledge, H7 cookie no aislada por puerto → DEC-014, H8 validate con --knowledge inexistente → exit 2, H9 limpieza de procesos y pruebas negativas, H10 → test_code en NFR-004/NFR-006). Corregido; re-revisión aprobada con observaciones R1-R5, corregidas. R4 (stop ve zombis como vivos si el padre no recoge al hijo) queda como nota para el proxy de S8. S7 verified.
- 2026-10-14 · reanudado en S8 (S7 en 36201b2, DEC-012/013 en c957abe; árbol limpio salvo `.gitignore`/`.ignore` de graft, ajenos). Usuario decide auto-layout desde MCP (tool en S9, necesita shapes), init implícito en la primera escritura y `dry_run` en S8: DEC-015 (active); REQ-027 active. S8 in_progress.
- 2026-10-14 · S8 executed (subagente implementador, diseño aprobado + DEC-015/DEC-016): deps exactas `@modelcontextprotocol/server`/`client` 2.3.1 (Apache-2.0) y `zod` 4.6.7 (MIT; transitivas MIT/ISC); engine `transact` con `dryRun` y builder dentro de la transacción, `rename` con `dryRun`; `src/engine/edit.ts` (create con IDs derivados también en hijos inline, merge patch, delete con `REFERENCED`/cascade, `edit_diagram`, lotes, init implícito, limpieza de layout; `MANIFEST` común con `init`); `src/mcp/` (15 tools, 3 recursos, errores tipados; ruta `/mcp` stateless tras token/Host/Origin); `ai-submind mcp` (proxy stdio con reintento único vía `ensureDaemon` ante ECONNREFUSED/401); regla depcruise `mcp-on-format-engine-query`. Pruebas nuevas: 29 (engine +4, edit 13, mcp tools 6, http 4, proxy 2); `scripts/check` verde (entorno 0/0, modelo 96 elementos 0/0, 42 pruebas herramientas, producto 265 Vitest); test/mcp 3/3 estable; sin daemons residuales. Desviaciones: `fail()` interno; errores no tipados → error genérico de tool del SDK; `affected.id` = elemento que contenía la referencia; borrar un `association_end` → INVALID_ARGUMENT; ocurrencias sin id → `<interacción>.occ`; REQ-023 CA3 redactado como «null en patch = ausente = desconocido»; unidades 2–4 con pruebas escritas juntas antes de implementar; reintento por 401 sin prueba propia; `dist/` se construye una vez en `test/build-dist.ts` (globalSetup de Vitest) en vez de un `beforeAll` por suite (cli y proxy): con dos builds concurrentes una ejecución de `scripts/check` falló por timeout en la prueba de watcher de engine; tras el cambio `scripts/check` 3/3 verde. Pendiente change-verifier.
- 2026-10-15 · S8 revisada por change-verifier: aprobado con observaciones H1-H7; corregidas con pruebas de regresión (TDD): H1 cascade borra mensajes cuyo evento exige su `kind` y el dueño de una lista `minItems: 1` vaciada (`covered`, `operands`, `elements` de diagrama sequence → borra diagrama y layout); borrado en cascada de cada elemento del garaje en dry run sin errores (salvo `association_end` → INVALID_ARGUMENT, documentado en DEC-016); H2 claves `__proto__`/`constructor`/`prototype` → INVALID_ARGUMENT en `data` y `patch`, `merge` con `Object.hasOwn`; H3 `destructiveHint: true` en todas las escrituras salvo `create_element`; H4 `initialized` aclarado en DEC-015/API-001; H5 pruebas de confinamiento por tools MCP y de reintento del proxy por 401 (daemon reiniciado por otro proceso en el mismo puerto); H6 orden y punteros de `affected` documentados en API-001; H7 `test/build-dist.ts` muestra stdout/stderr del build. Mutaciones: cada corrección revertida rompe su prueba. `scripts/check` verde (entorno 0/0, modelo 96 elementos 0/0, 42 pruebas herramientas, producto 271 Vitest); test/mcp + test/engine 3/3 estables; sin daemons residuales. S8 sigue executed; pendiente re-revisión.
- 2026-10-15 · re-revisión change-verifier: aprobado con observaciones R1-R4; R1 y R2 corregidas; R3 informativa; R4 es el cambio del entorno documenter, revisado aparte. R1: un mensaje borrado por cascade borra sus ocurrencias que ningún otro mensaje usa (sin `OCCURRENCE_UNUSED` nuevos; prueba del garaje con escritura real por elemento comparando advertencias antes/después, y prueba explícita de borrar `RentCar.rent`; DEC-016 y REQ-024 actualizadas; mutación → fallan ambas). R2: la prueba de 401 arranca el primer daemon con `--port 0` y, si el `serve` reiniciado termina, falla con su stderr; además espera a que el nuevo daemon publique runtime.json y responda `/api/status` con su token antes de llamar. Causa del fallo `unauthorized` visto por otro revisor: su `scripts/check` (inicio 07:06:46) reconstruyó `dist/` compartido mientras estaba aplicada la mutación M7 (reintento 401 eliminado en `src/cli/proxy.ts`, 07:06:47); la mutación reproduce exactamente ese error y el reintento del proxy no puede leer un runtime obsoleto (sin runtime vivo, `ensureDaemon` espera a `waitForRuntime`). proxy.test.ts 10/10; `scripts/check` 4/6 verde: los 2 fallos son timeouts preexistentes de las pruebas de watcher de engine (S5), que también fallan 1/8 con la prueba del garaje desactivada. S8 sigue executed.
- 2026-10-15 · flake del watcher de S5 (2/6 en scripts/check): instrumentado, FSEvents de macOS arranca asíncrono y pierde escrituras inmediatas bajo carga; pruebas con writeUntilChange y expect.poll, limitación en DEC-011. documenter actualiza README (primera ejecución) y context.md se pone al día. S8 verified.
- 2026-10-15 · reanudado en S9 (S8 en 8f85a18, documenter en 78c31d6; árbol limpio). Usuario elige TypeScript sin framework, SSE, tamaño determinista común con `@dagrejs/dagre` y Vite: DEC-017 (active); se cierran las dudas de DEC-006, FEAT-007 y API-002. S9 in_progress.
- 2026-10-15 · S9 executed (subagente implementador, diseño aprobado por el usuario). `src/layout/` puro (size.ts: texto y tamaño por métricas monoespaciadas fijas, 7,5 px/carácter, línea 16 px; class-layout.ts: grafo del diagrama + dagre TB, generalización/realización con el padre arriba); `Query.diagram` (vista con elementos resueltos y nombres, usada por API y tool); tool `auto_layout_diagram` (destructiveHint, dryRun, init implícito, sin reescritura si no cambia); API-002 en `src/daemon/ui-api.ts`; UI en `src/ui/`; reglas depcruise (layout solo tipos de format y sin built-ins de Node, ui solo layout + tipos de format, nadie importa ui, mcp puede usar layout); `npm run build` = tsc + vite build; `typecheck` incluye el tsconfig de la UI. Modelo: FEAT-007 y API-002 implemented, API-001 (tool), REQ-029 (duda P9 cerrada por DEC-015), DEC-017 (PUT en vez de POST), context.md. Desviaciones: (1) `@joint/core` en `dependencies` (no dev) porque su código va en el bundle publicado y así entra en la auditoría de licencias de producción; (2) los tipos de `@dagrejs/dagre` 3.1.1 no resuelven con NodeNext (imports relativos sin extensión): subconjunto tipado a mano en class-layout.ts; (3) `layout` no importa `SUPPORTED_VERSION` (format/schema usa node:fs): la versión llega en la vista (`formatVersion`); (4) la revisión del PUT es `<revisión del modelo>:<revisión del layout>`, comprobada dentro de la transacción: cualquier cambio del archivo del modelo del diagrama también da 409 (REQ-029 CA2 literal); solo cubre ese archivo y el layout: cambios en elementos mostrados de otros modelos no dan 409 (el refresco SSE los redibuja); (5) al guardar se persiste todo el layout en pantalla, incluidos los nodos colocados automáticamente (si no, saltarían de sitio en la recarga); interpretación de spec §8 «hasta que una persona lo mueva» a nivel de diagrama; (6) auto-layout completo conserva `style` y tamaños explícitos, descarta vértices (aristas rectas) y entradas huérfanas; la colocación parcial (UI) pone los nodos nuevos debajo de los ya colocados; (7) 405 para todo método no-GET sin ruta, con `Connection: close` (sin él, el cliente reutilizaba un socket con cuerpo sin leer: «socket hang up»); (8) paquetes como carpeta sin anidar miembros; autoasociaciones sin vértices no se ven; ancho por punto de código (glifos anchos desbordan): anotados con `ponytail:` o en FEAT-007. Sin pruebas automáticas de render (no hay navegador en la suite): queda para la verificación en navegador.
- 2026-10-15 · S9 revisada por change-verifier: aprobado con observaciones H1-H9. Corregidas (TDD donde aplica): H1 `PUT /api/layout` responde 413 en cuanto se supera MAX_BODY (por Content-Length o leyendo) y cierra sin leer el resto; la prueba no termina nunca la petición y acepta 413 o reset (cerrar de inmediato puede resetear antes de que el cliente lea la respuesta; anotado con `ponytail:`); mutación «drenar y luego 413» → falla. H2 guardados encadenados (cada uno lee la revisión del anterior) con contador `pendingSaves` en vez de `saving` pisado en el finally. H3 error del EventSource → `GET /api/status`; si 401, cierra el stream y muestra «Session expired» (el SSE abierto sigue contando como actividad, DEC-014). H6 alcance de la revisión documentado en API-002 y en la desviación (4). H7 REQ-031: `GET /api/relations?id=` (query `relations` entrantes, con nombre del origen) y sección «Referenced by» navegable en el detalle; prueba de la API (roja antes). H8 tabla de errores de API-002 (400 de typed(), 413, 405, 503, 401/403). H9 etiqueta de la UI en context.md. H4 → acción en S12. H5: `.gitignore`/`.ignore` son de graft y quedan fuera del commit. S9 sigue executed.
- 2026-10-15 · verificación en navegador del usuario (Safari, garaje del scratchpad): en `overview` el texto de Car salía de su caja y Garage se solapaba con Car: `layout/overview.json` del ejemplo fijaba Car 200×140 (menor que su contenido) y sus posiciones eran para cajas más pequeñas que las de size.ts. Corregido con TDD: `boxSize` en src/layout (tamaño = max(explícito, contenido)) usado por auto-layout y por la shape de la UI; spec §8, ENT-005 y API-001 dicen que width/height es un mínimo y el contenido nunca se recorta; layout de ejemplo `overview` regenerado con el módulo común (todas las posiciones; se conservan estilo y tamaño de Car y el vértice de Car--Engine, recolocado en el punto medio); prueba nueva: ningún diagrama de clases del ejemplo tiene nodos solapados con su tamaño real (roja antes). Botón «Auto-layout» en la UI: recalcula con el módulo común (mismo resultado que la tool) y guarda con el PUT existente, en la cola de guardados. README (UI web) y FEAT-007 actualizados. S9 sigue executed; falta repetir la verificación en navegador.
- 2026-10-15 · S9 commit d4c5436; usuario verifica en navegador tras las correcciones (Auto-layout sin solapes, texto dentro). S9 verified.

## Resultado (al cerrar)
