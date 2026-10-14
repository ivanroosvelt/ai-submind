---
id: REP-003
title: "Análisis del primer requerimiento: gestor de diagramas con MCP"
date: 2026-10-14
status: current
supersedes: []
---

# REP-003 · Análisis del primer requerimiento

## Resumen
Insumo de PLAN-002. Anexo A: propuesta de requerimientos (agente requirements-analyst).
Anexo B: investigación técnica (verificado [V] / inferido [I]). Ambos generados el 2026-10-14
**antes** de las respuestas del usuario sobre archivos, IDs, proceso y stack: donde contradigan a
DEC-001..DEC-007, prevalecen las DEC (p. ej. un archivo por modelo, no fragmentado; IDs legibles, no ULID).

## Implementado / verificado / pendiente / bloqueado
- Implementado: nada de código. Pendiente: fichas del modelo (PLAN-002 S1).

## Riesgos y limitaciones
- IDs ACT/REQ/NFR/VAL/FEAT del anexo A son provisionales, no reservados.

## Próximas acciones
Ver `next_action` de PLAN-002.

---

# Anexo A · Propuesta de requerimientos


Estado: **propuesta** (ninguna ficha escrita; IDs **provisionales**, NO reservados en el ledger;
al escribir fichas se reservan con `scripts/sysq claim` y se renumeran). Todo `status: proposed`.
Analista: requirements-analyst (AGT-001) siguiendo SKL-008. Fecha: 2026-10-14.

Fuentes: **[U]** petición del usuario · **[A]** aclaración del usuario · **[P]** paper UMJ
(Malanowska A., Pawłowski F., "Unifying Non-Uniform Formats of UML Model Interchange Using JSON",
ENASE 2026, doi:10.5220/0014828700004015, CC BY-NC-ND 4.0; §4.2, Tablas 1 y 2) ·
**[S]** supuesto del analista (sin fuente; requiere confirmación).

---

### 1. Hechos y supuestos

#### Hechos (fuente citada)
- H1 [U] submind gestiona diagramas: explorar, visualizar, consultar y administrar vía MCP.
- H2 [U] Se lanza como comando `npx` (o similar) y opera sobre el proyecto donde se ejecuta.
- H3 [U][A] Toda la información vive en `/knowledge` del proyecto anfitrión, versionada con Git; es la fuente de verdad.
- H4 [U] Formato JSON bien definido a partir de UMJ, extensible a más tipos de diagrama.
- H5 [U] Hay validación de esquemas y consultas inteligentes.
- H6 [A] Consultas inteligentes = tools MCP tipadas (buscar, relaciones, impacto, caminos) + búsqueda semántica por embeddings. Sin LLM embebido.
- H7 [U][A] Visualización con JointJS; UI de la 1.ª iteración: explorar + ajustar layout (mover persiste). Cambios de modelo solo vía MCP.
- H8 [A] Sin servidor TerminusDB: se construye un equivalente portable propio, embebido, sin Docker.
- H9 [A] Implementación propia y modular; REA se usa para estudiar comportamiento a reimplementar. Código propietario (p. ej. JointJS+) solo clean-room por comportamiento/documentación pública.
- H10 [U][A] La información necesaria de UMJ se copia al repositorio reescrita con palabras propias y citando la fuente; el PDF se elimina al terminar.
- H11 [P] UMJ: `id` identifica; `{"idref": "<id>"}` referencia; elementos con nombre llevan `name` y `visibility`.
- H12 [P] Elementos anidados se guardan como hijos de su dueño; no hay clave de tipo: el tipo lo da la colección (`classes`, `associations`, …).
- H13 [P] El modelo es la raíz del árbol y dueño de todas las relaciones (asociaciones, generalizaciones, dependencias, realizaciones). Los paquetes solo guardan referencias a sus elementos.
- H14 [P] `null` = valor desconocido/no especificado; no se imponen valores por defecto.
- H15 [P] En interacciones, el orden de los eventos lo da el orden del array `fragments` (un evento por instante).
- H16 [P] Diagramas (`class_diagrams`, `sequence_diagrams`) son conjuntos de referencias, **sin layout**; el paper sugiere extender con coordenadas/estilos y considerar JSON Schema.
- H17 [P] Cobertura: diagramas de clases y de secuencia. No cubre asociaciones calificadas ni restricciones.
- H18 [verificado] Repo greenfield: sin código, stack ni fichas; `schema.yaml` con `code_roots: []`.

#### Supuestos [S] (a confirmar)
- S1 Stack Node.js/TypeScript (inferido por `npx`, no confirmado) → DEC-001 pendiente.
- S2 Usuario único local por proyecto; sin autenticación de usuarios finales.
- S3 MCP por stdio (el cliente MCP lanza el proceso) y UI web HTTP servida por el mismo comando.
- S4 JointJS núcleo (open source, licencia MPL-2.0 — [inferido], verificar) es suficiente; no se usa JointJS+.
- S5 El layout se guarda separado del modelo (archivo propio por diagrama) para no ensuciar diffs del modelo.
- S6 Los índices derivados (grafo en memoria, embeddings) son caché reconstruible, fuera de Git o en ruta ignorada.
- S7 Escala objetivo: hasta ~10 000 elementos por proyecto, ~300 elementos por diagrama.
- S8 Los IDs nuevos los genera submind (únicos globalmente, p. ej. ULID/UUID) para evitar colisiones tras merges.

---

### 2. Actores (ACT)

| ID prov. | Nombre | Tipo | Permisos propuestos | Fuente |
|---|---|---|---|---|
| ACT-001 | Desarrollador | persona | Lanza/para el comando; usa la UI: leer todo, modificar **solo layout**; puede editar `/knowledge` a mano y hacer commits/merges con Git | [U][A] |
| ACT-002 | Agente IA (cliente MCP) | sistema externo | Vía MCP: leer, consultar, crear/modificar/eliminar modelos, elementos y diagramas; validar. No escribe fuera de `/knowledge` | [U][A] |
| ACT-003 | Git / repositorio anfitrión | sistema externo (pasivo) | No invoca a submind; altera `/knowledge` (checkout, pull, merge) y puede dejar conflictos | [U] |
| ACT-004 | Proveedor de embeddings | sistema externo o módulo local | Solo recibe texto y devuelve vectores. Condicional: depende de P4 | [A][S] |

Permisos: no hay roles dentro de submind (S2). La frontera de permisos es **canal**: UI = lectura + layout; MCP = lectura + escritura de modelo (y layout, a confirmar en P9).

---

### 3. Requerimientos funcionales (REQ)

Formato: *<Actor> puede/debe <acción> para <resultado>*. CA = criterios de aceptación (dado/cuando/entonces). Col. "Inc." = incremento (MVP / Post).

#### 3.1 Ejecución (FEAT-001)

