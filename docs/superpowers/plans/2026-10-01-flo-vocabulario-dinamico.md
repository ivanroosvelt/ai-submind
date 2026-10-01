# .flo — vocabulario dinámico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El vocabulario del grafo de conocimiento (`type_tags` y tipos de
relación) sale de las fuentes. `knowledge.schema.yaml` deja de ser
obligatorio. Si existe, sigue cerrando el vocabulario como hoy.

**Spec:** `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
§11, decisión nueva **#61**, que enmienda a #29.

**Architecture:** Tres tasks:
1. Core: sin E068 por ausencia; `TagCatalog.relationTypes`.
2. MCP: ajustado al nuevo contrato.
3. Web, ejemplos y docs de usuario.

Las tasks 2 y 3 dependen de 1, porque consumen `@flo/core` por `dist/`.

**Tech Stack:** TypeScript 5 (strict), Vitest.

## Global Constraints

- Sin dependencias nuevas. Imports relativos de `packages/core/src/` con `.js`.
- Snapshots de SVG: no cambian, nunca `vitest -u`.
- Mensajes y comentarios en español, con tuteo (#60).
- `E068` **no se reusa** con otro significado. Pierde el caso "falta el
  esquema" y conserva "contenido inválido del esquema". Se actualiza la tabla
  de `packages/core/GRAMMAR.md`.
- Un commit por task: `feat(core): ...`, `feat(mcp): ...`, `feat(web): ...`
  / `docs: ...`. Solo `git add` de los archivos de la task: otra sesión
  puede estar trabajando en el mismo worktree.
- Verificación final: `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

---

### Task 1: core — esquema opcional y `relationTypes`

**Files:**
- `packages/core/src/workspace/resolver.ts`: el bloque
  `if (vocabulary === "missing")` emite E068. Sin esquema no se emite nada
  y no se valida vocabulario. Actualizar los comentarios (línea ~17 y ~34).
  Si `"missing"` queda sin uso, simplificar el tipo `Vocabulary`.
- `packages/core/src/workspace/schema.ts`: revisar comentarios y mensajes
  que asuman obligatoriedad.
- `packages/core/src/parser/index.ts`: el comentario de `parse()` dice que
  un `.md` suelto siempre lleva E068. Ya no.
- `packages/core/src/parser/markdown.ts`: el comentario de `openingRange()`
  menciona "E068 por esquema ausente".
- `packages/core/src/workspace/query.ts`: `TagCatalog` gana
  `relationTypes: string[]`, con los `relation.type` de todas las notas sin
  repetir y en orden de aparición. `tagCatalog()` lo llena.
- Tests de core que esperan E068 por ausencia (`grep -rn E068
  packages/core/src`): pasan a esperar **ningún** diagnóstico de
  vocabulario. Agregar:
  - (a) un workspace con `.md` y sin esquema: cero diagnósticos, y
    `tagCatalog` lista sus `typeTags` y `relationTypes`;
  - (b) con esquema válido, E065/E066 siguen como antes (ya cubierto:
    verificar que siga);
  - (c) con esquema inválido: diagnósticos en el esquema y sin validar
    vocabulario (ya cubierto: verificar).
- `packages/core/GRAMMAR.md`: la sección del esquema dice que es opcional
  y que, sin él, el vocabulario es el que se usa. En la tabla, `E068` pasa a
  "el contenido de `knowledge.schema.yaml` es inválido".
- `docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md`
  §3.4: nota breve "Enmendado por #61", sin reescribir la historia.

- [ ] Tests primero (TDD), implementación, `pnpm --filter @flo/core test` y `typecheck`.
- [ ] `pnpm --filter @flo/core build`.
- [ ] Commit `feat(core): vocabulario dinámico, el esquema de conocimiento es opcional (#61)`.

### Task 2: MCP

**Files:** `packages/mcp/src/tools.ts`, `packages/mcp/src/folder.ts` y sus
tests. `README.md`, en la sección del servidor MCP.

- La herramienta `tags` describe y devuelve también `relationTypes` (sale de
  `tagCatalog`). La descripción dice que es el vocabulario en uso.
- `check` y `write_node`: en una carpeta sin esquema, una nota válida ya no
  da E068. `write_node` la acepta. Agregar un test que escriba una nota en
  una carpeta sin `knowledge.schema.yaml` y que se acepte.
- `folder.ts`: el esquema se sigue leyendo si existe. Revisar textos y
  comentarios que lo den por obligatorio.
- Revisar en `README.md` (líneas ~101, ~129, ~159) los textos que describen
  el esquema como obligatorio.

- [ ] Tests, `pnpm --filter @flo/mcp test` y `typecheck`.
- [ ] Commit `feat(mcp): vocabulario en uso con tipos de relación y sin esquema obligatorio (#61)`.

### Task 3: web, ejemplos y docs

**Files:** `examples/04-conocimiento/knowledge.schema.yaml` (se borra),
`packages/web/src/examples.ts`, `examples/README.md` y los tests de web que
mencionen E068 o el esquema del ejemplo.

- Borrar el esquema del ejemplo 04 y su import en `examples.ts`. El ejemplo
  debe cargar sin diagnósticos. Verificarlo con un test: en web ya hay tests
  de ejemplos, extender `examples.test.ts`.
- Recorrer todos los ejemplos (`examples/*`) y confirmar que ninguno dependa
  del esquema.
- `examples/README.md`: quitar el esquema de la descripción del 04 y
  explicar en una línea que el vocabulario sale de las notas y que un
  `knowledge.schema.yaml` opcional lo cierra.
- Tests de web que construyen workspaces de conocimiento con esquema (p. ej.
  `KG_SOURCES` en `app.test.ts`): se dejan, porque prueban el caso con
  esquema. Solo se cambia lo que esperaba E068 por ausencia.
- Si algún texto de la UI menciona el esquema como obligatorio, ajustarlo.

- [ ] `pnpm --filter @flo/web test` y `typecheck`.
- [ ] Commit `feat(web): ejemplos sin esquema de conocimiento (#61)`.
