# `.flo` — grafo de conocimiento sobre archivos `.md` tipados

- **Fecha:** 2026-09-28
- **Rama:** `v2`
- **Estado:** completado: K1 y K2 el 2026-09-28, K3 el 2026-09-29 y K4 el 2026-09-30 ([K1](../plans/2026-09-28-flo-fase-k1-md-como-documento.md), [K2](../plans/2026-09-28-flo-fase-k2-consultas.md), [K3](../plans/2026-09-28-flo-fase-k3-mcp.md), [K4](../plans/2026-09-30-flo-fase-k4-vista-de-grafo.md)); F (del spec de entidades) completada el 2026-09-29
- **Origen:** SRS `REQ-KG-2026-01`, recortado en la sesión de diseño (ver §2).
- **Depende de:** las Fases D y E del spec
  [2026-09-19-flo-entidades-centralizadas.md](2026-09-19-flo-entidades-centralizadas.md),
  que siguen vigentes sin cambios. Las decisiones de lenguaje nuevas se
  registran en §11 de ese spec (#16–#22).

## 1. Propósito

Un sistema real acumula conocimiento que no es un diagrama: decisiones,
reglas de negocio, incidentes, patrones. Hoy eso vive en `.md` sueltos que
ningún diagrama referencia y que ningún agente puede consultar con
estructura.

Este spec hace que un `.md` con frontmatter tipado sea **una entidad más
del catálogo del workspace**: se valida, se relaciona con otras entidades,
aparece en los flujos `.flo` y se navega igual que ellas. Lo consumen por
igual:

- **humanos**, en el editor web (vista de grafo, filtros, drill-down);
- **agentes LLM**, por un servidor MCP local que lee y escribe los archivos
  del disco pasando por el mismo type-checker.

Los archivos en disco son la única fuente de verdad. No hay base de datos.

## 2. Decisiones de alcance

| Pregunta                                  | Decisión                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quién consume el grafo                    | **Humanos y agentes por igual.**                                                                                                                                                          |
| Cómo acceden los agentes                  | **Servidor MCP local** (`@flo/mcp`, Node, stdio) sobre una carpeta del disco. Sin servidor remoto.                                                                                        |
| Semántica de `memory_type`                | **Solo etiqueta**: enum validado, sirve para filtrar y para el estilo. Sin TTL ni promoción automática; promover es editar el archivo.                                                   |
| Quién escribe los `.md`                   | Humanos y agentes. Los agentes escriben por MCP y la escritura se rechaza si el type-checker falla.                                                                                        |
| Búsqueda semántica / embeddings / DB OLAP | **Diferidas.** La v1 filtra en memoria; el agente que consulta ya es un LLM y hace el razonamiento semántico sobre el resultado.                                                          |
| Vocabularios (`type_tags`, relaciones)    | **Esquema en el workspace**: `knowledge.schema.yaml` en la raíz. `context_tags` y `custom_tags` son libres (solo se valida la forma).                                                     |
| Qué es un `.md` respecto del catálogo     | **Una entidad del catálogo.** Un solo grafo, un solo `XRefIndex`. Un flujo `.flo` puede usarla en `a -> b`.                                                                               |
| Parser de frontmatter                     | Dependencia **`yaml`** (eemeli): sin dependencias propias, expone rangos por nodo. Sin TOML.                                                                                              |
| Visor                                     | **SVG actual + pan/zoom** por `viewBox`. Sin Paper.js.                                                                                                                                    |
| `imports` con alias del SRS               | **Eliminado.** Se reemplaza por `use:` (lista de rutas, misma semántica que `use` en `.flo`); las rutas en `relations.target` cuentan como `use` implícito.                              |

## 3. Formato del archivo `.md`

````markdown
---
id: decision_auth_pkce
title: "Decisión: OAuth2 + PKCE"
memory_type: long_term
type_tags: [decision, architecture]
context_tags: ["project:core", "flow:authentication"]
custom_tags:
  status: approved
  security_level: 3
use: ["../catalogo.flo"]
relations:
  - target: ../business_rules/br_passwords.md
    type: enforces
  - target: ../flujos/auth.flo#acceso
    type: visualized_by
  - target: api
    type: affects
---

# Decisión de arquitectura: OAuth2 + PKCE

Texto libre en Markdown.

```flo
flow pkce "Validación PKCE" {
  api -> auth : validar code_verifier
  auth -> api : refresh token
}
```
````

### 3.1 Campos del frontmatter

| Campo          | Tipo                               | Obligatorio | Validación                                                                  |
| -------------- | ---------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `id`           | identificador `.flo`               | sí          | misma regla léxica que el id de `entity`; único en el workspace (`E031`)   |
| `title`        | string                             | sí          | no vacío                                                                    |
| `memory_type`  | `working \| short_term \| long_term` | sí          | enum cerrado en el core                                                     |
| `type_tags`    | lista de identificadores           | no          | cada uno declarado en el esquema                                            |
| `context_tags` | lista de strings `clave:valor`     | no          | forma `clave:valor`, ambos no vacíos                                        |
| `custom_tags`  | mapa `clave → escalar`             | no          | valores string, número o booleano                                           |
| `use`          | lista de rutas relativas           | no          | cada ruta existe en el workspace (`E032`)                                   |
| `relations`    | lista de `{target, type}`          | no          | `type` declarado en el esquema; `target` resuelve (§3.2)                    |

Un campo que no está en esta tabla es error. El frontmatter es obligatorio:
un `.md` sin él no es un documento del workspace. El parser del workspace
solo toma los `.md` que empiezan con `---`; los demás se ignoran sin
diagnóstico (READMEs, notas sueltas).

### 3.2 `relations.target`

Tres formas, que se distinguen por la sintaxis:

| Forma              | Ejemplo                   | Resuelve a                                           |
| ------------------ | ------------------------- | ---------------------------------------------------- |
| ruta a `.md`       | `../br/passwords.md`      | la entidad que declara ese `.md`                     |
| ruta a bloque      | `../flujos/auth.flo#acceso` | el bloque `acceso` de ese documento                |
| id de entidad      | `api`                     | una entidad del catálogo alcanzable desde este `.md` |

Una ruta es cualquier valor que contiene `/` o termina en `.md`/`.flo`. Las
rutas son relativas al `.md` y cuentan como `use` implícito; el catálogo
alcanzable es el de `use` + esas rutas, transitivo y deduplicado como en la
Fase D. Un target que no resuelve es `E035`.

### 3.3 Bloques `flo` embebidos

Cada bloque de código cercado con info-string `flo` se parsea con
`parseDocument` como si fuera un `.flo`, con los rangos desplazados a su
posición en el `.md`. Sus entidades y bloques entran al workspace con el
`uri` del `.md`. Los demás bloques de código se ignoran.

### 3.4 Esquema `knowledge.schema.yaml`

```yaml
type_tags: [architecture, business_rule, decision, incident, pattern]
relation_types: [enforces, visualized_by, affects, supersedes]
```

- Un único archivo, en la raíz del workspace (uri exacto
  `knowledge.schema.yaml`). Es un documento más: `setDocument` lo carga.
- Si hay al menos un `.md` de conocimiento y no hay esquema, se reporta un
  único `E068` sobre el primer `.md`, y no se valida vocabulario (el resto
  de la validación sigue). *Enmendado por #61: el esquema es opcional; sin
  él no hay diagnóstico y `E068` queda solo para un esquema inválido.*
- Sin herencia ni tipos compuestos: no existen "ciclos en definiciones de
  tipos". Los ciclos en `relations` son válidos, como en `use`.

## 4. Modelo

```ts
type MemoryType = "working" | "short_term" | "long_term";

interface KnowledgeMeta {
  memoryType: MemoryType;
  typeTags: string[];
  contextTags: string[];              // "clave:valor"
  customTags: Record<string, string | number | boolean>;
  relations: Relation[];
  body: string;                       // Markdown sin frontmatter
}

interface Relation {
  type: string;
  target: string;                     // tal como se escribió
  resolved: { kind: "entity"; id: EntityId } | { kind: "block"; id: BlockId } | null;
  range: Range;
}

interface EntityDecl {
  // … campos actuales …
  knowledge: KnowledgeMeta | null;    // null en entidades declaradas en .flo
}
```

Una entidad de `.md` tiene `label = title`, `shape = "rectangle"`,
`type = null`, `tags = []`, `range` = el frontmatter completo y
`nameRange` = el valor de `id`. Renombrar (Fase F) edita ese rango como
cualquier otra declaración.

`XRefIndex` suma:

```ts
relationsFrom(id: EntityId): Relation[];
relationsTo(id: EntityId): { from: EntityId; relation: Relation }[];
```

Las referencias a una entidad desde `relations` cuentan en `referencesTo`
(para "usado en N lugares" y renombrar).

## 5. Consultas (core, puro)

```ts
type Where =
  | { and: Where[] } | { or: Where[] } | { not: Where }
  | { memory: MemoryType }
  | { typeTag: string }
  | { contextTag: string }              // exacto "clave:valor", o "clave:" = cualquier valor
  | { custom: string; equals?: string | number | boolean }
  | { text: string };                   // substring sin distinguir mayúsculas en title + body

interface QueryOptions {
  where?: Where;                        // omitido = todas
  from?: EntityId[];                    // semillas explícitas; se intersecan con where
  depth?: number;                       // 0 por defecto
  project?: "meta" | "full" | "full+diagrams";
}

interface QueryResult {
  nodes: QueryNode[];                   // semillas primero, luego por distancia, luego orden del catálogo
  edges: { from: EntityId; to: EntityId; type: string; blocks?: BlockId[] }[];
}

function query(link: LinkResult, opts: QueryOptions): QueryResult;
function tagCatalog(link: LinkResult): { typeTags; contextTags; customTags: Record<string, Value[]> };
```

- **Semillas:** entidades que cumplen `where` (y están en `from` si se da).
  Los predicados de conocimiento solo los cumplen entidades con
  `knowledge`; las entidades `.flo` entran por expansión.
- **Expansión:** BFS no dirigido hasta `depth` sobre dos tipos de arista:
  `relations` (tipo = el de la relación) y el grafo agregado de flujos
  (tipo `flow`, con los bloques que la contienen). Un nodo aparece una vez,
  a su distancia mínima.
- **Proyección:** `meta` = id, title/label, uri, memoryType y tags; `full` =
  además `body`; `full+diagrams` = además el texto fuente de los bloques
  `flo` embebidos.
- `edges` son todas las aristas entre nodos del resultado.

## 6. `@flo/mcp`

Paquete Node nuevo en `packages/mcp`. Dependencias: `@flo/core` y el SDK
oficial de MCP (`@modelcontextprotocol/sdk`, con su peer `zod`).

```
flo-mcp <carpeta>
```

- **Carga:** recorre la carpeta (`.flo`, `.md` con frontmatter,
  `knowledge.schema.yaml`; ignora `node_modules` y `.git`), hace
  `setDocument` de cada uno y `link()`.
- **Sincronización:** `fs.watch` recursivo; ante un cambio re-lee ese
  archivo, `setDocument`/`removeDocument` y vuelve a hacer `link()`. Sin
  caché persistente: el disco manda siempre.
- **Herramientas:**

| Herramienta  | Entrada                          | Salida                                                   |
| ------------ | -------------------------------- | -------------------------------------------------------- |
| `query`      | `QueryOptions`                   | `QueryResult`                                            |
| `get_node`   | `id`, `project?`                 | un `QueryNode` + relaciones entrantes y salientes        |
| `list_tags`  | —                                | `tagCatalog`                                             |
| `check`      | `path?`                          | diagnósticos del workspace (o de un archivo)             |
| `write_node` | `path`, `content`                | ok, o los diagnósticos que impidieron escribir           |

- **`write_node`:** valida en un workspace de prueba (el actual + el
  archivo nuevo o editado) y solo escribe si ese archivo no tiene errores y
  no aparecen errores nuevos en otros archivos. Escritura atómica (archivo
  temporal + `rename`). La ruta se normaliza y **debe** quedar dentro de la
  carpeta raíz y terminar en `.md` o `.flo`; lo demás se rechaza.
- Sin borrado en la v1: lo hace un humano.

## 7. Vista de grafo de conocimiento (web)

Requiere la parte multi-documento de la Fase F (abrir una carpeta con
`showDirectoryPicker` y el workspace con varios documentos).

- **Render:** un render nuevo en `@flo/core` toma `QueryResult` y produce
  SVG con dagre, igual que el flowchart. Los nodos llevan la clase
  `flo-mem-<memory_type>` (color por tipo de memoria, con leyenda); las
  entidades `.flo` usan su forma normal. Las aristas llevan el tipo de
  relación como label. Atributos `data-flo-*` como en la Fase E.
- **Pan/zoom:** manipulando el `viewBox` del SVG (arrastrar y rueda).
- **Drill-down:** click en un nodo `.md` abre el archivo en el editor;
  click en una arista `visualized_by` a un bloque abre ese flujo con el nodo
  resaltado; desde un flujo, click en una entidad `.md` vuelve a la vista
  de grafo centrada en ella.
- **Filtros:** una barra que arma un `Where` (memoria, tags, texto) y un
  `depth`; ejecuta el mismo `query` del core.
- **Presets:** `{ name, where, from, depth, viewBox }` guardados en
  `.flo/views/<name>.json` dentro de la carpeta abierta, para versionarlos y
  compartirlos. Sin posiciones manuales de nodos (el layout es de dagre).

## 8. Diagnósticos nuevos

| Código | Fase | Significado                                                        |
| ------ | ---- | ------------------------------------------------------------------ |
| `E035` | K1   | `relations.target` no resuelve a una entidad, `.md` o bloque       |
| `E060` | K1   | frontmatter sin cerrar (falta el `---` final)                      |
| `E061` | K1   | error de sintaxis YAML en el frontmatter o en el esquema           |
| `E062` | K1   | falta un campo obligatorio (`id`, `title`, `memory_type`)          |
| `E063` | K1   | valor con tipo inválido para su campo                              |
| `E064` | K1   | `memory_type` fuera de `working`, `short_term`, `long_term`        |
| `E065` | K1   | `type_tag` no declarado en el esquema                              |
| `E066` | K1   | tipo de relación no declarado en el esquema                        |
| `E067` | K1   | campo de frontmatter desconocido                                   |
| `E068` | K1   | falta `knowledge.schema.yaml` o su contenido es inválido           |

`E030`–`E034` conservan su significado; `E032` también cubre una ruta de
`use:` en un `.md` que no existe. El rango `E06x` queda para frontmatter y
esquema. Todos se agregan a la tabla de `packages/core/GRAMMAR.md`.

## 9. Fuera de alcance

- Búsqueda semántica, embeddings, base de datos columnar o vectorial,
  sync worker. Se reabren cuando el volumen de documentos lo justifique.
- Paper.js y cualquier canvas; posiciones manuales de nodos.
- Ciclo de vida de memoria (TTL, expiración, consolidación automática).
- Frontmatter en TOML.
- Borrado de nodos por MCP.
- Servidor remoto, cuentas o multiusuario.

## 10. Fases y entregables

Orden: **D → E → K1 → K2 → K3 → F → K4.** D, E y F son las del spec de
2026-09-19; K3 va antes que F porque da valor a los agentes sin UI.

**K1 — `.md` como documento del workspace (core)**

- `parseMarkdownDocument(source, uri)`: frontmatter con `yaml` y rangos,
  bloques `flo` embebidos, `EntityDecl.knowledge`.
- Esquema como documento; type-checker; `E035`, `E060`–`E068`.
- `use:` y rutas de `relations` entran a la resolución transitiva de D.
- `XRefIndex.relationsFrom` / `relationsTo`.

**K2 — consultas (core)**

- `query` y `tagCatalog`, puros, exportados en la API pública.

**K3 — `@flo/mcp`**

- Carga, `fs.watch`, las cinco herramientas, validación y escritura
  atómica de `write_node`, guarda de ruta.
- Test de integración sobre una carpeta temporal.

**K4 — vista de grafo de conocimiento (web)**

- Render de `QueryResult`, pan/zoom, drill-down, barra de filtros, presets.

## 11. Testing

- K1: tests por diagnóstico (un caso que dispara cada código con su
  `Range`), un ejemplo válido completo, bloques `flo` embebidos con rangos
  desplazados, resolución cruzada `.md` ↔ `.flo`.
- K2: tabla de consultas sobre un workspace fijo (AND/OR/NOT, cada
  predicado, `depth` 0/1/2, las tres proyecciones, orden del resultado).
- K3: carpeta temporal; `write_node` válido, inválido y con ruta fuera de
  la raíz; cambio en disco reflejado en la siguiente `query`.
- K4: snapshot SVG nuevo para el render de conocimiento; tests de
  filtros, drill-down y presets (lectura/escritura en un directorio falso)
  con el DOM de prueba que ya usa web.
- Los snapshots existentes no cambian.
