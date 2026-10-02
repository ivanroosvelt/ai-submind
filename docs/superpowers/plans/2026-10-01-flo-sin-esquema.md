# .flo — sin esquema de conocimiento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-10-01 (`8687b49`..`bfe3520`; fixes `03ed356` y `bfe3520`).

**Goal:** Eliminar `knowledge.schema.yaml` del lenguaje. El catálogo de
vocabulario se deduce siempre de las notas, y un valor nuevo se suma solo.

**Spec:** `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
§11, decisión **#62**, que reemplaza a #61 y a la parte de esquema de #29.

**Architecture:** Dos tasks:
1. Core quita el esquema y la validación de vocabulario.
2. MCP, web, ejemplos y docs se alinean.

La task 2 consume `@flo/core` por `dist/`.

## Global Constraints

- Sin dependencias nuevas. Imports relativos de `packages/core/src/` con `.js`.
- Snapshots SVG: no cambian, nunca `vitest -u`.
- Español con tuteo.
- `E065`, `E066` y `E068` quedan **retirados**: no se reusan. En la tabla de
  `packages/core/GRAMMAR.md` se marcan como retirados (#62), siguiendo la
  convención que ya use la tabla para códigos retirados (buscarla). Si no
  hay convención, se agrega una fila "retirado (#62)".
- La validación de **forma** del frontmatter (`E063` y demás) no cambia.
- Un commit por task. Solo `git add` de los archivos de la task: hay otra
  sesión en el mismo worktree.
- Verificación final: `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

---

### Task 1: core — quitar el esquema

- Borrar `packages/core/src/workspace/schema.ts` y `schema.test.ts`. Si
  algún helper de ahí lo usa otro módulo, moverlo a donde corresponda.
- `workspace.ts`: sin rama de esquema. `knowledge.schema.yaml` se trata
  como cualquier uri que no es `.flo`/`.md`.
- `uri.ts`: `isDocumentUri` ya no acepta `SCHEMA_URI`. Revisar `uri.test.ts`.
- `resolver.ts`: sin `Vocabulary` ni `checkVocabulary`, y sin el mensaje
  "es el esquema de conocimiento, no un documento" (~línea 113). Un
  `relations.target` que apunte a ese archivo se resuelve como cualquier
  ruta inexistente (E035).
- `index.ts`: dejar de exportar `SCHEMA_URI` y los tipos de esquema.
- `ast.ts`: quitar lo que solo existía para el esquema (p. ej.
  `typeTagRanges`, si su único uso era E065; verificar con grep).
- `parser/index.ts` y `parser/markdown.ts`: comentarios.
- Tests de core que usan esquema (`index.test.ts`, `workspace.test.ts`,
  `resolver.test.ts`, `query.test.ts`, `parser/index.test.ts`,
  `render/knowledge.test.ts`, `uri.test.ts`): quitar el esquema de los
  fixtures. Los tests de E065/E066/E068 se reemplazan por uno que pruebe que
  un tag o tipo de relación nuevo **no** da diagnóstico y aparece en
  `tagCatalog`. Un `knowledge.schema.yaml` presente no es documento y no
  produce diagnósticos.
- `GRAMMAR.md`: quitar la sección del esquema y explicar en una línea que
  el vocabulario se deduce de las notas. Marcar E065/E066/E068 como
  retirados.
- `docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md`:
  nota "_Reemplazado por #62_" en §3.4 y en las filas E065/E066/E068.

- [x] Tests, `pnpm --filter @flo/core test` y `typecheck`, `pnpm --filter @flo/core build`.
- [x] Commit `feat(core): sin esquema de conocimiento, el vocabulario se deduce de las notas (#62)`.

### Task 2: MCP, web, ejemplos y docs

- `packages/mcp/src/folder.ts`: quitar `SCHEMA_URI` (import y usos). Los
  archivos se cargan con `isDocumentUri`.
- `packages/mcp/src/tools.ts`, descripción de `list_tags`: "El catálogo de
  vocabulario deducido de las notas: type_tags, context_tags,
  relation_types y custom_tags. Usa los valores existentes cuando
  apliquen; si ninguno sirve, puedes crear uno nuevo en la nota y se suma
  al catálogo." Quitar la mención al esquema. Revisar las descripciones de
  `write_node` y `check` por menciones del esquema.
- Tests MCP (`folder.test.ts`, `tools.test.ts`): sin esquema en los
  fixtures. Agregar un test: `write_node` de una nota con un `type_tag` y
  un tipo de relación nuevos se acepta, y `list_tags` los lista después.
- `packages/web/src/folder-io.ts`: quitar `SCHEMA_URI`. `active` es el
  primer uri.
- Tests web (`folder-io.test.ts`, `app.test.ts` con `KG_SOURCES`,
  `preview.test.ts`, `knowledge-view.test.ts`, `examples.test.ts`): quitar
  el esquema de los fixtures. En `examples.test.ts`, el test "sin esquema"
  pasa a sobrar: borrarlo o dejarlo según aporte.
- `README.md`, `examples/README.md` y `docs/SYNTAX.md` (si lo menciona):
  sin esquema. El vocabulario se deduce de las notas y crecer es libre.
- `grep -rn "schema\|esquema\|E06[568]"` sobre `packages/*/src`, docs de
  usuario y ejemplos: no debe quedar nada del esquema de conocimiento
  (salvo `inputSchema` de zod y los specs históricos).

- [x] `pnpm --filter @flo/mcp test`, `pnpm --filter @flo/web test`, `typecheck` de ambos.
- [x] Commit `feat: MCP y web sin esquema de conocimiento (#62)`.
