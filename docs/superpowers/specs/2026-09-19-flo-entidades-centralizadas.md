# `.flo` — entidades centralizadas, flujos como vistas y navegación cruzada

- **Fecha:** 2026-09-19
- **Rama:** `v2`
- **Estado:** fases A–F completadas (A–E el 2026-09-28, F el 2026-09-29, [plan](../plans/2026-09-29-flo-fase-f-navegacion-en-el-editor.md)); K1, K2 y K3 del [spec de conocimiento](2026-09-28-flo-grafo-de-conocimiento-design.md) también; queda K4
- **Reemplaza:** las secciones §2 (fila "Gestión de archivos"), §4 y §8 del
  spec [2026-09-17-flo-diagram-tool-design.md](2026-09-17-flo-diagram-tool-design.md).
  El resto de aquel documento (arquitectura de paquetes, manejo de errores,
  modelo del editor, testing) sigue vigente.

## 1. Propósito

Hoy un archivo `.flo` es autocontenido: declara sus propios nodos y no sabe
nada de los demás archivos. Eso funciona para un diagrama suelto y se rompe
en cuanto hay un sistema real, donde la misma entidad (`API Gateway`, `Base
de datos`, `Usuario`) aparece en diez diagramas distintos:

- El mismo concepto se escribe distinto en cada archivo (`api`, `Api`,
  `gateway`) y nadie lo detecta.
- Renombrar o cambiar la forma de una entidad obliga a editar N archivos a
  mano.
- No hay forma de responder "¿en qué flujos participa la base de datos?".
- No hay manera de saltar de un diagrama a otro.

Este spec introduce tres cambios acoplados:

1. **Catálogo de entidades** — la entidad es una declaración de primer
   nivel, única fuente de verdad de su id, label, forma y metadatos.
2. **Flujos como vistas** — un diagrama deja de poseer nodos; es una lista
   de relaciones _sobre_ el catálogo.
3. **Índice de referencias cruzadas** — un grafo consultable que habilita
   "ir a definición", "usado en N flujos" y un mapa agregado del sistema.

## 2. Decisiones de alcance

Tomadas durante la sesión de diseño:

| Pregunta                              | Decisión                                                                                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cómo se comparten las entidades       | **Explícito**: cada archivo declara `use "./catalog.flo"`. El archivo sigue siendo autodescriptivo — se puede leer sin adivinar de dónde salen los nombres.            |
| Varios diagramas por archivo          | **Sí**, mediante bloques nombrados `flow login { ... }`. Habilita el anidamiento futuro (subgrafos, `alt`/`loop`) que la gramática ya tenía reservado.                 |
| Entidad referenciada sin declarar     | **Error duro** (no warning, no autodeclaración). La consistencia estricta es el punto del catálogo; sin ella el índice de referencias es basura.                       |
| Metadatos de entidad                  | Label + forma + **tipo y tags libres**. No se modela ownership, URLs ni documentación: eso convierte el catálogo en un registro de arquitectura, que es otro producto. |
| Compatibilidad con la sintaxis actual | **Ninguna.** `@flo/core` está en `0.0.0`, sin usuarios ni archivos en producción. Ruptura limpia en vez de mantener `diagram <kind>` como legacy.                      |
| Resolución de `use`                   | Transitiva y deduplicada. Los ciclos se cortan por visitado, no son error.                                                                                             |
| Backend                               | Sigue sin haber. El "workspace" es un conjunto de documentos en memoria, alimentado por el editor.                                                                     |

## 3. Modelo conceptual

```
Workspace
 ├── Catálogo de entidades   (identidad + representación, una sola vez)
 └── Flujos                  (vistas parciales: relaciones entre entidades)
```

La distinción que ordena todo el diseño es **identidad vs. representación**:

- La **entidad** posee su id, su label y su forma. Existe aunque ningún
  diagrama la use.
- El **flujo** no posee nada. Sus nodos se _derivan_ del conjunto de
  entidades que sus aristas referencian.

Consecuencias directas:

- Renombrar una entidad se propaga a todos los diagramas.
- Una entidad se ve igual en todos los diagramas donde aparece.
- "¿Dónde se usa `Db`?" es el índice inverso de las referencias.
- Unir las aristas de todos los flujos produce un **mapa agregado del
  sistema** que nadie escribió a mano.

## 4. Sintaxis

### 4.1 Catálogo

Forma corta (una línea) y forma con cuerpo, para cuando hay metadatos:

```flo
// catalog.flo
entity User (Usuario)       type: actor
entity Api  [API Gateway]   type: service, tags: http internal
entity Db   {PostgreSQL}    type: store

entity Worker [Job Runner] {
  type: service
  tags: async internal
}
```

La forma se mantiene con los delimitadores actuales (`[rect]`,
`(redondeado)`, `{decisión}`) y el texto interior es el label. `type` y
`tags` son strings libres: el core los valida sintácticamente pero no
interpreta sus valores — son para filtrar y agrupar en la UI.

### 4.2 Flujos

El header `diagram <kind>` desaparece. Un archivo puede contener varios
bloques nombrados, de tipos distintos:

```flo
// login.flo
use "./catalog.flo"

flow login "Inicio de sesión" {
  User -> Api : POST /login
  Api  -> Db  : buscar credenciales
  Db   -> Api : perfil
}

sequence login_detail "Detalle temporal" {
  User -> Api : POST /login
  Api  -> Db  : SELECT
}
```

- `flow` produce un flowchart; `sequence` una secuencia. Ambos referencian
  el mismo catálogo.
