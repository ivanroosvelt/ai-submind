---
id: PLAN-005
title: "Relaciones entre diagramas de distinto tipo y flujos de flujos (behavior + links)"
status: completed
created: 2026-10-16
updated: 2026-10-17
class: T2
related: [DEC-020, REQ-041, REQ-042, REQ-043, API-004, ENT-003, ENT-004, VAL-003, FEAT-003, FEAT-002, FEAT-004, FEAT-006, FEAT-007, FEAT-009, API-001, API-002, REQ-039]
blockers: []
next_action: "Ninguna: plan completado."
stages:
  - id: S1
    name: "Decisión, requerimientos y especificación del formato"
    status: verified
    evidence: "2026-10-16: DEC-020, REQ-041/042/043 creadas (sysq claim); spec/format/README.md 1.1 (§6.4, §7.1, §9, §10.2–10.4, §11/11.1, §12, §13); guía spec/format/migrations/1.0-to-1.1/README.md; scripts/regen OK; scripts/check exit 0 (entorno 0/0, modelo 103 elementos 0/0, herramientas 42 OK skip 1, producto: prettier OK, depcruise sin violaciones, Vitest 21 archivos / 333 pruebas OK)."
  - id: S2
    name: "Núcleo del formato: esquema, tipos, validación y ejemplos"
    status: verified
    evidence: "2026-10-16: spec/format/schema/1.1/ (copia de 1.0 + behavior tras return_type, links tras external_id en los 24 objetos con id, modelo y diagramas; $defs/links uniqueItems; URN 1.1), 1.0 intacto; src/format con SUPPORTED_VERSIONS [1.0, 1.1] (cada documento se valida y canoniza con el esquema de su versión; 1.0 → FORMAT_VERSION_OUTDATED, escribible), reglas behavior→interaction, links→cualquier id, LINK_SELF; links como conjunto canónico. Corpus a 1.1 con behavior/links en garage y canonical; inválidos nuevos behavior-not-interaction, link-self, schema-1-1-key-in-1-0. TDD: pruebas nuevas en rojo antes del código. npx vitest run test/format: 88 OK."
  - id: S2b
    name: "Operación migrate 1.0 → 1.1 (motor, MCP, CLI, guía)"
    status: verified
    evidence: "2026-10-16: Engine.migrate({dryRun}) → {migrated, revisions, diff} (un lote, canónico, idempotente, MIGRATE_BLOCKED si un documento 1.0 o de versión ilegible no carga, otras versiones intactas); MIGRATION_REQUIRED en commit (claves 1.1 en documento 1.0, o cambio de format_version fuera de migrate); herramienta MCP migrate; CLI ai-submind migrate [--dry-run]; corpus de la guía spec/format/migrations/1.0-to-1.1/examples/{before,after} probado en test/format/corpus.test.ts (migrate convierte before en after byte a byte); package.json files incluye spec/format/migrations; DEC-010 active. Fichas FEAT-003, API-001, API-003, API-004, VAL-001, VAL-003, VAL-004, ENT-003, ENT-004, DEC-010, DEC-020, REQ-041, REQ-043 actualizadas. scripts/regen OK; scripts/check exit 0 (entorno 0/0, modelo 103 elementos 0/0, herramientas 42 OK skip 1, producto: tipos, lint, prettier OK, depcruise sin violaciones, Vitest 21 archivos / 351 pruebas OK, antes 333)."
  - id: S3
    name: "Motor y consultas: edición, cascada, rename, relaciones e impacto"
    status: verified
    evidence: "2026-10-16: src/engine/edit.ts sin cambios: create/update ya aceptan behavior y links en elementos, diagramas y el modelo (update del modelo vía nodeOf), y la cascada existente cubre ambos (sin cascade REFERENCED; con cascade behavior se anula como referencia opcional, links pierde solo la entrada borrada y un conjunto vacío no se escribe; borrar un modelo o diagrama entero quita los links a él); 4 pruebas nuevas en test/engine/edit.test.ts (en verde a la primera, sin código: confirman la inferencia del plan). src/query/query.ts: behavior en SEQUENCE_KEYS (grupo sequence), grupo nuevo links (solo clave links; un link de un elemento de relación no entra en el grupo de esa relación). graph.ts/traverse.ts sin cambios: behavior y links ya eran aristas reference con clave behavior/links, modelos y diagramas nodos en ambos extremos. TDD: 3 pruebas nuevas en test/query/query.test.ts (grupos, impacto/caminos con modelo y diagrama como extremos, ciclo RentCar → interaction_use → CheckFuel → links → RentCar que termina); en rojo antes del cambio. Fichas DEC-012, FEAT-002, FEAT-004, REQ-041."
  - id: S4
    name: "MCP: herramientas de edición y consulta con behavior y links"
    status: verified
    evidence: "2026-10-16: src/mcp/tools.ts: descripción común FLOWS en create_element, update_element y apply_batch (behavior = operación → interacción; links = cualquier elemento/modelo/diagrama → cualquiera; parche con el array completo; requieren 1.1/migrate); relations describe los grupos sequence (behavior) y links; esquemas zod sin cambios (data/patch son registros libres; groups deriva de RELATION_GROUPS e incluye links). TDD: prueba nueva en test/mcp/tools.test.ts en rojo antes del cambio. Fichas API-001 (grupos de relations, behavior/links; recurso schema corregido a 1.1) y FEAT-006. scripts/regen OK; scripts/check exit 0 (entorno 0/0, modelo 103 elementos 0/0, herramientas 42 OK skip 1, producto: tipos, lint, prettier OK, depcruise sin violaciones, Vitest 21 archivos / 359 pruebas OK, antes 351)."
  - id: S5
    name: "UI: navegación en profundidad y marca de elementos enlazados"
    status: verified
    evidence: "2026-10-16: Query.diagram (API-002 GET /api/diagram) devuelve targets: Record<id, {id, kind: element|diagram|model, diagram?}[]> calculado en el servidor entre modelos (navTargets en src/query/query.ts): behavior de la operación, signature → behavior, interaction_use.interaction, behaviors de las operaciones de un clasificador, después links; se omiten destinos que son el propio diagrama o lo que muestra; modelo → su primer diagrama por ID; names incluye los destinos. UI (src/ui/main.ts, shapes.ts): marca ↗ con tooltip en nodo de clase, cabecera de lifeline, fragmento/interaction_use y tras la etiqueta del mensaje; doble clic abre el primer destino (elemento → reveal, diagrama → hash, modelo → primer diagrama o aviso «has no diagrams»); detalle con sección «Navigates to» (sin selección, los links del diagrama abierto); el doble clic sobre interaction_use pasa a usar targets. Corpus garage: Car.canDrive() behavior CheckFuel (mensaje RentCar.canDrive → check-fuel). TDD: prueba nueva en test/query/query.test.ts en rojo antes del código; aserción en test/daemon/ui-api.test.ts. curl contra el daemon sobre una copia de garage: targets esperados en overview/rent-car. Fichas FEAT-007, FEAT-009, API-002, REQ-042. npm run build OK; scripts/regen sin cambios; scripts/check exit 0 (entorno 0/0, modelo 103 elementos 0/0, herramientas 42 OK skip 1, producto: tipos, lint, prettier OK, depcruise sin violaciones, Vitest 21 archivos / 360 pruebas OK, antes 359). Sin comprobación en navegador (S6)."
  - id: S6
    name: "Verificación, README y comprobación en navegador"
    status: verified
    evidence: "2026-10-17: change-verifier aprobó S1–S5 con observaciones (3 a corregir + observaciones), todas corregidas; documenter actualizó README.md; ejemplo garage ampliado con todos los tipos de enlace; comprobación en navegador del usuario sobre garage: «validated» (2026-10-17), aceptando las tres opciones por defecto (sin marca para enlaces dentro del mismo diagrama, doble clic al primer destino, modelo → primer diagrama por ID). npm run build OK; scripts/check exit 0 (entorno 0/0, modelo 0/0, Vitest 21 archivos / 361 pruebas OK)."
