# `.flo` — tags compartidos y dinámicos, consulta por offset y aristas recíprocas

- **Fecha:** 2026-10-01
- **Rama:** `v2` (trabajo en `ivanroosvelt/mejoras`)
- **Estado:** diseño aprobado en chat; pendiente de revisión del spec y de plan
- **Origen:** issue [#1 «Mejoras»](https://github.com/ivanroosvelt/submind/issues/1)
- **Depende de:** [grafo de conocimiento](2026-09-28-flo-grafo-de-conocimiento-design.md)
  (K1–K4) y las decisiones de [entidades §11](2026-09-19-flo-entidades-centralizadas.md).
  Las decisiones nuevas de este spec se registran como #40–#42 en ese §11.

## 1. Propósito

Cuatro defectos del issue, agrupados en tres fases independientes:

1. Los tags de un `.md` y los de una entidad `.flo` no se ven entre sí.
2. Solo existen tres familias de tags, fijas en el código; cualquier otra
   clave `*_tags` del frontmatter se rechaza con `E067`.
3. `query` no permite recorrer el grafo capa por capa.
4. Un flujo con aristas recíprocas (`api -> auth` y `auth -> api`) se
   dibuja con las flechas casi superpuestas, las etiquetas tapándose y el
   lienzo recortando la más larga (caso real: `decisiones/pkce.md`).

## 2. Qué hay hoy

- `EntityDecl.tags` (de `.flo`, `entity … tags a b`) y
  `KnowledgeMeta.typeTags/contextTags/customTags` (de `.md`) son campos
  distintos. El filtro de tags del explorer solo lee `EntityDecl.tags`;
  `tagCatalog` solo lee `KnowledgeMeta`.
- `parser/markdown.ts` acepta un conjunto cerrado de claves; las demás dan
  `E067`.
- `query()` hace BFS hasta `depth` y devuelve las capas 0..depth juntas.
- `layoutFlowchart` separa ±5px las dos aristas de un par recíproco, coloca
  ambas etiquetas en el mismo `y` y calcula el ancho del lienzo sin contar
  las etiquetas.

## 3. Fase T — tags

### 3.1 Un solo conjunto compartido: `typeTags`

`EntityDecl` gana `typeTags: string[]`, que es el **único** campo para el
vocabulario común:

- en `.flo`, `entity x … tags a b` llena `typeTags` (la palabra clave
  `tags` no cambia);
- en `.md`, `type_tags: [...]` llena `typeTags`.

`EntityDecl.tags` y `KnowledgeMeta.typeTags` desaparecen como campos
separados (los lectores se migran a `EntityDecl.typeTags`). El validador de
`type_tags` contra el esquema (`E065`) se aplica **solo a entidades de
`.md`**; en `.flo` el vocabulario sigue libre, así no se rompe ningún
`.flo` existente.

### 3.2 Familias dinámicas `*_tags`

Cualquier clave de frontmatter que termine en `_tags` y cuyo valor sea una
lista de cadenas es una **familia**: `context_tags`, `team_tags`,
`owner_tags`, etc. Se guardan en

```ts
KnowledgeMeta.tagSets: Record<string, string[]>; // familia → valores, p. ej. { context: ["project:core"] }
```

- La clave de la familia es el nombre sin el sufijo (`context_tags` →
  `context`). `type_tags` (es §3.1) y `custom_tags` (mapa clave→valor, sin
  cambio) quedan excluidas: no son familias.
- `context_tags` deja de ser un campo propio: es la familia `context`. Se
  conserva su validación de forma `clave:valor` solo para esa familia.
- Una clave `*_tags` con valor que no es lista de cadenas → `E063` (ya
  existente). Una clave desconocida que **no** termina en `_tags` → `E067`
  como hasta hoy.
- Las `.flo` no tienen familias dinámicas: su único conjunto es `typeTags`.

### 3.3 Compatibilidad

`Where.typeTag` y `Where.contextTag`, `QueryNode.typeTags/contextTags` y
`TagCatalog.typeTags/contextTags` se mantienen como alias de lo genérico
(§4), para no romper MCP ni la vista de grafo de golpe.

## 4. Fase Q — consulta

### 4.1 Predicado y catálogo genéricos

```ts
type Where = … | { tags: string; value: string };     // familia + valor; value "" = cualquiera
                                                       // familia "type" = typeTags de .flo y .md
interface TagCatalog {
  families: Record<string, string[]>;                  // "type", "context", "team", … → valores distintos
  customTags: Record<string, CustomTagValue[]>;        // sin cambio
  typeTags: string[];                                  // alias de families.type
  contextTags: string[];                               // alias de families.context
}
```

`tagCatalog` descubre las familias recorriendo las entidades ganadoras, en
orden del catálogo y sin repetir; `type` siempre existe aunque esté vacía.
`QueryNode` gana `tags: Record<string, string[]>` (todas las familias) y
mantiene `typeTags`/`contextTags`.

### 4.2 Offset de capas

```ts
interface QueryOptions { …; offset?: number }          // por defecto 0
```

Semántica de ventana: se calculan las distancias BFS igual que hoy y se
devuelven los nodos con `offset ≤ distancia ≤ depth`. Las semillas
(distancia 0) quedan fuera cuando `offset ≥ 1`.

- `{ depth: 1 }` → capas 0–1; `{ depth: 2, offset: 2 }` → solo la capa 2.
  Iterar = subir `offset` y `depth` en paralelo.
- `edges` = las aristas **entre nodos de la ventana**, más las que unen un
  nodo de la capa `offset` con un nodo de la capa `offset − 1`, devueltas
  como `{ from, to, type }` con el extremo fuera de la ventana marcado en
  `QueryResult.anchors: EntityId[]` (ids sin nodo completo), para que el
  cliente pueda conectar la capa nueva con la anterior sin recibir la
  anterior otra vez.
- `offset > depth` → resultado vacío. `offset` negativo o no entero → el
  mismo error de validación que `depth`.

### 4.3 Superficie

- **MCP:** `query` acepta `offset` y `where.tags`; `list_tags` devuelve
  `families`. Entrada validada con `zod` estricto (decisión #35).
- **Web:** `knowledge-view.ts` y `explorer.ts` generan un `<select>` por
  familia a partir de `tagCatalog` (en vez de los tres fijos). El
  `explorer` filtra por `typeTags` unificado, por lo que ahora ve también
  los tags de los `.md`. Un control «Capa» (offset) en la vista de grafo
  avanza de a una capa.

## 5. Fase R — aristas recíprocas

Cambios en `layout/flowchart.ts` y, si hace falta, `render/flowchart.ts`:

- Al detectar un par `a→b` y `b→a`, se separan sus carriles por
  `max(10, ancho de la etiqueta más ancha del par / 2 + 8)` px en vez de
  ±5px, de modo que las cajas de etiqueta no se solapen.
- Cada etiqueta se coloca sobre el carril de su arista; si dos etiquetas
  del mismo tramo se solapan, la segunda se baja `alto de etiqueta + 4` px.
- El ancho y alto del lienzo (`width`/`height`/`viewBox`) incluyen las cajas
  de las etiquetas: nada con `x < 0` ni más allá del borde derecho.
- Las aristas de un solo sentido y los pares sin etiqueta no cambian de
  geometría.
- **Snapshots** (`render/__snapshots__/`): nunca `vitest -u`. Los casos
  existentes sin pares recíprocos no deben cambiar; si alguno cambia es un
  bug. Los casos con pares recíprocos se corrigen a mano o se agregan nuevos.

## 6. Decisiones nuevas (a registrar en §11 del spec de entidades)

| # | Decisión |
|---|---|
| 40 | **`typeTags` es el conjunto compartido** entre `.flo` y `.md`: un solo campo en `EntityDecl`; el esquema valida `type_tags` solo en `.md`. |
| 41 | **Familias `*_tags` dinámicas** en el frontmatter: cualquier clave `*_tags` con lista de cadenas es una familia, queryable por `Where.tags` y listada por `tagCatalog.families`; `type_tags` y `custom_tags` conservan su tratamiento propio. |
| 42 | **`query.offset`**: ventana `offset ≤ distancia ≤ depth`, con `anchors` para conectar la capa con la anterior. |

## 7. Pruebas

- **T:** `.flo` con `tags` y `.md` con `type_tags` aparecen juntos en
  `typeTags`; frontmatter con `team_tags: [a]` no da `E067`; `team_tags: a`
  da `E063`; `E065` solo en `.md`.
- **Q:** `tagCatalog` descubre familias nuevas; `where: { tags: "team",
  value: "a" }`; `{ depth: 2, offset: 2 }` devuelve solo la capa 2 con
  `anchors`; `offset > depth` vacío; los alias legacy devuelven lo mismo
  que antes sobre los ejemplos existentes.
- **R:** layout de `pkce` (api↔auth): sin cajas de etiqueta solapadas ni
  fuera de `[0, width] × [0, height]`; los snapshots de casos no
  recíprocos, intactos.
- Verificación final: `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

## 8. Fuera de alcance

Búsqueda semántica, tags jerárquicos, renombrar familias, y rutas de
arista (routing) más allá de pares recíprocos.