- El título entre comillas es opcional; el nombre del bloque es su id
  dentro del workspace y debe ser único.
- **Dentro de un bloque solo hay aristas.** No hay declaración de nodos.
- La autodeclaración de participantes de `sequence` se elimina:
  `Cache -> Api` sin `entity Cache` es error, con fix sugerido
  _"añade `entity Cache` a ./catalog.flo"_.

Un archivo puede mezclar `entity` y bloques de diagrama; la separación
catálogo/flujos es una convención de organización, no una regla del
lenguaje.

### 4.3 Principios que se conservan

Del spec anterior siguen valiendo: gramática determinista sin heurísticas
de texto, un statement por línea dentro de los bloques, `{ }` para
anidamiento en vez de indentación significativa, y comentarios `//`
uniformes.

## 5. Prerrequisito: lexado dirigido por el parser

El lexer actual decide los modos a ciegas sobre el texto plano. Eso genera
dos colisiones irreconciliables con esta sintaxis:

- `{` entra en modo texto hasta `}` porque asume la forma `decisión` — con
  bloques `flow x { ... }` eso se traga el cuerpo entero.
- `as` es palabra reservada **global** y dispara modo texto hasta fin de
  línea, incluso donde no tiene significado gramatical.

La solución no es parchear casos: es invertir el control. El lexer pasa a
ser perezoso y el parser, que sí sabe en qué posición sintáctica está,
pide el modo:

```ts
class Lexer {
  next(mode: 'code'): Token; // idents, símbolos, strings
  readTextUntil(closer: ']' | ')' | '}' | '\n'): Token; // label o texto de arista
}
```

Esto elimina la ambigüedad de `{` de raíz, vuelve `as` contextual y deja el
camino libre para el anidamiento futuro. Es un refactor interno: la API
pública `parse()`/`render()` no cambia y la suite actual sirve de red.

Se agrega además un token de string (`"..."`) para `use` y para los títulos
de bloque.

## 6. Arquitectura

Pipeline nuevo. La fase de **link** es la que hoy no existe:

```
Lexer(modo) → parseDocument(uri) → Workspace.link() → layout(bloque, catálogo) → render
                     │                    │
               por documento        cross-document: resuelve Refs,
                                    construye el índice de referencias
```

```
packages/core/src/
  lexer.ts                 # modos dirigidos por el parser
  ast.ts                   # Range, Document, EntityDecl, DiagramBlock, Ref
  parser/document.ts       # parseDocument(source, uri) -> ParsedDocument
  parser/{entity,flow,sequence}.ts
  workspace/workspace.ts   # nuevo
  workspace/resolver.ts    # nuevo
  workspace/xref.ts        # nuevo
  layout/ render/
```

### 6.1 Tipos clave

```ts
interface Range {
  start: Position;
  end: Position;
}

interface EntityDecl {
  id: string;
  label: string;
  shape: NodeShape;
  type: string | null;
  tags: string[];
  uri: DocumentUri;
  range: Range; // la declaración completa
  nameRange: Range; // solo el identificador
}

interface Ref {
  // reemplaza los `from: string` crudos
  name: string;
  range: Range;
  target: EntityId | null; // null tras link() ⇒ E030
}

interface FlowBlock {
  kind: 'flow';
  name: string;
  title: string | null;
  edges: Edge[];
  range: Range;
}

class Workspace {
  setDocument(uri: DocumentUri, source: string): void;
  removeDocument(uri: DocumentUri): void;
  link(): LinkResult; // { entities, diagnostics, xref }
}
```

`Position` → `Range` es un cambio transversal en el AST y en `Diagnostic`.
Sin rango de fin no se puede subrayar un error, hacer hit-test del cursor,
resaltar al navegar ni renombrar. El lexer ya conoce la longitud de cada
token, así que el `end` es derivable donde hoy se construye el `Position`.

### 6.2 Índice de referencias cruzadas

Es la pieza que habilita toda la navegación:

```ts
interface XRefIndex {
  definitionOf(id: EntityId): Location | null; // ir a definición
  referencesTo(id: EntityId): Location[]; // "usado en N lugares"
  flowsUsing(id: EntityId): BlockId[]; // entidad → flujos
  entitiesIn(block: BlockId): EntityId[]; // flujo → entidades
  neighbors(id: EntityId): EntityId[]; // grafo agregado del sistema
}
```

### 6.3 Anotación del SVG

El render emite atributos de datos en cada elemento generado, para que el
preview deje de ser una imagen muerta:

```html
<g
  data-flo-entity="Api"
  data-flo-block="login.flo#login"
  data-flo-uri="login.flo"
  data-flo-line="4"
></g>
```

Los tipos de `layout/` pasan a exportarse en la API pública de `@flo/core`:
hoy son internos y un consumidor solo puede obtener el SVG serializado.

### 6.4 Relinkeo

`link()` es una pasada completa sobre los documentos en memoria. A la
escala objetivo (decenas de archivos, cientos de entidades) no se justifica
linking incremental: se reparsea el documento editado y se relinkea todo.

## 7. Diagnósticos nuevos