**REQ-001 Lanzar submind en el proyecto anfitrión** — ACT-001 puede ejecutar `npx <paquete>` en un proyecto para arrancar submind sobre su `/knowledge`. Inc. MVP. [U]
- CA1: Dado un directorio de proyecto, cuando se ejecuta el comando, entonces submind resuelve la raíz del proyecto (regla en P2) y usa `<raíz>/knowledge`.
- CA2: Dado que el comando arranca, cuando termina la carga, entonces informa por stderr la ruta de `/knowledge`, el número de archivos cargados/inválidos y la URL de la UI.
- CA3: Dado Node por debajo de la versión mínima soportada, cuando se ejecuta, entonces termina con código ≠ 0 y mensaje explícito.

**REQ-002 Inicializar `/knowledge`** — ACT-001/ACT-002 pueden inicializar `/knowledge` para empezar a documentar. Inc. MVP. [U][S]
- CA1: Dado un proyecto sin `/knowledge`, cuando se arranca en modo lectura, entonces NO se crea nada y las consultas devuelven conjunto vacío.
- CA2: Dado un proyecto sin `/knowledge`, cuando se ejecuta la inicialización (subcomando o primera escritura MCP, ver P10), entonces se crea la estructura mínima con manifiesto y versión de formato.
- CA3: Dado un `/knowledge` existente, cuando se reinicializa, entonces no se sobrescribe ningún archivo.

**REQ-003 Exponer servidor MCP** — ACT-002 debe poder conectarse por MCP para administrar y consultar. Inc. MVP. [U]
- CA1: Dado el comando lanzado por un cliente MCP (stdio, S3), cuando el cliente lista tools, entonces recibe las tools de consulta y administración con esquemas de entrada/salida tipados.
- CA2: Dado transporte stdio, cuando submind registra eventos, entonces escribe logs solo en stderr (stdout reservado al protocolo).

**REQ-004 Servir UI web local** — ACT-001 puede abrir la UI en el navegador para explorar diagramas. Inc. MVP. [U]
- CA1: Dado el arranque, cuando la UI está lista, entonces escucha solo en loopback (ver NFR-004) en un puerto configurable; si está ocupado, usa otro o falla con mensaje (P11).
- CA2: Dado el proceso detenido, cuando se intenta acceder, entonces no queda nada escuchando (sin daemons residuales).

#### 3.2 Almacén `/knowledge` (FEAT-002, "equivalente portable de TerminusDB")

**REQ-005 Persistir en JSON determinista** — submind debe escribir `/knowledge` con serialización estable para que Git muestre diffs mínimos. Inc. MVP. [U][S]
- CA1: Dado un documento sin cambios lógicos, cuando se guarda, entonces el archivo queda byte a byte idéntico.
- CA2: Dado un cambio en un único elemento, cuando se guarda, entonces el diff de Git afecta solo a las líneas de ese elemento (y a las referencias necesarias).
- CA3: Codificación UTF-8, indentación fija, salto de línea final, orden de claves y de colecciones definido por la spec.

**REQ-006 Cargar e indexar al arrancar** — submind debe cargar todo `/knowledge` y construir los índices de consulta. Inc. MVP. [S]
- CA1: Dado `/knowledge` con archivos válidos e inválidos, cuando arranca, entonces carga los válidos, marca los inválidos (REQ-022) y arranca en estado `degraded` en vez de abortar.

**REQ-007 Detectar cambios externos** — submind debe recargar cuando ACT-001/ACT-003 modifican `/knowledge` fuera de submind (edición manual, checkout, pull, merge). Inc. MVP. [U][S]
- CA1: Dado submind en ejecución, cuando un archivo de `/knowledge` cambia en disco, entonces se revalida y reindexa en ≤2 s y la UI se refresca (REQ-030).
- CA2: Dado un cambio externo sobre un documento con una escritura MCP en curso, cuando la escritura confirma, entonces detecta el conflicto por revisión (NFR-005) y rechaza en vez de sobrescribir.

**REQ-008 Escritura atómica** — Toda escritura debe ser atómica y confinada a `/knowledge`. Inc. MVP. [S]
- CA1: Dado un fallo a mitad de escritura (proceso matado), cuando se reinicia, entonces cada archivo está en su versión anterior o nueva, nunca truncado.
- CA2: Dada una ruta resultante fuera de `/knowledge` (`..`, absoluta, symlink externo), cuando se intenta escribir o leer, entonces se rechaza con error `PATH_OUTSIDE_KNOWLEDGE`.

#### 3.3 Formato y validación (FEAT-003)

**REQ-009 Especificación del formato submind-UMJ** — El proyecto debe publicar una especificación propia del formato, basada en UMJ y citándola, con versión. Inc. MVP. [U][P]
- CA1: La spec cubre todos los elementos de las Tablas 1 y 2 de UMJ (modelo, paquete, clase, atributo, operación, parámetro, interfaz, data type, enumeración, primitive type, asociación y extremos, generalización, dependencia, realización, interacción, lifeline, mensaje, occurrence specification, combined fragment, operand, interaction use, class/sequence diagram).
- CA2: Texto redactado con palabras propias; sin reproducción literal de tablas; cita bibliográfica y licencia del paper.
- CA3: Existe un JSON Schema versionado ejecutable que la implementa.
- CA4: Tras la copia, `UMJ.pdf` se elimina del repositorio (tarea de cierre, no comportamiento del producto).

**REQ-010 Extensión de layout** — submind debe almacenar el layout de cada diagrama (posición, tamaño, vértices de enlaces; estilos opcional) como extensión del formato. Inc. MVP. [U][P H16][S S5]
- CA1: Dado un diagrama sin layout, cuando se abre, entonces se muestra con layout automático (REQ-028) y no se escribe nada hasta que el usuario mueva algo.
- CA2: Dado un elemento movido, cuando se guarda, entonces solo cambia el archivo de layout, no el del modelo.
- CA3: Dada una entrada de layout de un elemento que ya no está en el diagrama, cuando se valida, entonces se emite advertencia `LAYOUT_ORPHAN` (no error).

**REQ-011 Validar al leer y antes de escribir** — submind debe validar todo documento contra VAL-001..VAL-005. Inc. MVP. [U]
- CA1: Dada una operación MCP que produciría un documento inválido, cuando se ejecuta, entonces se rechaza completa y `/knowledge` no cambia.
- CA2: Dado un archivo inválido en disco, cuando se carga, entonces se reporta y no se usa para escrituras (REQ-022).

**REQ-012 Informe de validación** — ACT-002 puede pedir la validación de todo `/knowledge` (tool `validate`) y ACT-001 puede ejecutarla por CLI (útil en CI/pre-commit). Inc. MVP. [S]
- CA1: Cada hallazgo incluye: severidad, código, archivo, JSON Pointer, id afectado y mensaje.
- CA2: El subcomando CLI sale con código ≠ 0 si hay errores.

**REQ-013 Extensibilidad de tipos de diagrama** — El formato debe permitir añadir tipos de diagrama/elemento sin romper documentos existentes. Inc. Post (diseño en MVP). [U]
- CA1: Dado un documento de versión N, cuando se añade un nuevo tipo en N+1 (minor), entonces sigue validando.

#### 3.4 Consultas MCP (FEAT-004 estructuradas, FEAT-005 semánticas)