---

# PLAN-005 · Relaciones entre diagramas de distinto tipo y flujos de flujos

## Objetivo

Que las entidades conserven sus relaciones entre diagramas de distinto tipo (clase ↔ secuencia) en ambos
sentidos y que un elemento de un flujo pueda referenciar otro flujo completo (o un diagrama o modelo
entero), de modo que se puedan componer flujos de flujos y navegarlos en la UI.

Petición del usuario (2026-10-16): «mejora la interrelación y atomicidad de entidades, al punto que los
diagramas de distinto tipo conserven relaciones a las entidades correspondientes entre ellos. También que
una entidad de un flujo pueda referenciar a un archivo de otro flujo completamente. Así armar flujos de
flujos». Respuestas: mecanismo = **ambos** (`behavior` tipado + `links` genérico); UI = **navegar + marcar**.

## Criterios de aceptación

1. Una operación declara `behavior: {"idref": <interaction>}`; el validador exige que sea una interacción
   (`REF_TYPE_MISMATCH` si no).
2. Todo elemento con `id`, el modelo y los diagramas aceptan la extensión `links: [{"idref": ...}]` (conjunto
   ordenado por `idref`) cuyo destino puede ser cualquier elemento, **modelo o diagrama** (archivo completo).
3. `rename` reescribe ambos tipos de referencia; borrar el destino respeta `cascade` como el resto de referencias.
4. Las consultas (`relations`, `impact`, `paths`) recorren `behavior` y `links`, con grupo propio.
5. MCP permite crear y editar `behavior` y `links` y los describe.
6. UI: doble clic sobre un mensaje (signature → operación → behavior), una operación/clase con behavior o
   links, o un `interaction_use` abre el diagrama del flujo destino; un destino diagrama abre ese diagrama,
   un destino modelo abre su primer diagrama. Los elementos con destino navegable llevan una marca visible (↗).
