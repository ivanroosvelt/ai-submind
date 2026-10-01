# .flo

`.flo` es un lenguaje de diagramas propio — un reemplazo de Mermaid con
gramática determinista, parser con recuperación de errores y diagnósticos
estructurados en vez de mensajes de texto suelto. Sin compatibilidad con
sintaxis Mermaid: es un formato nuevo desde cero.

> **Estado actual:** Fases 0-5 completas (monorepo + CI, lenguaje, layout
> + render SVG, editor web, persistencia y exportación, deploy y docs).
> Sobre esa base, la rama `v2` implementa las
> [entidades centralizadas](docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md):
> fases A–F completas (rangos, lexer dirigido por el parser, catálogo de
> entidades y bloques nombrados, workspace multi-documento con `use`,
> índice de referencias cruzadas, atributos `data-flo-*` en el SVG y
> navegación en el editor: explorador, panel de entidad, ir a definición,
> renombrar y mapa agregado). Del
> [grafo de conocimiento](docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md)
> están completas K1, K2 y K3: un `.md` con frontmatter tipado es una entidad del
> catálogo, `query`/`tagCatalog` lo consultan y `@flo/mcp` lo expone a agentes
> por MCP. Pendientes: K4 y la Fase 6 (ver [Roadmap](#roadmap)).

## Ejemplos

Un documento declara un catálogo de entidades y uno o más bloques
(`flow`/`sequence`) que las conectan:

```
entity user (Usuario)
entity api  [API]
entity db   {Base de datos}

flow login "Inicio de sesión" {
  user -> api : POST /login
  api  -> db  : buscar credenciales
  db   -> api : perfil
}

sequence login_detail "Detalle" {
  user -> api : POST /login
  api  -> db  : SELECT usuario
  db   -> api : fila
  api  -> user : 200 OK
}
```

Las entidades se declaran una vez (id, forma y label) y se ven igual en
todos los bloques que las usan; los bloques solo contienen aristas. Ver
[`docs/SYNTAX.md`](docs/SYNTAX.md) para la guía completa.

## Paquetes

Monorepo con pnpm workspaces:

- **`@flo/core`** (`packages/core`) — lexer, parser, resolver, layout y
  render a SVG. No importa nada de `@flo/web` ni de ningún framework de
  UI: pensado para publicarse a npm de forma independiente. API pública:

  ```ts
  import { parse } from "@flo/core";

  const { document, catalog, diagnostics } = parse(source);
  ```

  `document` trae las entidades y los bloques parseados; `catalog` es el
  mapa id → entidad ya resuelto (la primera declaración de cada id gana).
  `diagnostics` siempre trae todos los errores encontrados en la pasada
  (el parser nunca aborta en el primero). Ver la gramática formal y la
  tabla completa de códigos de diagnóstico en
  [`packages/core/GRAMMAR.md`](packages/core/GRAMMAR.md).

  `@flo/core` también expone `render(source)`, que hace `parse()` +
  layout + render a SVG en un solo paso:

  ```ts
  import { render } from "@flo/core";

  const { diagrams, diagnostics } = render(source);
  // un elemento por bloque: { name, title, kind: "flow" | "sequence", svg }
  ```

  `diagrams` trae un elemento por cada bloque que se pudo parsear, con su
  SVG, aunque el documento tenga errores en otras partes.

  Para varios documentos que comparten un catálogo (`use "./catalogo.flo"`),
  `Workspace` los resuelve juntos y arma el índice de referencias:

  ```ts
  import { Workspace, renderBlock } from "@flo/core";

  const ws = new Workspace();
  ws.setDocument("catalogo.flo", catalogo);
  ws.setDocument("login.flo", login);
  ws.setDocument("decisiones/pkce.md", nota); // .md con frontmatter
  const { documents, diagnostics, xref } = ws.link();
  xref.flowsUsing("api"); // ["login.flo#acceso", ...]
  ```

  Un `.md` que empieza con `---` es una entidad más del catálogo: su
  frontmatter YAML declara `id`, `title`, `memory_type`, tags y
  `relations`, y sus bloques ` ```flo ` embebidos entran al workspace. El
  vocabulario es libre: si hay un `knowledge.schema.yaml` en la raíz, se
  valida contra él; si no, no hay nada que validar.

  `query` filtra y expande el grafo; `tagCatalog` lista los tags en uso:

  ```ts
  import { query, tagCatalog } from "@flo/core";

  const link = ws.link();
  query(link, { where: { typeTag: "decision" }, depth: 1, project: "full" });
  // { nodes: [{ id: "pkce", distance: 0, body, ... }, { id: "api", distance: 1, ... }], edges: [...] }
  tagCatalog(link); // { typeTags, contextTags, customTags, relationTypes }
  ```

- **`@flo/web`** (`packages/web`) — vanilla TypeScript + Vite, consume
  `@flo/core`. Editor split-pane: CodeMirror 6 a la izquierda (resaltado
  de sintaxis `.flo` por tipo de token, diagnósticos del core pintados
  inline con subrayado + tooltip vía `@codemirror/lint`) y preview SVG en
  vivo a la derecha, actualizado con debounce de 200ms. Si el diagrama
  tiene errores, el preview mantiene el último SVG válido y agrega un
  banner "N errores" en vez de una pantalla en blanco.
  Barra de herramientas con Nuevo (flowchart/secuencia), Abrir y Guardar
  (File System Access API en Chrome/Edge, con fallback de
  `<input type=file>` + descarga en otros navegadores), Exportar SVG y
  Exportar PNG. Autosave del borrador a IndexedDB en cada edición,
  independiente del archivo real en disco — se restaura al recargar la
  página.

  **Workspace y navegación:** "Abrir carpeta" (File System Access API) carga
  los `.flo`, `.md` y, si existe, el `knowledge.schema.yaml` de la raíz (sin
  `node_modules` ni `.git`); sin esa API el navegador cae a un
  `<input webkitdirectory>` de solo lectura, y "Guardar" descarga el
  archivo activo en vez de escribirlo. Con una carpeta abierta, "Nuevo"
  agrega `nuevo.flo` a ella; "Guardar" escribe todos los archivos
  modificados (marcados con `●`) sin validarlos, y el borrador
  autosaveado en IndexedDB es el workspace entero. El explorador lista el
  catálogo de entidades (filtrable por `type` y tag) y los archivos con
  sus bloques. El panel de entidad muestra "Aparece en N flujos", salta
  al flujo con el nodo resaltado, linkea a su definición y ofrece
  "Renombrar". Ctrl/Cmd+click o F12 van a la definición; F2 renombra en
  todos los archivos del workspace. "Mapa" arma el grafo agregado de
  todos los flujos, con aristas clickeables que listan los flujos que las
  originan. Exportar SVG/PNG toma el bloque seleccionado (click en su
  título o en el explorador), o el mapa si está visible.

  **Grafo de conocimiento:** "Grafo" dibuja las notas `.md` del workspace
  (color por `memory_type`, con leyenda) y lo que las conecta: relaciones
  con su tipo como etiqueta, flujos entre entidades y los bloques que
  `visualized_by` señala. La barra filtra por memoria, `type_tag`,
  `context_tag` y texto, y elige la profundidad de la expansión. Se
  desplaza arrastrando y se acerca con la rueda. Click en una nota la abre
  en el editor; en un bloque o en una arista hacia él, abre ese flujo; desde
  un flujo, click en una nota vuelve al grafo centrado en ella. Con una
  carpeta abierta, "Guardar vista" guarda filtros, profundidad y encuadre en
  `.flo/views/<nombre>.json` (versionable), y el selector "Vistas" los
  vuelve a aplicar.

- **`@flo/mcp`** (`packages/mcp`) — servidor MCP local (stdio) sobre una
  carpeta de documentos `.flo` y `.md` con frontmatter (el
  `knowledge.schema.yaml` es opcional). Relee lo que cambia en disco.

  ```bash
  pnpm --filter @flo/mcp build
  node packages/mcp/dist/main.js <carpeta>
  ```

  Herramientas: `query`, `get_node`, `list_tags` (vocabulario en uso, con
  tipos de relación), `check` y `write_node`
  (solo escribe `.md`/`.flo` dentro de la carpeta, y solo si el
  type-checker no encuentra errores nuevos).

## Uso

Requiere Node 20+ y pnpm (via `corepack enable`, la versión queda fijada
por `packageManager` en el `package.json` raíz).

```bash
pnpm install
pnpm build      # compila @flo/core, y después @flo/web y @flo/mcp
pnpm typecheck
pnpm test       # 302 tests (vitest): 215 en @flo/core + 50 en @flo/web + 37 en @flo/mcp
```

Cada paquete también corre estos scripts individualmente con
`pnpm --filter @flo/core <script>` / `pnpm --filter @flo/web <script>`.
`@flo/web` además tiene `pnpm --filter @flo/web dev` para levantar el
editor con Vite en modo desarrollo (hot reload).

Para servir el build estático (`packages/web/dist`) como lo haría un
hosting de archivos planos:

```bash
pnpm build   # genera packages/web/dist
pnpm serve   # vite preview — sirve ese dist localmente
```

CI (`.github/workflows/ci.yml`) corre `install --frozen-lockfile → build →
typecheck → test` en cada push y PR.

## Documentación

- [`docs/SYNTAX.md`](docs/SYNTAX.md) — sintaxis de `.flo` para usuario final, con ejemplos.
- [`docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md`](docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md) — diseño y alcance del proyecto completo (todas las fases).
- [`docs/superpowers/plans/2026-09-17-flo-lenguaje-mvp.md`](docs/superpowers/plans/2026-09-17-flo-lenguaje-mvp.md) — plan de implementación de Fase 0 + Fase 1.
- [`docs/superpowers/plans/2026-09-17-flo-layout-render-svg.md`](docs/superpowers/plans/2026-09-17-flo-layout-render-svg.md) — plan de implementación de Fase 2 (layout + render a SVG).
- [`docs/superpowers/plans/2026-09-18-flo-persistencia-exportacion.md`](docs/superpowers/plans/2026-09-18-flo-persistencia-exportacion.md) — plan de implementación de Fase 4 (persistencia y exportación).
- [`docs/superpowers/plans/2026-09-18-flo-fase5-deploy-docs.md`](docs/superpowers/plans/2026-09-18-flo-fase5-deploy-docs.md) — plan de implementación de Fase 5 (deploy, docs de usuario, prep de npm).
- [`docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`](docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md) — entidades centralizadas, workspace y navegación (fases A–F); su §11 registra las decisiones de lenguaje.
- [`docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md`](docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md) — `.md` tipados como grafo de conocimiento (fases K1–K4).
- Planes de la v2: [A+B](docs/superpowers/plans/2026-09-19-flo-range-y-lexer-dirigido.md), [C](docs/superpowers/plans/2026-09-27-flo-fase-c-entidades-y-bloques.md), [D](docs/superpowers/plans/2026-09-28-flo-fase-d-workspace-multidocumento.md), [E](docs/superpowers/plans/2026-09-28-flo-fase-e-superficie-de-navegacion.md), [K1](docs/superpowers/plans/2026-09-28-flo-fase-k1-md-como-documento.md), [K2](docs/superpowers/plans/2026-09-28-flo-fase-k2-consultas.md), [K3](docs/superpowers/plans/2026-09-28-flo-fase-k3-mcp.md), [F](docs/superpowers/plans/2026-09-29-flo-fase-f-navegacion-en-el-editor.md).
- [`packages/core/GRAMMAR.md`](packages/core/GRAMMAR.md) — gramática formal (EBNF), reglas léxicas especiales y tabla de códigos de diagnóstico.

## Roadmap

Orden de la v2: D → E → K1 → K2 → K3 → F → **K4**.

- **K4** — vista de grafo de conocimiento en la web.
- **Fase 6** — `npm publish` real de `@flo/core` (el paquete ya está preparado; falta correr `npm login && npm publish --access public` desde `packages/core` con una cuenta npm autenticada, y habilitar GitHub Pages en Settings → Pages → Source: "GitHub Actions" para que el workflow de deploy quede activo).

Detalle completo de cada fase en los specs enlazados arriba.