**REQ-014 Listar modelos y diagramas** — ACT-002 puede listarlos con id, nombre, tipo y estado de validez. Inc. MVP.
**REQ-015 Obtener elemento por id** — ACT-002 obtiene el elemento, su tipo (colección), su dueño y su archivo. Inc. MVP.
- CA: Dado un id inexistente, entonces error `NOT_FOUND`; dado un id duplicado (VAL-002), entonces error `AMBIGUOUS_ID` con las ubicaciones.
**REQ-016 Buscar elementos** — por nombre (exacto/parcial, sin distinguir mayúsculas), tipo, modelo, paquete, diagrama; con paginación. Inc. MVP.
**REQ-017 Relaciones de un elemento** — entrantes y salientes, filtrables por tipo de relación (asociación, generalización, dependencia, realización, pertenencia, aparición en diagrama, referencias de secuencia). Inc. MVP.
**REQ-018 Impacto** — conjunto transitivo de elementos que dependen de X, con profundidad máxima y tipos de relación configurables. Inc. MVP.
- CA: Dado un ciclo de dependencias, entonces termina y cada elemento aparece una vez.
**REQ-019 Caminos entre elementos** — caminos más cortos entre A y B (límite de longitud/número). Inc. Post (o MVP si P8).
**REQ-020 Búsqueda semántica** — ACT-002 puede buscar por texto libre y recibir elementos ordenados por similitud con puntuación. Inc. Post (bloqueada por P4). [A]
- CA1: Dado el índice desactualizado, cuando se consulta, entonces responde indicando `stale` o reindexa incrementalmente antes.
- CA2: Dado el proveedor no disponible, entonces error `SEMANTIC_UNAVAILABLE`; el resto de tools siguen operativas.

Regla común de consultas: resultados deterministas (orden estable), solo lectura, sin efectos en disco.

#### 3.5 Administración MCP (FEAT-006)

**REQ-021 Crear modelo** — ACT-002 crea un modelo vacío con nombre. Inc. MVP.
**REQ-022 Archivos inválidos en modo degradado** — submind debe seguir operando con los archivos válidos y bloquear escrituras sobre los inválidos. Inc. MVP. [S]
- CA1: Dado un archivo con JSON mal formado o marcadores de conflicto, cuando ACT-002 intenta modificar un elemento que vive en él, entonces error `DOCUMENT_INVALID` con detalle.
- CA2: Las consultas indican que hay documentos excluidos (no silencian la ausencia).
**REQ-023 Crear/actualizar elemento** — ACT-002 crea o modifica cualquier elemento del formato; submind asigna id si no se da (S8). Inc. MVP.
- CA1: Dado un campo con `null`, entonces se conserva como `null` (desconocido) y no se sustituye por un valor por defecto [P H14].
- CA2: Dada una actualización con `expected_revision` distinta de la actual, entonces error `REVISION_CONFLICT`.
**REQ-024 Eliminar elemento** — ACT-002 elimina un elemento. Inc. MVP.
- CA1: Dado un elemento referenciado, cuando se elimina sin `cascade`, entonces error `REFERENCED` con la lista de referencias.
- CA2: Con `cascade: true`, se eliminan/limpian las referencias y la respuesta lista todo lo afectado.
**REQ-025 Gestionar diagramas** — ACT-002 crea/renombra/elimina diagramas y añade/quita referencias a elementos. Inc. MVP.
- CA: Añadir a un diagrama de clases un elemento de tipo no admitido por ese diagrama → error de VAL-003.
**REQ-026 Operaciones por lotes atómicas** — ACT-002 aplica un lote de operaciones que se valida y persiste todo o nada. Inc. MVP (S: un agente crea diagramas con muchas operaciones). [S]
**REQ-027 Ejecución en seco** — cualquier operación de escritura admite `dry_run` que devuelve el resultado de validación y el diff sin escribir. Inc. Post. [S]

#### 3.6 UI web (FEAT-007)

**REQ-028 Navegar y renderizar diagramas** — ACT-001 navega modelos/diagramas y ve un diagrama renderizado con JointJS; sin layout guardado se aplica layout automático. Inc. MVP (clases); secuencia según P7.
**REQ-029 Ajustar y persistir layout** — ACT-001 mueve elementos (y vértices de enlaces) y el layout se guarda en `/knowledge`. Inc. MVP. [A]
- CA1: Dado un movimiento, cuando se suelta, entonces se persiste (con debounce) y sobrevive a recargas.
- CA2: Dado que el diagrama cambió en disco desde que se abrió, cuando se guarda layout, entonces se rechaza con aviso y se recarga (no se pisa).
**REQ-030 Refresco en vivo** — la UI refleja cambios hechos por MCP o en disco sin recargar manualmente. Inc. MVP.
**REQ-031 Detalle de elemento** — al seleccionar, la UI muestra propiedades (con `null` visible como "desconocido") y relaciones navegables. Inc. MVP.
**REQ-032 UI sin edición de modelo** — la UI no ofrece crear, borrar, renombrar ni reconectar elementos; el API HTTP rechaza cualquier escritura que no sea layout. Inc. MVP. [A]
**REQ-033 Ver estado de validación** — la UI muestra archivos inválidos/advertencias. Inc. MVP.

#### 3.7 Integridad con Git (FEAT-008)

**REQ-034 Detectar conflictos de merge** — submind detecta marcadores `<<<<<<<`/`=======`/`>>>>>>>` en `/knowledge`, marca el archivo `conflicted` y no lo sobrescribe. Inc. MVP.
**REQ-035 Detectar IDs duplicados tras merge** — se reporta cada id duplicado con sus ubicaciones; las consultas por ese id devuelven `AMBIGUOUS_ID`. Inc. MVP. Reparación asistida (tool de reasignación de id + actualización de idrefs): Post.
**REQ-036 Detectar referencias rotas tras merge** — idrefs sin destino se reportan (VAL-003) sin bloquear la carga del resto. Inc. MVP.

---

### 4. Requisitos no funcionales (NFR)