7. `scripts/check` en verde; ejemplos del corpus válidos e inválidos nuevos; comprobación en navegador.

## Alcance
- Incluye: formato (spec + esquema + ejemplos), `src/format`, `src/engine`, `src/query`, `src/mcp`, `src/ui`,
  `src/daemon/ui-api.ts` si la vista necesita datos de destino, modelo estructural y README.
- Incluye también: formato **1.1** y operación explícita `migrate` 1.0 → 1.1 (decisión del usuario, 2026-10-16).
- Excluye: nuevos tipos de diagrama (actividad, casos de uso), `behavior` en clasificadores (lo cubre `links`),
  migraciones de otras versiones, búsqueda semántica.

## Análisis (salida de task-intake e impact-analysis)

```
Clase: T2 · cambio del formato publicado (1.0 en ai-submind 0.1.1), motor, consultas, MCP y UI.
Elementos: API-004, ENT-003, ENT-004, VAL-003, FEAT-002/003/004/006/007/009, API-001/002, REQ-039.
Perspectivas: aplica [contratos (formato y MCP), datos (archivos de knowledge/), migraciones (versión del
  formato), compatibilidad (0.1.1 publicado), UI, pruebas]; seguridad: no aplica salvo que la UI no
  interprete HTML de los datos (se mantiene h() sin innerHTML).
Ruta: decision-record → model-update → (implementación por etapas) → verify-change → change-verifier → documenter.
```

Hechos (verificados en código y spec):
- IDs globales: una referencia ya puede apuntar a otro modelo (spec §4).
- Ya existen `lifeline.represents` → clasificador/actor, `message.signature` → operación e
  `interaction_use.interaction` → otra interacción (spec §6.5, §10.2).
- La UI ya navega: `reveal()` abre un diagrama que muestra el destino; doble clic sobre `interaction_use`
  abre la interacción usada (`src/ui/main.ts`).
- Falta: la dirección clase → flujo (qué flujo implementa una operación), referencias a archivos completos
  (modelo/diagrama) y marca visual de lo navegable.