| Código | Significado                                                       |
| ------ | ----------------------------------------------------------------- |
| `E030` | Entidad referenciada pero no declarada en el catálogo alcanzable. |
| `E031` | Entidad declarada dos veces (mismo id en documentos distintos).   |
| `E032` | `use` apunta a un documento inexistente.                          |
| `E033` | Nombre de bloque duplicado en el documento (decisión #25).        |
| `E034` | Propiedad de entidad desconocida.                                 |

Se mantiene la recuperación de errores del parser: un `E030` no impide
renderizar el resto del flujo, y el nodo sin resolver se dibuja como
placeholder marcado.

## 8. Editor web

Sobre el split-pane ya especificado, se agrega:

- **Explorador lateral** con dos árboles: catálogo (entidades, filtrables
  por `type` y `tags`) y flujos (agrupados por documento).
- **Panel de entidad**: al hacer click en un nodo del preview o en una
  entidad del explorador, muestra label, tipo, tags y la lista _"aparece en
  N flujos"_. Click en un flujo de esa lista lo abre y resalta el nodo.
- **Ir a definición**: Ctrl+click sobre un identificador en el editor salta
  a su `entity`, en el archivo que sea.
- **Renombrar**: renombra el `nameRange` de la declaración y el de todas
  sus referencias, en todos los documentos, en una sola operación.
- **Vista mapa**: grafo agregado de todas las aristas de todos los flujos.
  Click en una arista lista los flujos que la contienen.

La persistencia sigue siendo local (File System Access API + fallback,
autosave a IndexedDB). El workspace es el conjunto de documentos abiertos:
no hay índice en disco ni proyecto formal.

## 9. Fuera de alcance (explícito)

- Backend, cuentas, colaboración o almacenamiento compartido. _(Sin cambios
  respecto al spec anterior: el multi-archivo es del lado del cliente.)_
- Importador o compatibilidad con Mermaid.
- Tipos de diagrama más allá de flowchart y secuencia.
- Metadatos ricos de entidad (owner, enlaces, descripción larga) y todo lo
  que convierta el catálogo en un registro de arquitectura.
- Layout consciente del catálogo (posiciones fijas por entidad,
  carriles/swimlanes por `type`). Tentador, pero es otro problema.
- Anidamiento real (subgrafos, `alt`/`loop`): esta ronda solo deja la
  gramática preparada para él.
- Linking incremental y caché de layout.

## 10. Fases y entregables

**Fase A — `Position` → `Range`**

- `Range` en todos los nodos del AST y en `Diagnostic`.
- Sin cambios de sintaxis ni de comportamiento observable.
- Suite actual en verde, con los rangos verificados en los snapshots.

**Fase B — Lexer dirigido por el parser**

- `Lexer` perezoso con `next(mode)` / `readTextUntil(closer)`.
- `as` contextual; `{` deja de disparar modo texto por sí solo.
- Token de string. API pública sin cambios, suite actual en verde.

**Fase C — Entidades y bloques nombrados (documento único)**

- `entity` con forma corta y con cuerpo (`type`, `tags`).
- Bloques `flow` / `sequence` con nombre y título; el header
  `diagram <kind>` se elimina.
- Resolución estricta dentro del documento (`E030`, `E033`, `E034`).
- Layout y render toman el catálogo como entrada.
- GRAMMAR.md reescrito.

**Fase D — Workspace multi-documento**

- `use` con resolución transitiva y deduplicada.
- `Workspace.setDocument` / `removeDocument` / `link()`.
- `XRefIndex` completo. `E031`, `E032`.
- Resolución cruzada verificada sobre un set de documentos de prueba.

**Fase E — Superficie de navegación en el core**

- Atributos `data-flo-*` en el SVG.
- Tipos de `layout/` exportados en la API pública.
- `@flo/core` expone el workspace y el índice, no solo `parse`/`render`.

**Fase F — Navegación en el editor**

- Explorador de catálogo y flujos.
- Panel de entidad con "aparece en N flujos" y salto al flujo.
- Ir a definición y renombrar cross-document.
- Vista mapa agregada.

Las fases A y B son independientes del cambio de lenguaje: valen la pena
por sí solas y son prerrequisito de todo lo demás.

## 11. Decisiones de implementación (registro)

Decisiones que el spec dejaba abiertas y que más de una fase vuelve a
encontrar. Se agregan al final, no se reescriben; cambiar una exige
anotarlo aquí con fecha y motivo. Los planes las citan en vez de
redecidirlas.

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 1 | 2026-09-27 | **Orden de nodos / columnas** = orden de declaración de las entidades en el catálogo; las referencias sin resolver van al final, en orden de aparición. Nunca "orden de primera aparición en las aristas". | layout (C), catálogo multi-documento (D: el orden de los documentos alcanzables debe ser determinista), mapa agregado (F) |
| 2 | 2026-09-27 | **La primera declaración de un id gana**; las siguientes se reportan con `E031`, dentro del documento o entre documentos. | resolver (C, D) |
| 3 | 2026-09-27 | **Palabras clave contextuales**: `entity`, `flow`, `sequence` (y `use` en D) solo son especiales al inicio de una línea de nivel superior; dentro de un cuerpo son identificadores. Ninguna palabra es reservada en el lexer. | parser (C, D, anidamiento futuro) |
| 4 | 2026-09-27 | **Ambigüedad de `{`**: tras el id de una entidad, si el resto de la línea está vacío o es comentario abre un cuerpo; si no, es la forma `{decisión}`. Se decide mirando la línea cruda (`Lexer.restOfLineIsBlank()`), no con heurísticas de texto. | parser (C, anidamiento futuro) |
| 5 | 2026-09-27 | **`entity` sin forma** es válida: rectángulo con su id como label. | parser, fix sugerido de `E030` |
| 6 | 2026-09-27 | **Valores de propiedades** (`type`, `tags`) son identificadores: `type` uno, `tags` uno o más; propiedades separadas por `,`. Strings libres quedan fuera hasta que un caso real lo pida. | parser, filtros de la UI (F) |
| 7 | 2026-09-27 | **Sin errores en cascada**: con error después del id, la entidad se conserva parcial; un bloque sin `}` se conserva con lo parseado (`E052`); una racha de líneas inválidas de nivel superior da un solo `E040`. | parser (C, D) |
| 8 | 2026-09-27 | **Referencia sin resolver** se dibuja como placeholder punteado (`stroke-dasharray="4 4"`, clase `flo-unresolved`) con su nombre como label. | render (C, E: atributos `data-flo-*`) |
| 9 | 2026-09-27 | **Códigos de diagnóstico retirados no se reusan.** Rangos: `E00x` lexer, `E01x`–`E02x` líneas de bloque, `E03x` resolución, `E04x` nivel superior y entidades, `E05x` bloques. | todas |
| 10 | 2026-09-27 | **Sintaxis vieja** (`diagram <tipo>`) no tiene compatibilidad: da un único `E040` con mensaje de migración. | parser, drafts viejos en IndexedDB |
| 11 | 2026-09-27 | **Varios bloques en el preview**: se muestran todos apilados, con título (o nombre); Exportar SVG/PNG toma el primero hasta que el explorador permita elegir (F). Los títulos son input del usuario y se escapan. | web (C, F) |
| 12 | 2026-09-27 | **Un solo tipo `DiagramBlock`** con `kind: "flow" \| "sequence"` y `edges`; la única diferencia es que `sequence` exige etiqueta. | AST, layout, render |
| 13 | 2026-09-27 | **Enmienda a #3**: dentro de un cuerpo (bloque o entidad), una línea que empieza con `entity`, `flow` o `sequence` y no es una arista (en un bloque: no sigue de `->`) cierra el cuerpo abierto (`E052`/`E045`) en vez de tragarse el resto del archivo como si fuera parte de ese cuerpo; la línea no se consume, así que el parser de documento la retoma como el siguiente statement de nivel superior. | parser (C) |
| 14 | 2026-09-27 | **`{}` es un bloque/cuerpo vacío**, sin diagnósticos. Un cuerpo con contenido en la misma línea que el `{` reporta un único `E016`; si esa línea termina en `}`, el bloque/cuerpo se cierra ahí mismo (una sola línea) en vez de tragarse el resto del archivo. | parser (C) |
| 15 | 2026-09-27 | **Layout identifica nodos por la entidad resuelta, no por el nombre escrito.** Hoy `layout/` usa `ref.name` para las aristas y funciona porque en un documento único `ref.target === ref.name`; cuando la Fase D resuelva nombres entre documentos, las aristas deben usar `ref.target ?? ref.name`. | layout (D) |

### Pendientes diferidos (Fase C, 2026-09-27)

Detectados en la revisión de la Fase C y dejados conscientemente para más
adelante; el plan de la fase indicada debe recogerlos o descartarlos
explícitamente.

- **F — preview:** un bloque vacío (`flow a {}`) renderiza un SVG de tamaño
  0: se ve el título sin nada debajo.
- **F — preview:** un borrador viejo muestra el texto de estado vacío junto
  al banner "1 error"; el `E040` con la pista de migración sí es correcto.
- **F — editor:** el resaltado no colorea títulos (`STRING`) ni comas; y
  tras `type:` colorea el resto de la línea como texto.
- **F — mensajes:** `tags: x, y` da `E042 se esperaba ':' después de 'y'`;
  convendría sugerir que los tags se separan con espacios.
- **Cualquiera — render:** dos aristas `a -> b` repetidas se dibujan
  superpuestas (dagre no es multigrafo); comportamiento previo a la Fase C.
- **Cualquiera — parser:** `flow a { x -> y } // comentario` da `E016` +
  `E052` en vez de un solo `E016` (no se pierde contenido).

### Decisiones del grafo de conocimiento (2026-09-28)

Tomadas en el diseño de [2026-09-28-flo-grafo-de-conocimiento-design.md](2026-09-28-flo-grafo-de-conocimiento-design.md).

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 16 | 2026-09-28 | **Un `.md` con frontmatter es una entidad del catálogo** (`EntityDecl.knowledge != null`), no un grafo aparte. Un solo `XRefIndex`; los flujos `.flo` la usan como cualquier entidad. | resolver (D, K1), xref, render (K4) |
| 17 | 2026-09-28 | **No hay `imports` con alias.** Un `.md` declara `use:` (misma semántica que `use` en `.flo`) y las rutas en `relations.target` cuentan como `use` implícito. | resolver (D, K1) |
| 18 | 2026-09-28 | **Rango `E06x`** = frontmatter y esquema de conocimiento. Un target de relación sin resolver es `E035` (resolución). | diagnósticos (K1) |
| 19 | 2026-09-28 | **Frontmatter con la dependencia `yaml`**, usando sus rangos de nodo para los `Range` de los diagnósticos. Sin TOML. | core (K1) |
| 20 | 2026-09-28 | **Vocabulario en `knowledge.schema.yaml`** en la raíz del workspace (`type_tags`, `relation_types`). `memory_type` es un enum cerrado en el core; `context_tags` y `custom_tags` solo se validan por forma. | type-checker (K1), filtros (K4) |
| 21 | 2026-09-28 | **Un `.md` sin `---` en la primera línea no es documento del workspace** y se ignora sin diagnóstico. | carga de carpeta (K3, F) |
| 22 | 2026-09-28 | **Orden en el catálogo** (extiende #1): la entidad de un `.md` va antes que las entidades de sus bloques `flo` embebidos, que siguen su orden de aparición. | layout, query (K2) |

### Decisiones de la Fase D (2026-09-28)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 23 | 2026-09-28 | **`use` es palabra clave contextual** como las de #3, y entra en la enmienda #13: una línea `use` dentro de un cuerpo sin cerrar lo cierra. `use` sin string es `E046`. | parser (D) |
| 24 | 2026-09-28 | **Namespace y orden del workspace.** Los ids de entidad son globales al workspace: `E031` también entre documentos que no se usan entre sí. "Primera declaración" (#2) = documentos ordenados por uri (comparación de strings), luego orden de fuente; así el ganador no depende del orden de carga. El catálogo alcanzable de un documento es el post-orden DFS de sus `use` (dependencias primero, él al final) filtrado a las declaraciones ganadoras; es el orden de columnas de #1. | resolver (D), layout, mapa agregado (F), `.md` (K1) |
| 25 | 2026-09-28 | **Identidad de bloque = `uri#nombre`** (`BlockId`). Los nombres de bloque solo son únicos dentro de su documento: `E033` es por documento (enmienda §7, que decía "en el workspace"). Con un nombre repetido, las consultas por bloque del índice toman el primero; las referencias y aristas de todos cuentan. Es la misma forma que usa `relations.target` en K1 (`auth.flo#acceso`). | xref (D), atributos `data-flo-block` (E), explorador (F), `.md` (K1) |

### Decisiones de la Fase E (2026-09-28)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 26 | 2026-09-28 | **Atributos `data-flo-*` del SVG** (§6.3). Cada nodo o participante (`<g>` exterior) lleva `data-flo-entity` (id del nodo: la entidad resuelta, o el nombre escrito si es placeholder, que además tiene `flo-unresolved`), `data-flo-block` (`BlockId`, #25), `data-flo-uri` (documento del bloque, no el de la declaración) y `data-flo-line` (línea de la primera referencia al nodo en el bloque). Cada arista o mensaje (`<polyline>`/`<line>`) lleva `data-flo-from`, `data-flo-to`, `data-flo-block`, `data-flo-uri` y `data-flo-line` (línea de la arista). Se emiten siempre, también en Exportar SVG. Los snapshots de SVG comparan geometría: el test quita `data-flo-*` antes de `toMatchSnapshot()` y el `.snap` no se regenera. Los tipos de `layout/` llevan el `Range` de origen de cada nodo y arista. | render (E), preview y navegación (F), vista de grafo (K4) |

### Pendientes diferidos (Fase E, 2026-09-28)

- **F — preview:** el header fijo de `sequence` (`sequence-view.ts`) clona
  `.flo-seq-header-box`, que no lleva los `data-flo-*` (están en el `<g>`
  padre): un click en el header fijo tiene que resolverse contra el
  participante original.
- **F — workspace:** `link()` reescribe `Ref.target` en los documentos que
  guarda el `Workspace`, así que un `LinkResult` anterior cambia con el
  siguiente `link()` (§6.4). El editor no debe conservar resultados viejos
  entre links.
- **F — mensajes:** un `use` cuya ruta sale de la raíz da `E032` con el
  texto "no existe en el workspace"; convendría decir que sale de la raíz.
- **F — editor:** `editor.ts` llama a `render(source)` sin uri, así que el preview y el SVG exportado llevan `data-flo-uri=""` y `data-flo-block="#<nombre>"`. Cuando el editor tenga documentos con nombre tiene que pasar su uri.
- **F — preview:** la etiqueta de una arista (`<rect>` + `<text>`) no lleva `data-flo-*` (decisión #26 los pone solo en la `<polyline>`/`<line>`): un click en la etiqueta tiene que resolverse contra la arista vecina, o hay que agrupar línea y etiqueta.

### Decisiones de la Fase K1 (2026-09-28)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 27 | 2026-09-28 | **Recuperación del frontmatter.** Cada campo inválido da un diagnóstico y no impide validar los demás. Hay entidad si y solo si `id` es válido; `title` inválido ⇒ label = id; `memory_type` inválido (cualquier valor fuera del enum, también no-strings: `E064`) ⇒ `memoryType: null`. Con un `E061` no se valida nada del frontmatter; con `E060` no se parsea nada del archivo. `E062` (y el `E068` por esquema ausente) se anclan en el `---` de apertura (1:1–1:4); a una relación sin `target`/`type` le corresponde `E062` en el rango del ítem, y una clave desconocida en una relación es `E067`. Rangos: `Relation.range` = valor de `target`, `Relation.typeRange` = valor de `type`, `KnowledgeMeta.typeTagRanges` paralelo a `typeTags`. | parser (K1), MCP `write_node` (K3), renombrar (F) |
| 28 | 2026-09-28 | **Bloques ` ```flo ` embebidos.** Cada cerca se parsea por separado con `parseDocument` (un `flow` sin `}` no se traga la cerca siguiente; su `E052` queda dentro). El contenido se toma sin quitar indentación, así las columnas son las del archivo. Una cerca sin cerrar llega a fin de archivo (CommonMark); lo de adentro de cualquier cerca no abre otra. El info-string se compara por su primera palabra (` ```flo titulo ` cuenta). Se parsean aunque el frontmatter no tenga entidad. | parser (K1), `full+diagrams` (K2) |
| 29 | 2026-09-28 | **Despacho por uri y esquema.** `Workspace.setDocument` elige el parser por uri: exactamente `knowledge.schema.yaml` → esquema; termina en `.md` → conocimiento (sin `---` inicial el uri deja de ser documento, también si lo era); todo lo demás → `.flo`. El esquema no está en `LinkResult.documents`; sus diagnósticos sí, al final de `LinkResult.diagnostics`. Ambas claves del esquema son obligatorias. Esquema ausente ⇒ un único `E068` en el primer `.md` por uri (decisión #24), anclado en su `---`; esquema con diagnósticos (`E061`/`E068` en él) ⇒ no se valida vocabulario y no se repite `E068` en los `.md`. | workspace (K1), carga de carpeta (K3, F) |
| 30 | 2026-09-28 | **Targets de relación.** Lo anterior a `#` es la ruta si contiene `/` o termina en `.md`/`.flo`; con `#nombre` resuelve al bloque de ese documento (`.flo` o `.md`), sin `#` debe ser un `.md` con entidad (un `.flo` sin bloque es `E035`). Toda ruta que existe es `use` implícito aunque la relación termine en `E035`. En `XRefIndex`, solo las declaraciones ganadoras (#2) aportan relaciones; `relationsTo` y `referencesTo` solo cuentan targets resueltos a entidad, y `referencesTo` solo la forma id, porque es la única cuyo texto es el id (renombrar en F la edita; una ruta a `.md` no cambia al renombrar). `blockId` vive en `workspace/uri.ts`. | resolver, xref (K1), `query` (K2), renombrar (F) |

### Pendientes diferidos (Fase K1, 2026-09-28)

- **F — renombrar:** los rangos YAML de un escalar entre comillas incluyen
  las comillas (`id: "a"` da `nameRange` 2:5–2:8; igual `Relation.range` y
  `typeTagRanges`). Renombrar tiene que reemplazar el escalar completo y
  citar el nuevo id si hace falta (`null`, `true`, `yes` cambiarían de
  tipo).
- **F — mensajes:** un `use` (o `use:`) que apunta a un `.md` sin
  frontmatter o a `knowledge.schema.yaml` da `E032` "no existe en el
  workspace", aunque el archivo exista; convendría "no es un documento del
  workspace".
- **K3 — carga de carpeta:** falta un test de `use` dentro de una cerca
  ` ```flo ` (funciona); el relleno `"\n".repeat(fence.start)` relexa
  líneas vacías por cerca, revisar solo si el re-link por `fs.watch` lo
  muestra en un perfil.

### Decisiones de la Fase K2 (2026-09-28)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 31 | 2026-09-28 | **Semántica de `query`.** Los predicados hoja de `Where` solo los cumplen entidades de `.md` (un `memoryType: null` no cumple ningún `memory`); `not` los niega también para entidades `.flo`, `{ and: [] }` es verdadero y `{ or: [] }` falso. `contextTag` terminado en `:` compara por prefijo; `custom` exige clave propia (`Object.hasOwn`) y `equals` compara con `===` (`3` ≠ `"3"`); `text` busca en `label` y `body` por separado con `toLowerCase`. `from` se interseca con `where`, ignora ids desconocidos y `from: []` no da semillas. Orden de `nodes`: distancia y luego orden del catálogo (#1, #22, #24); las semillas son las de distancia 0. `QueryNode` = `id`, `title` (label), `uri`, `distance`, `memoryType`, `typeTags`, `contextTags`, `customTags` (vacíos/null en `.flo`), más `body` en `full` (`""` en `.flo`) y `diagrams` en `full+diagrams` (fuente de cada cerca ` ```flo ` del cuerpo, `[]` en `.flo`). Sin diagnósticos; `depth` negativo = 0. | query (K2), MCP (K3), filtros y vista de grafo (K4) |
| 32 | 2026-09-28 | **Aristas de `query`.** Una relación entra como arista solo si resolvió a entidad y es de la declaración ganadora (#2); una relación a bloque (`auth.flo#acceso`) no es arista ni expande: el resultado es un grafo de entidades, y K4 la lee de `xref.relationsFrom`. Las aristas de flujo (`flow` y `sequence`, tipo `"flow"`) son dirigidas, una por par `from→to` resuelto, con `blocks` = los `BlockId` que la contienen en orden de aparición; las referencias sin resolver no generan arista. Orden: documentos por uri; dentro de cada uno, relaciones (orden de declaración) y luego aristas de flujo (orden de fuente). La expansión las recorre sin dirección. | query (K2), MCP `get_node` (K3), render de conocimiento (K4) |

### Pendientes diferidos (Fase K2, 2026-09-28)

- **K3 — MCP:** `query` confía en los tipos de `QueryOptions`; con JSON mal formado (`where: {}`, una clave mal escrita como `type_tag`, `text` no string, `and` que no es lista, `project` desconocido, `from` string) lanza `TypeError` o se comporta en silencio como otra variante. El servidor MCP valida `QueryOptions` con un esquema `zod` estricto (rechaza claves desconocidas y tipos incorrectos con un mensaje claro) antes de llamar a `query`.
- **K4 — vista de grafo:** dos relaciones idénticas en un `.md` (mismo `target` y `type`) dan dos aristas idénticas, mientras que las de flujo se funden por par; la vista puede deduplicar por `from|to|type` al dibujar.

### Decisiones de la Fase K3 (2026-09-28)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 33 | 2026-09-28 | **Carpeta del disco como workspace** (`FloFolder` en `@flo/mcp`). El uri es la ruta POSIX relativa a la raíz. Se cargan los `.flo`, los `.md` (los que no empiezan con `---` los descarta `setDocument`, #21) y `knowledge.schema.yaml` solo en la raíz; no se recorren `node_modules` ni `.git`, y no se siguen enlaces simbólicos (nada de fuera de la raíz entra). El estado es el mapa `uri → fuente`; `link()` es perezoso y se invalida con cada cambio, y nunca se guarda un `LinkResult` viejo (pendiente de E: `link()` reescribe `Ref.target`). `fs.watch` recursivo: un evento sobre un documento relee ese archivo (si ya no es archivo regular, sale); sobre un directorio existente o una ruta prefijo de un documento cargado, relee la carpeta entera; sin nombre, también; el resto se ignora. | MCP (K3), carga de carpeta en web (F) |
| 34 | 2026-09-28 | **`write_node`.** Guarda de ruta: normalizada relativa a la raíz, sin salir de ella tampoco por enlace simbólico (el ancestro existente más cercano, con `realpath`, sigue dentro), terminada en `.md` o `.flo` (el esquema no se escribe por MCP) y fuera de las carpetas ignoradas. Validación en un workspace nuevo con todas las fuentes + el archivo: se rechaza si no es documento del workspace (`.md` sin frontmatter), si tiene algún error, o si otro archivo tiene un error que antes no tenía (multiconjunto por código, rango y mensaje; los errores previos no bloquean). Escritura en un temporal oculto del mismo directorio y `rename`, creando carpetas; el estado se actualiza en el acto, sin esperar al watcher. Los rechazos de ruta son mensajes, no códigos de diagnóstico. | MCP (K3), guardado desde el editor (F) |
| 35 | 2026-09-28 | **Salida de las herramientas MCP**: un único contenido `text` con JSON; los fallos con `isError: true` y `{ error }` (más `diagnostics`, cada uno con su `uri`, en `write_node`). La entrada se valida con esquemas `zod` estrictos (rechazan claves desconocidas y tipos incorrectos; `depth` entero ≥ 0) antes de llamar al core. `get_node` = `{ node, outgoing: {type, target, resolved}[], incoming: {from, type, target}[] }`; `check` sin ruta lista solo los archivos con diagnósticos. | MCP (K3), K4 si reusa el formato |
| 36 | 2026-09-28 | **Enmienda a #33: un watcher por directorio.** En vez de un único `fs.watch` recursivo, se observa cada directorio de la carpeta (sin `node_modules`, `.git` ni enlaces simbólicos) con un `fs.watch` no recursivo, y el conjunto se resincroniza en cada relectura completa. Motivo: en Linux el modo recursivo de Node vigila cada archivo por inodo y deja de ver un archivo tras reemplazarlo con `rename` (la escritura atómica de `write_node` o de los editores), y además vigila todo `node_modules`. Los eventos por directorio son por nombre en todas las plataformas. | MCP (K3), carga de carpeta en web (F) |

### Pendientes diferidos (Fase K3, 2026-09-29)

- **F / CI — watcher en Linux:** el watcher por directorio (#36) solo se
  ejecutó en macOS, donde los tests de reemplazo atómico y de carpeta
  nueva pasan también sin el cambio; el primer CI en `ubuntu-latest`
  confirma o no el comportamiento en Linux.
- **F — watcher:** `load()` lee una carpeta nueva antes de abrir su
  watcher, así que un archivo creado en esa ventana no se ve hasta la
  siguiente relectura completa (abrir los watchers antes de recorrer lo
  cierra). Cualquier evento sobre un directorio existente relee la carpeta
  entera; un directorio vacío borrado conserva su watcher hasta la
  siguiente relectura; `watch()` no admite dos llamadas independientes.
- **K4 — MCP:** `list_tags` no declara `inputSchema` y acepta claves
  extra; un error que lanza el core dentro de una herramienta llega como
  texto del SDK, no como `{ error }` JSON (#35).
- **Cualquiera — `write_node`:** sobrescribir un archivo no conserva su
  modo (queda `0o666 & umask`); si falla la escritura quedan las carpetas
  creadas vacías.

### Decisiones de la Fase F (2026-09-29)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 37 | 2026-09-29 | **Workspace del editor web** = los archivos abiertos (`EditorWorkspace` sobre un `Workspace` del core). "Abrir carpeta" usa `showDirectoryPicker` con la regla de carga de #33 (`.flo`, `.md` —también sin frontmatter, se pueden editar—, `knowledge.schema.yaml` solo en la raíz; nunca `node_modules` ni `.git`); uri = ruta POSIX relativa a la carpeta. Sin File System Access, `<input webkitdirectory>` de solo lectura. "Abrir" un archivo = workspace de un documento; un ejemplo, igual. Un documento activo en el editor, con su propio `EditorState`. Cada cambio llega al workspace en el acto y `link()` es perezoso: nadie guarda un `LinkResult` entre cambios (pendiente de E). Sin watcher en el navegador: releer = volver a abrir la carpeta. Crear archivos: "Nuevo" con carpeta abierta agrega `nuevo.flo` (`nuevo-2.flo`, ...); borrar o mover archivos no se hace desde el editor. | web (F), K4 |
| 38 | 2026-09-29 | **Guardado desde el editor, sin validar** (a diferencia de `write_node`, #34: un humano guarda trabajo a medias). Con carpeta, "Guardar" pide el permiso de escritura si hace falta y escribe todos los archivos modificados; sin carpeta, el activo con el picker o la descarga. El borrador de IndexedDB es el workspace entero (`files`, `saved`, `active` y el handle de la carpeta) bajo la misma clave; un borrador anterior (string) se abre como `diagrama.flo`. Reemplazar un workspace con archivos del disco modificados pide confirmación. | web (F), K4 (presets en la carpeta) |
| 39 | 2026-09-29 | **Navegación en el core**: `entityAt(document, position)` (declaración, target de relación resuelto a entidad o `Ref` resuelta; el borde final del rango cuenta) y `renameEntity(link, id, newId)` → `{ edits: Map<uri, TextEdit[]> } \| { error }`, puros. Renombrar edita exactamente `definitionOf` + `referencesTo` (#30): la declaración ganadora, las relaciones en forma id de `.md` ganadores y las `Ref` resueltas de todos los bloques (también en cercas de `.md`). En YAML el id nuevo va entre comillas dobles si YAML lo leería como null o booleano (`null`, `true`, `false`, `yes`, `no`, `on`, `off`, `y`, `n`, sin distinguir mayúsculas); en `.flo`, nunca. `newId` debe ser identificador y no existir; declaraciones perdedoras (`E031`) y referencias sin resolver no se tocan. En la web, las ediciones del documento activo van por el editor (quedan en su historial de deshacer). | core (F), web (F), MCP (si suma renombrar) |
| 40 | 2026-09-29 | **Mapa agregado** = `renderMap(link)`: las aristas de flujo de `query` (#32, una por par dirigido) como un `flow` sintético `mapa` sobre `link.entities` (orden #1/#24), uri `""`, `data-flo-block="#mapa"`, `data-flo-line="1"`. Solo entidades con alguna arista; las relaciones de `.md` no entran (son de la vista de grafo, K4). Sin snapshot: se testea por atributos. | core, web (F), K4 |
| 41 | 2026-09-29 | **Bloque seleccionado y filtros.** El bloque seleccionado (click en su título, en el explorador o en un flujo del panel) es el que exportan SVG/PNG; si no está en el preview, el primero; con el mapa visible, el mapa (cierra #11). Filtros del explorador: un `type` y un tag de `EntityDecl` (#6), con los valores presentes; un valor que dejó de existir no filtra. Los `type_tags` de `.md` no son filtros del explorador (K4). | web (F), K4 |
| 42 | 2026-09-29 | **Clicks del preview.** Nodo o participante resuelto (también en el header fijo de `sequence`, cuyo clon copia los `data-flo-*`) → panel de entidad; placeholder `flo-unresolved`, aristas y etiquetas de arista del preview no hacen nada (descarta el pendiente de E sobre la etiqueta). En el mapa, las aristas sí: una franja transparente de 12 px encima de cada una abre el panel con los flujos que la contienen. | web (F), K4 (drill-down) |
| 43 | 2026-09-29 | Enmienda a #38: la confirmación al reemplazar el workspace cuenta también los archivos nunca guardados de una carpeta abierta (p. ej. un `nuevo.flo`); sin carpeta, un ejemplo o un documento nuevo se siguen reemplazando sin preguntar. Y enmienda a #37: cada documento conserva su `EditorState` (historial de deshacer) mientras el workspace no se reemplace; si su fuente cambió por fuera del editor (renombrar), se crea uno nuevo. | web (F) |

### Pendientes que resuelve la Fase F (2026-09-29)

Recogidos por el [plan de F](../plans/2026-09-29-flo-fase-f-navegacion-en-el-editor.md):
bloque vacío con SVG de tamaño 0 y texto de estado junto al banner (C,
task 6); resaltado de `STRING`, comas y `type:` (C, task 11); `E042` en
`tags: x, y` (C, task 3); click en el header fijo de `sequence` (E, task
7); `link()` que reescribe `Ref.target` (E, task 4); `E032` para una ruta
fuera de la raíz, un `.md` sin frontmatter o el esquema (E y K1, task 3);
`render(source)` sin uri (E, task 6); renombrar un escalar YAML entre
comillas (K1, task 1).

Descartados o reasignados:
- **E — etiqueta de arista sin `data-flo-*`:** descartado; las aristas del
  preview no son clickeables (#42).
- **K3 "F / CI — watcher en Linux"** y **K3 "F — watcher"**: son de
  `@flo/mcp`, no del editor (el navegador no tiene watcher, #37); pasan a
  **Cualquiera — MCP** sin cambios de contenido.

### Pendientes diferidos (Fase F, 2026-09-29)

- **F / release — navegador real:** la verificación manual se hizo en
  Safari (sin `showDirectoryPicker`); falta un smoke test en Chromium de
  "Abrir carpeta → editar → Guardar → recargar → Guardar (pide permiso)"
  y de Ctrl/Cmd+click para ir a definición.
- **Cualquiera — editor:** el debounce de 200 ms es un `setTimeout` suelto:
  si se cambia de documento durante la espera, un `onChange` tardío
  refresca el documento que esté activo (inofensivo, un refresh de más).
  Los `EditorState` guardados por uri (#43) no se podan hasta el siguiente
  `load()`.
- **Cualquiera — tests:** sin test del guard de botón del Ctrl/Cmd+click
  (jsdom no da posición al click). (El `aria-pressed` del botón "Mapa",
  el panel de arista al salir del mapa y el test de exportar el bloque
  seleccionado se resolvieron en la task 13 del plan de F.)