| ID prov. | Nombre | Criterio verificable | Inc. | Fuente |
|---|---|---|---|---|
| NFR-001 | Portabilidad | Funciona en Linux, macOS y Windows con Node LTS (versión en DEC-001) sin Docker, sin servicios externos, sin compilación nativa en instalación; solo `npx` | MVP | [U][A][S] |
| NFR-002 | Funcionamiento sin red | Todas las funciones salvo, quizá, embeddings (P4) operan offline | MVP | [S] |
| NFR-003 | Diff/merge-friendly | Serialización determinista (REQ-005); layout separado del modelo; granularidad de archivos que minimice conflictos (P1); un cambio lógico no reordena contenido ajeno | MVP | [U][S] |
| NFR-004 | Seguridad de red local | UI/API HTTP ligadas a 127.0.0.1/::1 por defecto; exponer en otra interfaz requiere flag explícito con aviso; validación de `Host`/`Origin` (anti DNS-rebinding); sin CORS abierto; token de sesión aleatorio en la URL o cabecera (P12) | MVP | [U][S] |
| NFR-005 | Concurrencia de escritura | Escrituras serializadas en proceso; control optimista por revisión (hash de contenido) por documento; si pueden coexistir varios procesos sobre el mismo `/knowledge` (P5), lock de archivo entre procesos. Ninguna escritura pierde cambios ajenos en silencio | MVP | [U][S] |
| NFR-006 | Confinamiento de rutas | Ninguna lectura/escritura fuera de `/knowledge` (normalización, rechazo de `..`, de rutas absolutas y de symlinks que salgan); tools MCP no aceptan rutas arbitrarias | MVP | [U] |
| NFR-007 | Rendimiento (S7) | Arranque e indexado ≤3 s con 10 000 elementos; consultas estructuradas ≤200 ms p95; render de diagrama de 300 elementos ≤2 s; reindexado por cambio externo ≤2 s | MVP | [S] |
| NFR-008 | Modularidad | Módulos con interfaz explícita y sin dependencias cíclicas: almacén, formato/validación, índice/consultas, búsqueda semántica, MCP, HTTP/UI, CLI. MCP y UI usan el mismo núcleo | MVP | [U] |
| NFR-009 | Cumplimiento de licencias | Solo dependencias con licencia compatible (lista en DEC); clean-room para producto propietario (sin código, solo comportamiento/doc pública); spec UMJ reescrita y citada | MVP | [A] |
| NFR-010 | Observabilidad | Logs en stderr con nivel configurable; sin contenido de `/knowledge` en logs por defecto | MVP | [S] |
| NFR-011 | Compatibilidad de formato | Versionado semántico del formato; lectura de versiones anteriores soportadas con migración explícita; nunca reescritura silenciosa de versión | MVP (política) | [S] |

---

### 5. Validaciones (VAL)

| ID prov. | Nombre | Regla | Severidad |
|---|---|---|---|
| VAL-001 | Esquema submind-UMJ | Documento conforme al JSON Schema de su versión: colecciones permitidas, tipos de campos, campos obligatorios (`id`; `name`/`visibility` en elementos con nombre), enumeraciones (`visibility`; asociación `type` ∈ association/aggregation/composition, `direction` ∈ directed/undirected; `direction` de parámetro; `sort`/`kind` de mensaje; `operator` de combined fragment), y `null` admitido solo donde la spec lo permite (flags booleanos, `return_type`, `role`, `description`, `arguments`, `signature`) | error |
| VAL-002 | Unicidad de id | Cada `id` es único en el ámbito definido (P3: por modelo o global en `/knowledge`); ids no vacíos; formato de id para ids generados | error |
| VAL-003 | Integridad referencial `idref` | Todo `idref` apunta a un id existente **y de tipo compatible** con la clave (p. ej. generalización `general`/`specific` → clase; realización `supplier` → interfaz, `client` → clase; `send_event`/`receive_event` → occurrence specification; `covered` → lifeline; `signature` → operación; `class_diagrams.classes` → clase; `interaction` de interaction use → interacción). Referencias entre modelos: P13 | error |
| VAL-004 | Versión de formato | Campo de versión presente; mayor soportada → carga; versión anterior soportada → aviso + migración disponible; versión mayor desconocida → error, archivo no escribible | error/aviso |
| VAL-005 | Coherencia layout | Layout referencia un diagrama existente; entradas de elementos ausentes del diagrama → aviso `LAYOUT_ORPHAN`; valores numéricos finitos | aviso |
| VAL-006 | Integridad de archivo | JSON parseable, UTF-8, sin marcadores de conflicto Git, ruta dentro de `/knowledge` | error |
| VAL-007 | Reglas semánticas UMJ | Asociación `directed` va de `end1` a `end2`; orden de `fragments` significativo (no se reordena); relaciones solo en el modelo raíz, paquetes solo con referencias | error |

---

### 6. Estados y transiciones

**Documento de `/knowledge`**: `valid` · `valid_with_warnings` · `invalid_parse` · `invalid_schema` · `conflicted` · `unsupported_version`.
- Cualquier estado → (cambio en disco) → revalidación → nuevo estado.
- Solo `valid`/`valid_with_warnings` admiten escrituras MCP/UI.

**Servidor**: `starting` → `indexing` → `ready` | `degraded` (hay documentos no válidos) → `stopping` → `stopped`. `ready ↔ degraded` según revalidaciones.

**Índice semántico** (Post): `absent` → `building` → `ready` → `stale` (cambio de contenido) → `building`.

Los elementos del modelo no tienen ciclo de vida propio en UMJ (no se proponen estados de elemento).

---

### 7. Errores y casos límite

| Caso | Comportamiento propuesto | REQ/VAL |
|---|---|---|
| Conflicto de merge en un archivo de `/knowledge` | Estado `conflicted`, excluido de índices, escrituras bloqueadas, aviso en UI/MCP/CLI | REQ-034, VAL-006 |
| Archivo editado a mano con JSON inválido | `invalid_parse` con línea/columna; el resto sigue operativo | REQ-022, VAL-006 |
| Edición manual válida en JSON pero inválida en esquema | `invalid_schema` con JSON Pointer | VAL-001 |
| Ids duplicados tras merge | Reporte con ubicaciones; `AMBIGUOUS_ID` en consultas; escrituras que afecten a esos ids bloqueadas | REQ-035, VAL-002 |
| idref roto (elemento borrado en una rama, referenciado en otra) | Error de validación por referencia; el documento se carga marcado | REQ-036, VAL-003 |
| Escritura MCP y movimiento en UI simultáneos | Archivos distintos (modelo vs layout, S5); si coinciden, control por revisión → uno recibe `REVISION_CONFLICT` | NFR-005 |
| Dos procesos submind sobre el mismo `/knowledge` (p. ej. dos clientes MCP) | Lock + revisión; ver P5 | NFR-005 |
| `git checkout` cambia muchos archivos de golpe | Reindexado agrupado (debounce), sin estados intermedios expuestos como error | REQ-007 |
| Proceso matado durante escritura | Escritura atómica (temporal + rename) | REQ-008 |
| Ruta con `..`, absoluta o symlink fuera | `PATH_OUTSIDE_KNOWLEDGE` | NFR-006 |
| Petición HTTP con `Host`/`Origin` ajeno | Rechazo 403 | NFR-004 |
| Versión de formato más nueva que el binario | `unsupported_version`, solo lectura o excluido (P14) | VAL-004 |
| Puerto ocupado | Puerto alternativo o error claro (P11) | REQ-004 |
| `/knowledge` inexistente o vacío | Arranque normal, resultados vacíos | REQ-002 |
| Archivos no reconocidos dentro de `/knowledge` | Ignorados con aviso (no se borran) | [S] |
| Ciclos en impacto/caminos | Terminación garantizada | REQ-018/019 |
| Valores `null` | Se conservan; UI los muestra como "desconocido" | REQ-023/031 |

---

### 8. Agrupación en FEAT

