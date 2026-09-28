# `.flo` — entidades centralizadas, flujos como vistas y navegación cruzada

- **Fecha:** 2026-09-19
- **Rama:** `v2`
- **Estado:** diseño aprobado, pendiente de plan de implementación
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
  data-flo-block="login"
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
| `E033` | Nombre de bloque duplicado en el workspace.                       |
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
