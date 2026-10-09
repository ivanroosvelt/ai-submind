# tejo

**El conocimiento de tu proyecto, tejido en el repo.**

[![npm](https://img.shields.io/npm/v/@ivanroosveltlt/tejo)](https://www.npmjs.com/package/@ivanroosveltlt/tejo)

Las decisiones, reglas, incidentes y flujos de un proyecto suelen quedar
dispersos entre wikis, hilos y la memoria de quien estuvo ahí. tejo los
guarda junto al código, como texto plano que se versiona con el repo, y
los teje en un grafo que pueden consultar tanto las personas como los
agentes:

- **Notas `.md`** con frontmatter tipado (`decision`, `incident`, `business_rule`…;
  el vocabulario es libre) y relaciones explícitas entre ellas.
- **Diagramas `.flo`**, un lenguaje propio y pensado para eso: las
  entidades (usuario, API, base de datos) se declaran una vez y se
  reutilizan en todos los flujos, de modo que una nota puede apuntar a
  `api` o a `login.flo#acceso` y el enlace no se rompe.
- **Un servidor MCP** para que el agente consulte el grafo antes de decidir
  y anote lo nuevo; solo escribe notas que pasan el chequeo.
- **Un visor** que dibuja el grafo y los diagramas y muestra al instante lo
  que el agente escribe.

## Empezar

```bash
npx @ivanroosveltlt/tejo init    # knowledge/, .mcp.json, skill del agente y bloque en AGENTS.md
npx @ivanroosveltlt/tejo view    # visor en http://127.0.0.1:8356
npx @ivanroosveltlt/tejo check   # sale con 1 si hay errores (útil en CI)
```

Una nota es markdown con frontmatter, y puede llevar diagramas adentro:

````md
---
id: decision_pkce
title: "Decisión: OAuth2 + PKCE"
memory_type: long_term
type_tags: [decision, architecture]
relations:
  - target: ../reglas/passwords.md
    type: enforces
  - target: ../login.flo#acceso
    type: visualized_by
---

El login usa authorization code con PKCE: el cliente no guarda secretos.

```flo
flow pkce "Validación PKCE" {
  api -> auth : validar code_verifier
  auth -> api : refresh token
}
```
````

Hay un proyecto de ejemplo completo en [`examples/04-conocimiento`](examples/04-conocimiento).

## El lenguaje `.flo`

Gramática determinista, un parser que no se detiene en el primer error y
diagnósticos con código y posición, para que tanto el editor como el agente
sepan exactamente qué arreglar. Un documento declara un catálogo de
entidades y uno o más bloques (`flow`/`sequence`) que las conectan:

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

- **`@tejo/core`** (`packages/core`) — lexer, parser, resolver, layout y
  render a SVG. No importa nada de `@tejo/web` ni de ningún framework de
  UI: pensado para publicarse a npm de forma independiente. API pública:

  ```ts
  import { parse } from "@tejo/core";

  const { document, catalog, diagnostics } = parse(source);
  ```

  `document` trae las entidades y los bloques parseados; `catalog` es el
  mapa id → entidad ya resuelto (la primera declaración de cada id gana).
  `diagnostics` siempre trae todos los errores encontrados en la pasada
  (el parser nunca aborta en el primero). Ver la gramática formal y la
  tabla completa de códigos de diagnóstico en
  [`packages/core/GRAMMAR.md`](packages/core/GRAMMAR.md).

  `@tejo/core` también expone `render(source)`, que hace `parse()` +
  layout + render a SVG en un solo paso:

  ```ts
  import { render } from "@tejo/core";

  const { diagrams, diagnostics } = render(source);
  // un elemento por bloque: { name, title, kind: "flow" | "sequence", svg }
  ```

  `diagrams` trae un elemento por cada bloque que se pudo parsear, con su
  SVG, aunque el documento tenga errores en otras partes.

  Para varios documentos que comparten un catálogo (`use "./catalogo.flo"`),
  `Workspace` los resuelve juntos y arma el índice de referencias:

  ```ts
  import { Workspace, renderBlock } from "@tejo/core";

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
  vocabulario se deduce de las notas: crecer es libre, un tag o un tipo de
  relación nuevo se suma al catálogo con solo usarlo.

  `query` filtra y expande el grafo; `tagCatalog` lista los tags en uso:

  ```ts
  import { query, tagCatalog } from "@tejo/core";

  const link = ws.link();
  query(link, { where: { typeTag: "decision" }, depth: 1, project: "full" });
  // { nodes: [{ id: "pkce", distance: 0, body, ... }, { id: "api", distance: 1, ... }], edges: [...] }
  tagCatalog(link); // { typeTags, contextTags, relationTypes, customTags }
  ```

- **`@tejo/web`** (`packages/web`) — vanilla TypeScript + Vite, consume
  `@tejo/core`. Editor split-pane: CodeMirror 6 a la izquierda (resaltado
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
  los `.flo` y `.md` (sin `node_modules` ni `.git`); sin esa API el navegador cae a un
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

- **`@tejo/mcp`** (`packages/mcp`) — servidor MCP local (stdio) sobre una
  carpeta de documentos `.flo` y `.md` con frontmatter. Relee lo que cambia en disco.

  Herramientas: `query`, `get_node`, `list_tags` (vocabulario en uso, con
  tipos de relación; un valor nuevo se suma al catálogo), `check` y `write_node`
  (solo escribe `.md`/`.flo` dentro de la carpeta, y solo si el
  type-checker no encuentra errores nuevos). Al conectar, el servidor le pasa
  al agente instrucciones de uso: cuándo consultar y anotar, el formato de una
  nota y cómo reutilizar las existentes.

  Para usarlo desde Claude Code, `npx @ivanroosveltlt/tejo init` deja el `.mcp.json` listo
  (o a mano: `claude mcp add tejo -- npx -y @ivanroosveltlt/tejo mcp knowledge`).

- **`@ivanroosveltlt/tejo`** (`packages/tejo`) — el CLI publicable: empaqueta core, mcp y el
  visor web en un solo paquete (`dist/cli.js` + `dist/viewer/`).

  ```bash
  npm i -D @ivanroosveltlt/tejo     # o usa npx @ivanroosveltlt/tejo … sin instalar
  npx @ivanroosveltlt/tejo init  # crea knowledge/, .mcp.json, .claude/skills/tejo y el bloque de AGENTS.md
  npx @ivanroosveltlt/tejo view  # abre el visor en http://127.0.0.1:8356
  npx @ivanroosveltlt/tejo check # lista errores; sale con 1 si hay alguno (útil en CI)
  ```

  Todos los comandos aceptan la carpeta como argumento (por defecto `knowledge`).
  `init` puede correrse otra vez y solo actualiza lo suyo; `mcp` lo arranca el
  agente desde `.mcp.json`; `view [--port N] [--no-open]` lee y guarda
  directamente en la carpeta. `pnpm --filter @ivanroosveltlt/tejo test:pack` instala el
  tarball en un proyecto temporal y prueba `init`, `check` y `view`.

## Desarrollo

Requiere Node 20+ y pnpm (via `corepack enable`, la versión queda fijada
por `packageManager` en el `package.json` raíz).

```bash
pnpm install
pnpm build      # compila @tejo/core, y después @tejo/web, @tejo/mcp y @ivanroosveltlt/tejo
pnpm typecheck
pnpm test       # 558 tests (vitest): 250 en @tejo/core + 214 en @tejo/web + 54 en @tejo/mcp + 40 en @ivanroosveltlt/tejo
```

Cada paquete también corre estos scripts individualmente con
`pnpm --filter @tejo/core <script>` / `pnpm --filter @tejo/web <script>`.
`@tejo/web` además tiene `pnpm --filter @tejo/web dev` para levantar el
editor con Vite en modo desarrollo (hot reload).

Para servir el build estático (`packages/web/dist`) como lo haría un
hosting de archivos planos:

```bash
pnpm build   # genera packages/web/dist
pnpm serve   # vite preview — sirve ese dist localmente
```

## CI y releases

- **CI** (`.github/workflows/ci.yml`): `install --frozen-lockfile → build →
  typecheck → test → test:pack` en cada push y PR.
- **Release** (`.github/workflows/release.yml`): un tag `v*` publica
  `@ivanroosveltlt/tejo` en npm. Corre build, typecheck y tests, comprueba
  que el tag coincida con la `version` de `packages/tejo/package.json` y
  publica con [Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
  (OIDC): no hay token de npm en el repo. La conexión está configurada en
  npmjs.com → paquete → Settings → Trusted Publisher, atada a
  `ivanroosvelt/tejo` y `release.yml`; si el workflow cambia de nombre hay
  que recrearla.

Para sacar una versión:

```bash
cd packages/tejo && npm version patch --no-git-tag-version && cd ../..   # o minor / major
git commit -am "chore(tejo): vX.Y.Z"
git tag vX.Y.Z && git push --follow-tags
```

Solo se publica `@ivanroosveltlt/tejo`; `@tejo/core`, `@tejo/mcp` y
`@tejo/web` son privados y viajan empaquetados dentro del CLI.

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

Hecho: lenguaje, layout y render a SVG, editor web, entidades
centralizadas y workspace (fases A–F), grafo de conocimiento y MCP
(K1–K4), y el CLI publicado en npm con releases por tag.

- **Pendiente** — habilitar GitHub Pages en Settings → Pages → Source:
  "GitHub Actions" para que el workflow de deploy del editor quede activo.

Detalle completo de cada fase en los specs enlazados arriba.
