---
id: PLAN-002
title: "Estructura base de ai-submind: gestor de diagramas en knowledge/ con motor propio, MCP y UI JointJS"
status: in_progress
created: 2026-10-14
updated: 2026-10-14
class: T2
related: [DEC-001, DEC-002, DEC-003, DEC-004, DEC-005, DEC-006, DEC-007, REP-003]
blockers: []
next_action: "S2: redactar spec del formato (gramática de IDs DEC-003, modelo clases/secuencia, diagramas, layout, ai-submind.json) y JSON Schemas 2020-12 con ejemplos válidos/inválidos; resolver dudas de S2 listadas en Riesgos."
stages:
  - id: S1
    name: "Decisiones aceptadas y modelo estructural registrado"
    status: verified
    evidence: "2026-10-14 scripts/check: entorno 0 errores 0 advertencias; modelo 86 elementos 0 errores 0 advertencias; 42 pruebas OK. Fichas ACT-001..004, REQ-001..040, NFR-001..011, VAL-001..007, FEAT-001..009, ENT-001..005, API-001..003; DEC-001..007 active con affects."
  - id: S2
    name: "Especificación del formato y JSON Schema (clases, secuencia, layout)"
    status: ready
    evidence: ""
  - id: S3
    name: "Andamiaje del paquete TypeScript, pruebas y code_roots"
    status: proposed
    evidence: ""
  - id: S4
    name: "Núcleo de formato: serialización canónica y validación"
    status: proposed
    evidence: ""
  - id: S5
    name: "Motor de conocimiento: carga, grafo, transacciones, rename, recarga"
    status: proposed
    evidence: ""
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
- Excluye (plan posterior): búsqueda semántica con embeddings (DEC-007), merge driver semántico de git,
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
- Dudas abiertas por etapa (de fichas `uncertainties`): S2 gramática de IDs, refs entre modelos, ubicación de la spec, versión de formato más nueva que el binario; S3 paquete único vs monorepo, framework de pruebas; S7 apagado del daemon, puerto, entrega del token al navegador; S8 si MCP puede modificar layout, init implícito en primera escritura; REQ-027 dry_run y NFR-007 umbrales sin confirmar.

## Bitácora
- 2026-10-14 · creado tras task-intake, REP-003 y respuestas del usuario (archivos, IDs, proceso, stack).
- 2026-10-14 · paquete y comando renombrados a `ai-submind` (DEC-001, DEC-005).
- 2026-10-14 · todo lo visible del producto renombrado a `ai-submind`: servidor MCP, `ai-submind.json`, `.ai-submind/` (DEC-001, DEC-002, DEC-005, DEC-007).
- 2026-10-14 · usuario aprueba DEC-001..007 y el plan; render de secuencia pasa a etapa madura S11 (empaquetado S12, cierre S13). Plan in_progress; S1 in_progress.
- 2026-10-14 · S1 verified (system-modeler; evidencia en front matter). REQ-019 caminos simples activado y añadido a S6 por DEC-004.

## Resultado (al cerrar)