Inferencias: `links` es una extensión (§7.1) con la forma uniforme `{idref}`, por lo que `rename` y el
recolector de referencias la cubren sin código específico (comprobar en S3).

Dudas (no bloqueantes, se resuelven en DEC-020):
- **Versión del formato — decidida por el usuario (2026-10-16): 1.1 + `migrate` explícito.** 1.0 está
  publicado (0.1.1) con `additionalProperties: false`. 1.1 solo añade claves opcionales (cambio menor, §11):
  0.1.1 leerá los 1.1 en solo lectura tolerante. Los documentos 1.0 cargan con `FORMAT_VERSION_OUTDATED`, se
  validan con el esquema 1.0 y siguen escribibles sin las claves nuevas; para usarlas se ejecuta `migrate`
  (cambia `format_version` a 1.1 en modelos, layouts y manifiesto; DEC-010: guía `migrations/1.0-to-1.1/`).
  Hay que soportar dos esquemas a la vez (hoy `src/format/schema.ts` tiene un solo `SUPPORTED_VERSION`).
- ¿`links` admite apuntar a sí mismo o a su propio modelo/diagrama? Propuesta: no a sí mismo (error), sí al resto.

## Etapas

### S1 · Decisión, requerimientos y especificación del formato
- Depende de: —
- Criterios de entrada: plan aprobado.
- Acciones: `decision-record` → DEC-020 (behavior en operación, extensión links, versión del formato y paso
  1.0 → 1.1); `requirements-analysis` → REQ de relaciones entre diagramas y de navegación en profundidad;
  actualizar `spec/format/README.md` (§6.4, §7.1, §10.2, §10.3, §11, §12) y el corpus de ejemplos.
- Archivos: `docs/system/decisions/`, `docs/system/requirements/`, `spec/format/`.
- Pruebas: `scripts/validate-system-model`.
- Criterios de salida: DEC y REQ `active`, spec coherente, `scripts/check` sin errores nuevos.

### S2 · Núcleo del formato
- Depende de: S1.
- Acciones: esquema JSON (versión según DEC-020), `src/format/types.ts`, tipos de referencia en
  `src/format/semantic.ts` (`behavior` → interaction; `links` → cualquier id incluido modelo/diagrama),
  serialización canónica (`links` como conjunto), ejemplos válidos/inválidos en `spec/format/examples`.
- Pruebas: `test/format/*` (ejemplo garage con behavior y links; inválidos `REF_TYPE_MISMATCH`, auto-enlace).
- Criterios de salida: corpus y Vitest en verde; fichas VAL-003, API-004, ENT-003/004 actualizadas.

### S2b · Operación `migrate` 1.0 → 1.1
- Depende de: S2.
- Acciones: operación del motor (transacción por lotes, escritura canónica, idempotente, `dryRun`), herramienta
  MCP y comando CLI `ai-submind migrate`; guía `spec/format/migrations/1.0-to-1.1/` con antes/después (DEC-010);
  escrituras de claves 1.1 en un documento 1.0 rechazadas con mensaje que indique `migrate`.
- Pruebas: `test/engine/*`, `test/mcp/*`, CLI.
- Criterios de salida: pruebas en verde; FEAT-003, API-001, API-003, VAL-004 actualizadas.

### S3 · Motor y consultas
- Depende de: S2.
- Acciones: `src/engine/edit.ts` acepta los campos; `cascade` al borrar destinos de `behavior`/`links`;
  `rename` reescribe (prueba); `src/query/query.ts`: claves en grupos de relación (`behavior` con secuencia,
  `links` grupo propio), impacto y caminos.
- Pruebas: `test/engine/*`, `test/query/*`.
- Criterios de salida: pruebas nuevas en verde; FEAT-002/004 actualizadas.

### S4 · MCP
- Depende de: S3.
- Acciones: esquemas zod y descripciones de `src/mcp/tools.ts` para crear/editar `behavior` y `links`;
  grupo de relaciones nuevo en las herramientas de consulta.
- Pruebas: `test/mcp/*`.
- Criterios de salida: pruebas en verde; API-001/FEAT-006 actualizadas.

