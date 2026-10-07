# tejo — lenguaje `.flo`

Monorepo pnpm: `packages/core` (`@tejo/core`: lexer, parser, resolver,
layout, render a SVG), `packages/mcp` (`@tejo/mcp`), `packages/web`
(`@tejo/web`: editor + preview) y `packages/tejo` (`tejo`: la CLI publicable,
que empaqueta core, mcp y el visor).

## Flujo de trabajo

- Spec → plan (`docs/superpowers/plans/`) → ejecución **siempre
  subagent-driven** (superpowers:subagent-driven-development).
- Las decisiones de lenguaje ya tomadas están en
  `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` §11.
  No se reabren en un plan; una decisión nueva que otra fase vaya a volver
  a encontrar se agrega ahí en el mismo cambio.

## Convenciones que no se negocian por task

- **Snapshots de SVG** (`packages/core/src/render/__snapshots__/`): en un
  refactor o cambio de sintaxis **nunca se regeneran** (`vitest -u`
  prohibido). Si un snapshot cambia sin que la task lo pida, es un bug.
  Solo se editan a mano para borrar un caso que dejó de existir o renombrar
  la clave de un test renombrado, sin tocar el valor.
- **Códigos de diagnóstico**: un código retirado no se reusa con otro
  significado. Los nuevos toman el siguiente libre de su rango; la tabla
  vigente vive en `packages/core/GRAMMAR.md`.
- **Imports relativos en `packages/core/src/` llevan sufijo `.js`**
  (`"module": "NodeNext"`).
- **`@tejo/web` consume `@tejo/core` por `dist/` y `tejo` consume `@tejo/mcp`
  por `dist/`**: tras cambiar la API, `pnpm -r build` antes de los tests.
- Sin dependencias nuevas salvo que el spec lo diga.
- Mensajes de diagnóstico y comentarios en español.
- Commits chicos, uno por task: `feat(core): ...`, `refactor(core): ...`,
  `fix(web): ...`, `docs: ...`.

## Verificación

`pnpm -r build && pnpm -r typecheck && pnpm -r test`