| FEAT prov. | Nombre | REQ | Inc. |
|---|---|---|---|
| FEAT-001 | Comando CLI (`npx`) y ciclo de vida del proceso | REQ-001..004, 012 (CLI) | MVP |
| FEAT-002 | Almacén `/knowledge` (equivalente portable de TerminusDB) | REQ-005..008, 022 | MVP |
| FEAT-003 | Formato submind-UMJ, layout y validación | REQ-009..013 | MVP (013 Post) |
| FEAT-004 | Consultas estructuradas (grafo) | REQ-014..019 | MVP (019 Post*) |
| FEAT-005 | Búsqueda semántica | REQ-020 | Post |
| FEAT-006 | Administración vía MCP | REQ-021, 023..027 | MVP (027 Post) |
| FEAT-007 | Visor web JointJS con layout | REQ-028..033 | MVP |
| FEAT-008 | Integridad con Git (conflictos, duplicados, referencias) | REQ-034..036 | MVP (reparación Post) |

Dependencias: FEAT-003 → FEAT-002 → FEAT-004 → {FEAT-006, FEAT-007, FEAT-005}; FEAT-001 envuelve todo; FEAT-008 depende de FEAT-002/003.

Candidatos de entidad (para `system-modeler`, no exhaustivo): ENT por cada elemento de las Tablas 1 y 2 de UMJ + ENT Layout de diagrama + ENT Manifiesto de `/knowledge`. API: tools MCP (API-xxx) y API HTTP de UI (API-xxx).

Decisiones (DEC) a registrar: DEC stack (Node/TS, versión mínima); DEC formato base UMJ + extensiones propias; DEC almacén propio en lugar de TerminusDB; DEC granularidad de archivos (P1); DEC estrategia de IDs (P3/S8); DEC JointJS núcleo y licencias; DEC proveedor de embeddings (P4); DEC transporte MCP/proceso (P5).

---

### 9. Incremento mínimo

**MVP (iteración 1)**: arrancar con `npx`; `/knowledge` determinista con layout separado; spec + JSON Schema de clases **y** secuencia (validación completa, es barata); VAL-001..007; tools MCP: listar, obtener, buscar, relaciones, impacto, validar, crear modelo, CRUD de elemento, gestión de diagramas, lote atómico; UI: navegar, render de diagramas de clases, layout automático y persistente, detalle, refresco en vivo, estado de validación; detección de conflictos/duplicados/referencias rotas; NFR-001..011.

**Posterior**: búsqueda semántica (FEAT-005); caminos (REQ-019, salvo P8); render de secuencia (salvo P7); `dry_run`; reparación asistida de ids duplicados; nuevos tipos de diagrama (REQ-013); import/export XMI (no pedido, solo mencionado en el paper).

---

### 10. Tabla de perspectivas (coverage.yaml)

| Perspectiva | Aplica | Nota / cobertura |
|---|---|---|
| actors | sí | ACT-001..004 (CAP-002 covered) |
| requirements | sí | REQ-001..036, NFR-001..011 |
| business_rules | sí | reglas UMJ (null, dueño de relaciones, orden de fragmentos), canal UI vs MCP |
| io_validations | sí | VAL-001..007 |
| states | sí | §6 (CAP-010 partial) |
| data | sí | `/knowledge` como fuente de verdad, versión de formato; CAP-014 **deferred** → declarar |
| contracts | sí | tools MCP y API HTTP; spec del formato es contrato público; CAP-009 partial |
| architecture | sí | modularidad, almacén propio; propuesto como preguntas/DEC, no decidido aquí; CAP-010 partial |
| security | sí | loopback, Origin/Host, path traversal, licencias; CAP-013 partial |
| errors | sí | §7 |
| quality | sí | NFR-007/010; CAP-015 **deferred**, CAP-012 partial |
| traceability | sí | primer poblado del modelo; regenerar inventario |
| migrations | sí | versionado del formato (NFR-011, VAL-004); no hay datos previos |
| impact | no | greenfield, no hay componentes existentes |
| implementation | sí (posterior) | CAP-011 **deferred** hasta DEC stack |
| decisions | sí | §8 lista de DEC; tarea T2 → plan por etapas |
| environment | no | no se cambian agentes/skills; quizá ampliar CAP-011/014 tras DEC stack |

---

### 11. Preguntas priorizadas

**Bloqueantes** (para escribir fichas definitivas / diseñar FEAT-002):
1. **P1 Granularidad de archivos**: ¿un archivo UMJ por modelo (fiel al paper, peor para merges) o fragmentado (p. ej. un archivo por elemento de primer nivel/diagrama/layout) ensamblado lógicamente, con export a UMJ único? Propuesta: fragmentado + export.
2. **P3 IDs**: ¿submind genera ids opacos únicos globales (ULID/UUID) o se aceptan ids legibles del agente? ¿Unicidad por modelo o en todo `/knowledge`? Propuesta: generados, únicos globales.
3. **P5 Proceso/transporte**: ¿MCP por stdio lanzado por el cliente (un proceso por sesión de agente → varios procesos sobre el mismo `/knowledge`) o un servidor único (HTTP/SSE) al que se conectan agentes y UI? Determina la estrategia de concurrencia y quién abre la UI.
4. **P0 Stack**: confirmar Node/TypeScript y versión mínima de Node (DEC-001).
5. **P2 Raíz del proyecto**: ¿`cwd`, raíz Git más cercana, o configurable (`--root`, `--knowledge`)? ¿Literal `knowledge/` en la raíz?

**No bloqueantes** (se registran como `uncertainties`):
6. P4 Embeddings: ¿modelo local offline (descarga única) o API externa? ¿Índice en caché ignorada por Git? (bloquea solo FEAT-005).
7. P6 Licencia de submind (¿open source, comercial?). Relevante por CC BY-NC-ND del paper y licencias de dependencias.
8. P7 ¿Render de diagramas de secuencia en el MVP?
9. P8 ¿Caminos (REQ-019) en el MVP?
10. P9 ¿Puede el agente MCP modificar layout (p. ej. pedir auto-layout)?
11. P10 ¿Inicialización explícita (subcomando `init`) o implícita en la primera escritura?
12. P11 Puerto por defecto; ¿abrir navegador automáticamente?
13. P12 ¿Token de acceso para la UI local o basta loopback + Origin/Host?
14. P13 ¿Se permiten referencias entre modelos distintos?
15. P14 Versión de formato más nueva que el binario: ¿solo lectura o exclusión?
16. P15 Extensiones de UMJ más allá del layout (descripción/documentación por elemento, etiquetas, enlaces a código, estilos)?
17. P16 Nombre del paquete npm y del comando.
18. P17 REA (github.com/morluto/rea): confirmar qué es y su licencia — no consultado ([desconocido]).
19. P18 Ubicación de la spec en el repo (¿se distribuye con el paquete, p. ej. `spec/`?) y forma de la cita.

**Conflicto a señalar**: UMJ guarda un modelo completo en un único árbol JSON (H12/H13), lo que choca con NFR-003 (merges en Git) si se sigue literalmente → resolver con P1 y registrar como DEC (desviación declarada de UMJ).

---

# Anexo B · Investigación técnica


Leyenda: **[V]** verificado (fuente/comando indicado) · **[I]** inferido / recomendación propia · **[?]** desconocido.
Comprobaciones con `npm view` / `npm pack` ejecutadas hoy contra el registro público de npm.

---

### 1. REA (morluto/rea)