### S5 · UI
- Depende de: S3 (y S4 solo para crear datos de prueba).
- Acciones: resolver el destino navegable de un elemento (behavior de la operación, signature → behavior,
  links, interaction_use); doble clic abre el diagrama destino (diagrama directo, modelo → primer diagrama,
  elemento → `reveal`); marca ↗ en formas con destino (clase/operación, mensaje, lifeline). Si la vista no
  trae lo necesario (operación de otro modelo), ampliar la respuesta de `/api/diagram` (API-002) con un mapa
  `id → destino`.
- Pruebas: `test/daemon/*` para la API; lógica de destino pura con prueba unitaria; UI en navegador (S6).
- Criterios de salida: pruebas en verde; FEAT-007/009, API-002 y REQ de navegación actualizadas.

### S6 · Verificación, README y comprobación en navegador
- Depende de: S2–S5.
- Acciones: `scripts/regen`, `scripts/check`, agente `documenter`, agente `change-verifier`, comprobación del
  usuario en navegador con el ejemplo garage (flujo que baja a otro flujo y vuelve a la clase).
- Criterios de salida: todo verde, hallazgos corregidos, plan archivado.

## Riesgos y bloqueos
- Compatibilidad con 0.1.1 publicado (ver duda de versión).
- Ciclos de flujos (A behavior→B, B interaction_use→A): válidos como modelo; la UI solo navega un nivel por
  acción, sin recursión; `impact`/`paths` ya limitan profundidad (comprobar).

## Bitácora
- 2026-10-16 · creado tras task-intake; respuestas del usuario: mecanismo «ambos», UI «navegar + marcar», versión «1.1 + migrate explícito».
- 2026-10-16 · S1 ejecutada: DEC-020 (active), REQ-041/042/043 (active, sin implementar); spec 1.1 y guía 1.0→1.1. Códigos elegidos: `LINK_SELF` (error, fase 4), operación `MIGRATION_REQUIRED` y `MIGRATE_BLOCKED`. Pendiente para S2/S2b: `spec/format/schema/1.1/` (los enlaces de la spec a ese directorio quedan rotos hasta S2), añadir `spec/format/migrations` a `files` de package.json (DEC-010 los publica), corpus before/after de la guía con prueba (DEC-010), actualizar `spec/format/examples/README.md` («Format 1.0 examples») al pasar el corpus a 1.1, y activar DEC-010. La guía se llama `README.md` (no `GUIDE.md` como dice DEC-010; DEC-020 lo precisa).

