# .flo

`.flo` es un lenguaje de diagramas propio — un reemplazo de Mermaid con
gramática determinista, parser con recuperación de errores y diagnósticos
estructurados en vez de mensajes de texto suelto. Sin compatibilidad con
sintaxis Mermaid: es un formato nuevo desde cero.

> **Estado actual:** Fase 0 (monorepo + CI), Fase 1 (lenguaje: lexer,
> parser, AST, diagnostics), Fase 2 (layout con `dagre` + render a SVG),
> Fase 3 (editor web: CodeMirror 6 + preview en vivo) y Fase 4
> (persistencia: File System Access API + fallback de descarga, autosave
> a IndexedDB, exportación a SVG/PNG) completas para los tipos
> `flowchart` y `sequence`. Falta publicar `@flo/core` a npm y desplegar
> el editor — eso es la próxima fase (ver [Roadmap](#roadmap)).

## Ejemplos

```
diagram flowchart

start[Inicio]
check{¿Login válido?}
home[Mostrar home]
error[Mostrar error]

start -> check
check -> home : sí
check -> error : no
```

```
diagram sequence

participant user as Usuario
participant api as API
participant db as Base de datos

user -> api : POST /login
api -> db : SELECT usuario
db -> api : fila
api -> user : 200 OK
```

## Paquetes

Monorepo con pnpm workspaces:

- **`@flo/core`** (`packages/core`) — lexer, parser, AST y diagnostics.
  Cero dependencias de runtime, no importa nada de `@flo/web` ni de
  ningún framework de UI: pensado para publicarse a npm de forma
  independiente. API pública:

  ```ts
  import { parse } from "@flo/core";

  const { diagram, diagnostics } = parse(source);
  ```

  `diagram` es `null` si el header (`diagram <tipo>`) es inválido;
  `diagnostics` siempre trae todos los errores encontrados en la pasada
  (el parser nunca aborta en el primer error). Ver la gramática formal y
  la tabla completa de códigos de diagnóstico en
  [`packages/core/GRAMMAR.md`](packages/core/GRAMMAR.md).

  `@flo/core` también expone `render(source)`, que hace `parse()` +
  layout + render a SVG en un solo paso:

  ```ts
  import { render } from "@flo/core";

  const { svg, diagnostics } = render(source);
  ```

  `svg` es `null` solo cuando `diagram` también lo sería (error de
  header); si el cuerpo tiene errores recuperables, `svg` sigue
  reflejando el diagrama parcial y `diagnostics` trae los errores, igual
  que `parse()`.

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

- [`docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md`](docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md) — diseño y alcance del proyecto completo (todas las fases).
- [`docs/superpowers/plans/2026-09-17-flo-lenguaje-mvp.md`](docs/superpowers/plans/2026-09-17-flo-lenguaje-mvp.md) — plan de implementación de Fase 0 + Fase 1.
- [`docs/superpowers/plans/2026-09-17-flo-layout-render-svg.md`](docs/superpowers/plans/2026-09-17-flo-layout-render-svg.md) — plan de implementación de Fase 2 (layout + render a SVG).
- [`packages/core/GRAMMAR.md`](packages/core/GRAMMAR.md) — gramática formal (EBNF), reglas léxicas especiales y tabla de códigos de diagnóstico (E001–E027).

## Roadmap

- **Fase 5** — publicación de `@flo/core` a npm, documentación de usuario final, deploy del editor.

Detalle completo de cada fase en el spec enlazado arriba.