**Hechos**
- [V] Descripción: "Reverse engineer anything with agents, from app behavior down to native binaries." Licencia MIT (código propio de REA). Último push 2026-10-14. Fuente: https://github.com/morluto/rea, `gh api repos/morluto/rea`.
- [V] Paquete npm `rea-agents`, versión actual **6.5.0** (`npm view rea-agents version`). Requiere Node 22.x / 24.x / 26+.
- [V] Funciona como servidor MCP + CLI. Instalación/registro: `npx -y rea-agents@6.5.0 setup --client claude_code --dry-run --json` (luego `--yes`); diagnóstico: `doctor --client claude_code --json`. Fallback sin MCP: `npx -y rea-agents@6.5.0 analyze-javascript-application /ruta --json`. Fuente: `~/.claude/skills/reverse-engineer-anything/SKILL.md` (v42).
- [V] Targets: árboles JS / ASAR / Electron (módulos, imports, source maps, IPC; sin motor nativo), recuperación de fuentes JS empaquetado (`recover_javascript_sources`, requiere Wakaru), binarios nativos (Hopper/Ghidra/IDA), .NET, Android APK, WASM (WABT), metadatos de binarios Go y Rust (`inspect_rust_binary`: solo crates de cargo-auditable, no descompila lógica), SQLite, capturas de red, firmware, navegador/Electron en ejecución.
- [V] **Prolog no aparece** como target soportado (README y SKILL).
- [V] `rea` no está instalado en esta máquina (`which rea` → no encontrado).
- [V] El propio SKILL dice: "For ordinary analysis of a complete source repository, use normal repository tools and do not run REA".

**Valoración para submind**
- [I] **TerminusDB**: es open source (Apache-2.0, Prolog ~5 MB + Rust). Hay código fuente completo ⇒ REA no aporta; leer el repo y la documentación es más fiable. Sobre el binario/imagen Docker, REA solo daría metadatos de crates Rust y pseudocódigo nativo, inútil para Prolog.
- [I] **JointJS core**: MPL-2.0 con fuente pública ⇒ tampoco necesita REA. **JointJS+** es comercial/cerrado: aplicar REA al bundle de JointJS+ para "replicar" funcionalidad choca con un enfoque clean-room y con su licencia. **No recomendado**; reimplementar desde especificación funcional pública (docs/demos), no desde código desensamblado.
- [I] Uso legítimo de REA en submind: analizar el *propio* bundle de la UI (tamaño, imports, source maps) o auditar dependencias empaquetadas. Bajo valor al inicio.

### 2. TerminusDB — inventario y subconjunto a replicar