- 2026-10-16 · S2 ejecutada: esquema 1.1 junto a 1.0; versión actual 1.1 (SUPPORTED_VERSION), 1.0 anterior soportada; corpus pasado a 1.1. Decisión de implementación: Query.diagram().formatVersion y el recurso MCP schema/* sirven la versión actual (1.1); los layouts nuevos de diagramas de un modelo 1.0 se escriben como 1.1 (documento nuevo, spec §11).
- 2026-10-16 · S2b ejecutada: migrate en motor, MCP y CLI (el CLI abre su propio motor como init). Ampliación de la spec §10.4: MIGRATION_REQUIRED también cubre cambiar el format_version de un documento existente fuera de migrate. Corpus de la guía pequeño (shop) en lugar de una copia de garage.

- 2026-10-16 · S3 ejecutada: el motor no necesitó código (la inferencia del plan se confirma con pruebas). Semántica de cascada elegida (la existente de DEC-016): behavior = referencia opcional (se anula); links = lista (se quita la entrada; vacío no se escribe). Sin tipo de arista nuevo: behavior/links son `reference` con su clave; grupo de relación nuevo `links`. Pendiente conocido: `paths` sigue sin atravesar modelos/diagramas como pasos intermedios salvo `throughHubs` (DEC-012), también para links a diagramas.
- 2026-10-16 · S4 ejecutada: solo descripciones de herramientas; API-001 decía «JSON Schemas of format 1.0» en los recursos y se corrigió a 1.1 (desfase de S2).

- 2026-10-16 · S5 ejecutada: el destino se resuelve en el servidor (un solo fetch; la operación de un mensaje puede estar en otro modelo). Elección: un destino igual al diagrama abierto o a un elemento que muestra no cuenta (p. ej. RentCar.rent → Garage.rent() → RentCar, en rent-car). Marca ↗ fuera de la caja (encima de la esquina superior derecha) para no tapar el texto. Pasos de navegador para S6: `npm run build`; copiar `spec/format/examples/valid/garage/knowledge` a un directorio temporal, `git init` allí y `node <repo>/dist/cli/main.js serve` desde ese directorio; abrir la URL impresa; Overview: Garage y Car con ↗, doble clic → Rent car / Check fuel; sin selección, «Navigates to» del diagrama (Garage.rent(), Check fuel); Rent car: canDrive ↗ → Check fuel, lifeline car ↗ → Check fuel, ref CheckFuel ↗ → Check fuel; rent sin ↗; volver a la clase desde Check fuel con el botón de `represents` de una lifeline; `node <repo>/dist/cli/main.js stop` al terminar. Destino modelo solo probado en Vitest (garage → types no tiene diagramas y no está en ningún lienzo).
- 2026-10-16 · revisión change-verifier: aprobado con observaciones; corregidas: (1) marca ↗ en relaciones del
  diagrama de clases (tras el nombre, en el punto medio) y en ejecuciones (`linkCell`/`executionCell` reciben
  `linked`); un clasificador recoge también los `links` de sus atributos y operaciones (marca, doble clic al
  primero y «Navigates to»; los miembros conservan su entrada), prueba en test/query (en rojo antes); (2) DEC-020
  sin la duda obsoleta («mostrar el modelo en el árbol»): modelo sin diagramas → aviso «Model X has no diagrams»;
  (3) CLI `migrate` (y `init`, mismo patrón, cambio trivial) rechaza con exit 1 si hay un daemon vivo (liveRuntime)
  e indica la herramienta MCP `migrate` o `ai-submind stop`; prueba CLI nueva (en rojo antes); API-003. Solo
  documentación: «primer diagrama por ID (el orden del árbol)» en query.ts, API-002, REQ-042 y la prueba; spec §11
  (el motor crea documentos nuevos en la versión actual; `put` explícito y `rename` conservan la versión);
  atomicidad de migrate = «validado como un todo, escrito secuencialmente; reejecutar es idempotente» en spec
  §11.1, DEC-020, REQ-043 y la guía; CHANGELOG «Unreleased». FEAT-007/009 describen las marcas nuevas.

- 2026-10-17 · ejemplo garage ampliado para mostrar todo en el navegador (petición del usuario): links en la asociación `Garage--Car` → rent-car, en `Mechanic.repair()` → check-fuel (marca en la clase por miembro), en `Contract` → modelo `types` (sin diagramas: aviso), en la ejecución `RentCar.start.receive.exec` → overview y en las lifelines `CheckFuel.car` → rent-car y `CheckFuel.garage` → overview. Expectativas del corpus actualizadas en test/query, test/mcp y test/engine (borrado de rent-car ahora con cascade). `scripts/check` exit 0, Vitest 361/361.

- 2026-10-17 · comprobación en navegador validada por el usuario; plan cerrado y archivado.

## Resultado (al cerrar)

Completado sin commits (el usuario no los pidió). Implementado y verificado: formato 1.1 (`behavior` en operaciones,
extensión `links`, `LINK_SELF`) con 1.0 soportado (`FORMAT_VERSION_OUTDATED`, `MIGRATION_REQUIRED`), `migrate`
(motor, MCP, CLI, guía con corpus), grupo de relaciones `links`, `targets` en `/api/diagram` y navegación en
profundidad con marca ↗ en la UI. Pendiente fuera del plan: `paths` no atraviesa modelos/diagramas sin
`throughHubs`; `impact`/`paths` no filtran por grupo; línea de README «Published on npm … 0.1.0» desactualizada.
