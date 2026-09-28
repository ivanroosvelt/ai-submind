# .flo

`.flo` es un lenguaje de diagramas propio — un reemplazo de Mermaid con
gramática determinista, parser con recuperación de errores y diagnósticos
estructurados en vez de mensajes de texto suelto. Sin compatibilidad con
sintaxis Mermaid: es un formato nuevo desde cero.

> **Estado actual:** Fases 0-4 completas (monorepo + CI, lenguaje, layout
> + render SVG, editor web, persistencia y exportación) para los tipos
> `flowchart` y `sequence`. Fase 5 completa: workflow de deploy a
> GitHub Pages listo, guía de sintaxis para usuario final en
> [`docs/SYNTAX.md`](docs/SYNTAX.md), y `@flo/core` preparado para
> publicarse en npm. Falta un paso manual para activar el deploy
> (habilitar Pages en Settings) y ejecutar el `npm publish` real —
> ambos son la Fase 6 (ver [Roadmap](#roadmap)).

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

## Uso

Requiere Node 20+ y pnpm (via `corepack enable`, la versión queda fijada
por `packageManager` en el `package.json` raíz).

```bash
pnpm install
pnpm build      # compila @flo/core y @flo/web, en ese orden
pnpm typecheck
pnpm test       # 80 tests (vitest) en @flo/core + @flo/web
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
- [`packages/core/GRAMMAR.md`](packages/core/GRAMMAR.md) — gramática formal (EBNF), reglas léxicas especiales y tabla de códigos de diagnóstico.

## Roadmap

- **Fase 6** — `npm publish` real de `@flo/core` (el paquete ya está preparado; falta correr `npm login && npm publish --access public` desde `packages/core` con una cuenta npm autenticada, y habilitar GitHub Pages en Settings → Pages → Source: "GitHub Actions" para que el workflow de deploy quede activo).

Detalle completo de cada fase en el spec enlazado arriba.