**Hechos**
- [V] Licencia **Apache-2.0**; última release **v12.0.8 (2026-10-12)**. Lenguajes: Prolog 4.97 MB, JS 1.59 MB, Rust 0.63 MB. Almacenamiento en `terminusdb-store` (Rust, Apache-2.0, "tokio-enabled data store for triple data"). Fuente: https://github.com/terminusdb/terminusdb, `gh api .../languages`, `.../releases/latest`.
- [V] Features declaradas: documentos JSON enlazados como grafo vía JSON-LD; esquema con validación; REST, GraphQL y WOQL; commits, push/pull/clone de diffs; time-travel a cualquier commit; "unification, path queries, and a datalog logic engine". Fuente: README.
- [V] Esquema (https://terminusdb.com/docs/schema-reference-guide/): `@key` Lexical / Hash / ValueHash / Random / UuidV7; `@subdocument` (propiedad exclusiva del padre); `@abstract`; `@inherits` múltiple (rangos compatibles; keys no se heredan); familias Optional / Set / List / Array (`Cardinality` obsoleta → `@min/@max_cardinality`); `Enum`; `@unfoldable`/`@unfold`; `@documentation` multilenguaje; `@metadata` libre; `Foreign` (sin integridad referencial).
- [V] JSON Diff/Patch (https://terminusdb.com/docs/json-diff-and-patch/): copia implícita; `SwapValue {@before,@after}`; Set (añadir/quitar); listas `CopyList`, `SwapList`, `PatchList`, `KeepList`; `Array`; `ForceValue` (sin chequeo de estado previo); `ModifyTable`. Endpoints `/api/diff` y `/api/patch`; diff por documento o por base completa entre versiones. Un patch con `@before` que no coincide falla ⇒ base para detección de conflictos.
- [V] (fuentes de terceros/cliente Elixir + doc de squash oficial) Fusión por modelo **rebase** (`/api/rebase`) que reproduce commits sobre el destino; error con descripción de conflictos. `reset` de HEAD a commit arbitrario (desde v3.0), `squash`. Fuentes: https://terminusdb.com/docs/squash-a-project-with-python, https://terminusdb-client.hexdocs.pm/TerminusDB.Merge.html, https://en.wikipedia.org/wiki/TerminusDB.
- [I/conocimiento previo, no reverificado hoy] Inmutabilidad por capas delta (cada commit añade una capa de adiciones/borrados de tripletas, con optimización/rollup); WOQL es un lenguaje datalog en JSON-LD con `path()` (regex sobre predicados, `+`, `*`, `{n,m}`); GraphQL autogenerado desde el esquema con filtros y `_path_to_X`.

**Qué tiene sentido en un motor embebido sobre JSON+git** [I]

| Feature TerminusDB | ¿Replicar? | Notas |
|---|---|---|
| Documentos JSON con `@id`/`@type` + refs = grafo | **Mínimo** | Grafo en memoria construido al cargar `./knowledge`; índices derivados (por tipo, refs entrantes/salientes). |
| Esquema de clases, herencia, abstract, subdocument, Optional/Set/List, Enum | **Mínimo** | Expresado como JSON Schema (UMJ) + metadatos propios; validar con Ajv. |
| Estrategias `@key` | **Mínimo parcial** | IDs estables legibles (Lexical-like o UUIDv7/ULID). Evitar ValueHash (cambia con el contenido → rompe diffs git). |
| Integridad referencial (refs a docs existentes, tipo de destino) | **Mínimo** | Fuera del schema (ver §6). |
| JSON-LD completo (`@context`, IRIs, expansión) | **Posterior/no** | Basta un `@context` mínimo opcional para exportar; no hace falta procesador JSON-LD. |
| Consultas: filtro por tipo/propiedad, vecinos, refs inversas | **Mínimo** | API TS + tools MCP. |
| Path queries (`a.b+`, alcanzabilidad, camino más corto) | **Mínimo simple / posterior completo** | BFS acotado al inicio; mini-DSL de path tipo regex después. |
| WOQL / datalog / unificación | **Posterior o nunca** | Coste alto; los agentes consumen mejor tools MCP específicos. |
| GraphQL autogenerado | **Posterior** | Solo si hay consumidores externos. |
| Commits, branches, time-travel | **Delegar a git** | git es la fuente de verdad; leer versiones con `git show <rev>:knowledge/...`. No duplicar. |
| Diff semántico de documentos (formato tipo Swap/Patch) | **Mínimo** | Necesario para UI/MCP ("qué cambió entre revs") y para merge driver. |
| Patch con `@before` (control optimista) | **Mínimo** | Las escrituras MCP/UI llevan versión/hash esperado ⇒ conflicto si cambió en disco. |
| Merge 3-way semántico + conflictos | **Posterior (pronto)** | Merge driver git propio (§7). |
| Rebase/squash/reset/push/pull/clone | **No** | Lo hace git. |
| Capas delta inmutables / store succinct | **No** | Git ya da inmutabilidad; índices derivados en caché. |

### 3. JointJS

**Hechos**
- [V] `@joint/core` **4.3.3**, licencia **MPL-2.0** (modificado 2026-09-04). `@joint/layout-directed-graph` **4.3.0** (MPL-2.0), depende de `@dagrejs/dagre ~1.1.4`, `@dagrejs/graphlib ~2.2.4`. `@joint/react` 4.3.6 (bindings React). Fuente: `npm view`.
- [V] Contenido de `@joint/core` 4.3.3 (`npm pack`, carpeta `src/`): `dia` (Graph, Paper, Cell…), `mvc`, `g` (geometría), `V` (Vectorizer), `alg`, `anchors`, `linkAnchors`, `connectionPoints`, `connectionStrategies`, `highlighters`, `elementTools`, `linkTools`, `cellTools`; routers `normal, orthogonal, manhattan, metro, oneSide, rightAngle`; connectors `normal, straight, rounded, smooth, curve, jumpover`; `layout/ports`; `shapes/standard.mjs` **únicamente**.
- [V] **No hay shapes UML en `@joint/core` 4.x** (solo `shapes.standard`; grep "uml" sin resultados). [I] Las shapes UML legacy (`joint.shapes.uml`) de versiones 3.x ya no se distribuyen en core; hay que definir shapes propias (fácil con `dia.Element.define` + markup SVG).
- [V] Funciones listadas como JointJS+ (comercial) en https://www.jointjs.com/features: Inspector, Stencil, TextEditor inline, PaperScroller (zoom/scroll), Navigator (minimapa), Clipboard, Keyboard, Selection, Halo, Popups/ContextMenu, Toolbar, Tooltips, PathEditor/FreeTransform, CommandManager (undo/redo), Validator, layouts Grid/Stack/ForceDirected/Tree, shapes BPMN/VSM/tablas, export PNG/JPEG/SVG/Canvas, Print, Visio. (La matriz de la web usa imágenes; la asignación es la del texto de la página.)

**A reimplementar clean-room (mínimo para "explorar + ajustar layout")** [I]
1. Shapes UML propias: clase (compartimentos nombre/atributos/operaciones, estereotipos), interfaz/enum, nota; links asociación/agregación/composición/herencia/realización/dependencia con marcadores y multiplicidades (labels). Secuencia: lifelines, activaciones, mensajes sync/async/return, fragmentos combinados (alt/loop/opt) — la secuencia requiere layout propio (no dagre).
2. Zoom/pan (wheel + drag sobre área en blanco) — sustituto de PaperScroller; trivial con `paper.scale/translate`.
3. Selección simple/múltiple (rubber band) y mover en grupo — sustituto de Selection.
4. Undo/redo — escuchar eventos `graph` y guardar comandos (sustituto de CommandManager).
5. Persistencia de layout: guardar posiciones/vertices en JSON separado del modelo semántico (o sección `layout` del diagrama).
6. Auto-layout: `@joint/layout-directed-graph` (MPL, dagre) para clases; layout propio en columnas/tiempo para secuencia. ELK (`elkjs` 0.12.0) es EPL-2.0/GPL — evaluar licencia antes.
7. Minimapa (opcional): segundo `Paper` escalado + rectángulo de viewport.
8. Export SVG: serializar el `<svg>` del paper (+ estilos inline); PNG vía canvas. Opcional.
9. Panel de propiedades de solo lectura (sustituto mínimo de Inspector) en HTML plano.
- [I] MPL-2.0 es copyleft por archivo: usar `@joint/core` sin modificar sus archivos no obliga a liberar el código propio; si se parchean archivos de JointJS, esos archivos modificados deben publicarse bajo MPL.

### 4. MCP

**Hechos**
- [V] `@modelcontextprotocol/sdk` **1.32.1** (MIT, 2026-10-05, Node ≥18; deps: zod ^3.25||^4, ajv, express, hono…). Transportes en `dist/esm/server/`: `stdio`, `streamableHttp`, `webStandardStreamableHttp`, `sse` (legado).
- [V] **v2 dividido en paquetes** y declarado estable: `@modelcontextprotocol/server` **2.3.1**, `@modelcontextprotocol/client` 2.3.1, `@modelcontextprotocol/node` 2.1.1 (middleware opcional, hono). README: "Start with the v2 documentation"; v1 en rama `v1.x` con fixes ≥6 meses. Ejemplo: `import { McpServer } from '@modelcontextprotocol/server'; import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'; import * as z from 'zod/v4';`. Fuente: https://github.com/modelcontextprotocol/typescript-sdk.
- [V] `.mcp.json` (scope proyecto, https://code.claude.com/docs/en/mcp):
  ```json
  { "mcpServers": { "submind": { "type": "stdio", "command": "npx", "args": ["-y", "submind@X.Y.Z", "mcp"] } } }
  ```
  o `claude mcp add --transport stdio --scope project submind -- npx -y submind mcp`. Soporta `${VAR}` / `${VAR:-default}`; `CLAUDE_PROJECT_DIR` está en el entorno del server pero en `.mcp.json` requiere default `${CLAUDE_PROJECT_DIR:-.}`. Claude Code pide aprobación interactiva de servers de proyecto (en `-p`/SDK se cargan sin preguntar).

**Patrón stdio + UI HTTP en un proceso** [I]
- Opción A (recomendada para MVP): `submind mcp` arranca `StdioServerTransport` (stdout reservado a JSON-RPC; **todo log a stderr**) y, en el mismo proceso, un `node:http` en `127.0.0.1` sirviendo la UI estática + API REST/WebSocket sobre el **mismo motor en memoria**. Puerto: preferido configurable, si ocupado probar siguiente; escribir `./.submind/runtime.json` (gitignored) con puerto/pid; tool MCP `open_ui` devuelve la URL.
- Problema: varias sesiones de agente ⇒ varios procesos stdio ⇒ varios servidores UI y escritores concurrentes. Mitigar con lockfile: el primero es "líder" de UI; los demás solo MCP; todos observan `./knowledge` con watcher (chokidar o `fs.watch`) y recargan; escrituras con chequeo `@before`/hash (patrón TerminusDB patch).
- Opción B: `submind serve` daemon único con Streamable HTTP en `/mcp` + UI en `/`; `.mcp.json` con `"type":"http","url":"http://127.0.0.1:PORT/mcp"`. Mejor concurrencia, pero requiere que el usuario arranque el daemon. Ofrecer ambas; A por defecto.
- Elegir v2 (`@modelcontextprotocol/server`) para código nuevo; mantener la capa MCP aislada tras un adaptador por si cambia la API.

### 5. Búsqueda semántica portable

**Hechos**
- [V] `@huggingface/transformers` **4.3.1** (Apache-2.0) depende de `onnxruntime-node` 1.30.0 (unpacked **~301 MB**, binarios multiplataforma), `onnxruntime-web`, `sharp`, `@huggingface/tokenizers`.
- [V] `Xenova/all-MiniLM-L6-v2` ONNX: `model.onnx` 90.4 MB, `model_fp16` 45.3 MB, `model_quantized`/`model_int8` 23 MB, `model_uint8` 22.8 MB, `model_q4f16` 30 MB. Fuente: https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main/onnx. [I] 384 dimensiones; en CPU, del orden de milisegundos a decenas de ms por frase corta (no medido aquí).
- [V] Léxico: `minisearch` 7.2.0 (MIT), `flexsearch` 0.8.212 (Apache-2.0), `@orama/orama` 3.1.18 (Apache-2.0, híbrido texto+vector en JS puro), `wink-bm25-text-search` 3.1.2 (MIT).
- [V] Índices vectoriales: `hnswlib-node` 3.0.0 (nativo), `usearch` 2.26.4 (nativo), `sqlite-vec` 0.1.9 (extensión SQLite), `@lancedb/lancedb` 0.40.0 (nativo, pesado), `vectra` 0.15.0 (JSON en archivo, MIT).

**Recomendación** [I]
- Corpus pequeño (cientos–miles de elementos de diagramas): **fuerza bruta** coseno sobre `Float32Array` es suficiente (10k×384 ≈ 15 MB, <10 ms). Sin dependencias nativas ⇒ portabilidad npx. HNSW solo si se superan ~100k vectores.
- Formato propio: `.submind/cache/embeddings.bin` (Float32 contiguo) + `embeddings.json` (id, hash de contenido, modelo, dim). Reindexar incrementalmente por hash.
- **Léxico como base obligatoria** (minisearch o BM25 propio) siempre disponible; **embeddings opcionales** (dependencia opcional / instalación diferida) porque `onnxruntime-node` añade ~300 MB al `npx` y descarga del modelo (~23 MB) a caché de HF (`~/.cache` o `env.cacheDir`). Fusión híbrida por RRF.
- Todo índice es derivado: `.submind/` (o `knowledge/.index/`) en `.gitignore`; regenerable desde `./knowledge`.

### 6. Validación JSON Schema

**Hechos**
- [V] `ajv` **8.20.0** (MIT, 2026-04-24) incluye `dist/2020` (draft 2020-12), `dist/2019`, `jtd`. Uso: `import Ajv2020 from "ajv/dist/2020.js"` + `ajv-formats` 3.0.1. El SDK MCP ya depende de ajv ^8.17.
- [V] Alternativas: `@cfworker/json-schema` 4.1.1 (MIT, sin codegen/eval), `@hyperjump/json-schema` 1.18.0 (MIT, muy fiel a la spec, más lento), `typebox` 1.3.37 (MIT, schema-first con tipos TS), `zod` 4.6.7 (TS-first, exporta JSON Schema).

**Recomendación** [I]
- Ajv 2020 compilado (rápido, `allErrors`, `strict`), con el schema UMJ como fuente canónica; generar tipos TS desde el schema (json-schema-to-typescript) o declararlo en TypeBox y emitir JSON Schema — elegir una sola fuente.
- [I] Ajv usa `new Function` (codegen): no es problema en Node; en navegador con CSP estricta usar `ajv standalone` precompilado o `@cfworker/json-schema`.
- Validación referencial fuera del schema (JSON Schema no resuelve referencias entre documentos): segunda pasada sobre el grafo cargado: (1) todo `idref` existe; (2) tipo del destino compatible con el rango declarado (p. ej. `generalization.target` es Classifier); (3) unicidad de IDs global; (4) sin ciclos de herencia; (5) subdocumentos con un único dueño; (6) mensajes de secuencia referencian lifelines del mismo diagrama y operaciones existentes. Anotar el rango en el schema con keyword propia (`x-ref: "Class"`) registrada en Ajv (`ajv.addKeyword`) para que el validador referencial lo lea del mismo schema.
- Errores con JSON Pointer + ruta de archivo para que agentes/MCP puedan corregir.

### 7. Diff/merge de JSON en git

**Hechos**
- [V] Merge driver personalizado: atributo `merge=<driver>` en `.gitattributes` y definición `[merge "<driver>"] driver = cmd %O %A %B %L %P` en `.git/config` o `~/.gitconfig` (`man gitattributes`, "Defining a custom merge driver"). [V/inferido de lo anterior] La definición **no viaja con el repo**: requiere `git config` local ⇒ comando `submind init` / `submind git-setup` que lo registre; sin él, git hace merge de texto normal.
- [V] Serialización estable disponible: `json-stable-stringify` 1.3.0, `safe-stable-stringify` 2.5.0, `fast-json-stable-stringify` 2.1.0 (todas MIT).

**Recomendaciones** [I]
- Granularidad: **un archivo por diagrama** es más legible pero concentra conflictos; **un archivo por elemento** minimiza conflictos y diffs pero dispersa. Propuesta intermedia: un archivo por **elemento del modelo** (clase, interfaz, interacción/secuencia) en `knowledge/model/<tipo>/<id>.json` y un archivo por **vista/diagrama** con referencias + layout en `knowledge/views/<id>.json`. Separar layout (posiciones, cambia mucho) de semántica (cambia poco) reduce ruido en revisiones.
- Formato canónico determinista: claves en orden fijo (orden del schema, no alfabético puro: `@id`, `@type`, `name`… luego resto alfabético), indentación 2, `\n` final, LF; arrays semánticamente no ordenados (Set) ordenados por id al escribir; números de layout redondeados (p. ej. enteros) para evitar ruido; un elemento de array por línea. Comando `submind fmt` + verificación en `check`/pre-commit.
- Merge driver `submind merge %O %A %B %P`: parsear 3 versiones, diff semántico tipo TerminusDB (Swap/Set/List por id), aplicar ambos lados; conflicto real solo si mismo campo cambió distinto. Escribir resultado canónico y, en conflicto, marcar en el JSON (`"x-conflict": {...}`) o salir ≠0 dejando marcadores. Para layout: estrategia "ours" o última escritura gana por elemento.
- IDs estables no derivados del contenido (ULID/UUIDv7 o slug inmutable) para que renombrar no cambie nombres de archivo.
- `git diff` legible: `diff=submind` con `textconv` opcional que imprima resumen semántico.

---

### Fuentes
- https://github.com/morluto/rea ; `~/.claude/skills/reverse-engineer-anything/SKILL.md` y `references/`
- https://github.com/terminusdb/terminusdb ; https://terminusdb.com/docs/schema-reference-guide/ ; https://terminusdb.com/docs/json-diff-and-patch/ ; https://terminusdb.com/docs/squash-a-project-with-python ; https://terminusdb-client.hexdocs.pm/TerminusDB.Merge.html ; https://en.wikipedia.org/wiki/TerminusDB
- https://www.jointjs.com/features ; contenido de `npm pack @joint/core@4.3.3`
- https://github.com/modelcontextprotocol/typescript-sdk ; https://code.claude.com/docs/en/mcp
- https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main/onnx
- `npm view` de todos los paquetes citados (2026-10-14); `man gitattributes`
