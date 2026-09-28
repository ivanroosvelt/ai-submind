# .flo — Workspace multi-documento (Fase D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que varios documentos `.flo` compartan un catálogo de entidades
mediante `use "./ruta.flo"`, con resolución transitiva y deduplicada, un
`Workspace` en memoria (`setDocument` / `removeDocument` / `link()`) y un
índice de referencias cruzadas (`XRefIndex`).

**Architecture:** El parser aprende la sentencia `use` (`UseDecl` en
`ParsedDocument.uses`). `workspace/uri.ts` resuelve rutas relativas sin
`node:path` (el core corre en el navegador). `workspace/resolver.ts` pasa
de `resolveDocument(doc)` a `linkDocuments(docs)`: catálogo global (los ids
son únicos en el workspace), un catálogo *alcanzable* por documento
(post-orden DFS sobre `use`) contra el que se resuelven las referencias, y
diagnósticos por documento. `workspace/xref.ts` construye el índice a
partir de las referencias ya resueltas. `workspace/workspace.ts` guarda los
documentos parseados y compone todo en `link()`. `parse()`/`render()`
siguen siendo la API de documento único (la web no cambia) y pasan a ser un
`Workspace` de un documento.

**Tech Stack:** TypeScript 5 (strict), Vitest. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
(§2 "Resolución de `use`", §6 arquitectura, §6.1 tipos, §6.2 índice, §7
diagnósticos, §10 Fase D, §11 decisiones #1, #2, #3, #9, #13, #15). Orden de
fases en `docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md` §10.

## Global Constraints

- **Snapshots de SVG no se regeneran** (`vitest -u` prohibido). Esta fase
  no cambia ningún SVG: si `render/__snapshots__/` cambia, es un bug.
- **Imports relativos en `packages/core/src/` llevan sufijo `.js`.**
- **Sin dependencias nuevas.** Nada de `node:path` ni otros módulos de Node
  en `@flo/core`: también corre en el navegador.
- **Mensajes de diagnóstico y comentarios en español.** Nombres de test en
  inglés, como el resto de la suite.
- **Códigos de diagnóstico:** `E032` ya tiene significado reservado en el
  spec §7 ("`use` apunta a un documento inexistente") y se usa con ese
  significado. El único código nuevo es `E046` (siguiente libre de `E04x`).
  Tabla vigente en `packages/core/GRAMMAR.md`.
- **Decisiones nuevas** que otra fase va a volver a encontrar se agregan al
  §11 del spec en el mismo commit de la task que las introduce (#23, #24,
  #25, textos exactos en cada task).
- **No se exporta** `Workspace` ni `XRefIndex` desde `src/index.ts`: eso es
  la Fase E. La API pública (`parse`, `render`, tipos) no cambia de forma;
  solo `ParsedDocument` gana el campo `uses` y se exporta el tipo `UseDecl`.
- **`@flo/web` no se toca.** Consume `@flo/core` por `dist/`: la task 5
  termina con `pnpm --filter @flo/core build` y la suite completa.
- Un commit por task: `feat(core): ...` / `refactor(core): ...`, terminando
  con la línea `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verificación final: `pnpm -r typecheck && pnpm -r test && pnpm -r build`
  (desde la raíz del repo).

## Review Focus

1. **Ruta de `use` que sale de la raíz** (`use "../../x.flo"` desde
   `a.flo`) → `E032` en el string, sin excepción. Test en task 2 (null) y
   task 3 (E032).
2. **Ciclos, auto-`use` y `use` repetido** (`a` usa `b`, `b` usa `a`; `a`
   se usa a sí mismo; la misma ruta dos veces) → sin diagnósticos, sin
   recursión infinita, catálogo sin duplicados. Test en task 3.
3. **El orden de `setDocument` no cambia nada**: mismo catálogo global,
   mismo ganador de `E031`, mismos diagnósticos. Test en task 3 y task 5.
4. **Quitar un documento usado** (`removeDocument("catalog.flo")`) →
   `E032` en el `use` del que lo usaba y `E030` en sus referencias, en el
   siguiente `link()`. Test en task 5.
5. **Re-link tras editar**: una referencia que resolvía y deja de hacerlo
   queda con `target === null` (no conserva el valor del link anterior).
   Test en task 5.

---

## File Structure

| Archivo | Responsabilidad | Task |
|---|---|---|
| `packages/core/src/ast.ts` | `UseDecl`; `ParsedDocument.uses` | 1 |
| `packages/core/src/parser/cursor.ts` | `isTopLevelKeyword` compartido (incluye `use`) | 1 |
| `packages/core/src/parser/document.ts` | `parseUse`, despacho de `use`, mensaje de `E040` | 1 |
| `packages/core/src/parser/block.ts`, `entity.ts` | usar `isTopLevelKeyword` | 1 |
| `packages/core/src/workspace/uri.ts` (nuevo) | `resolveUse(from, path)` | 2 |
| `packages/core/src/diagnostics.ts` | `sortDiagnostics` (movido desde `parser/index.ts`) | 3 |
| `packages/core/src/workspace/resolver.ts` | `linkDocuments`, `byUri`, `Catalog` | 3 |
| `packages/core/src/parser/index.ts` | `parse()` sobre `linkDocuments` (task 3), sobre `Workspace` (task 5) | 3, 5 |
| `packages/core/src/workspace/xref.ts` (nuevo) | `XRefIndex`, `BlockId`, `Location`, `blockId` | 4 |
| `packages/core/src/workspace/workspace.ts` (nuevo) | `Workspace`, `LinkResult`, `LinkedDocument` | 5 |
| `packages/core/src/layout/nodes.ts`, `flowchart.ts`, `sequence.ts` | `nodeId(ref)` (decisión #15) | 5 |
| `packages/core/GRAMMAR.md` | gramática de `use`, reglas de resolución, `E032`, `E046` | 1, 3 |
| `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` | §11 #23–#25 | 1, 3, 4 |

---

### Task 1: Sentencia `use` en el parser

**Files:**
- Modify: `packages/core/src/ast.ts`
- Modify: `packages/core/src/parser/cursor.ts`
- Modify: `packages/core/src/parser/document.ts`
- Modify: `packages/core/src/parser/block.ts:10-12,116`
- Modify: `packages/core/src/parser/entity.ts:97`
- Modify: `packages/core/src/index.ts` (exportar el tipo `UseDecl`)
- Modify: `packages/core/GRAMMAR.md`
- Modify: `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` (append)
- Test: `packages/core/src/parser/document.test.ts`

**Interfaces:**
- Consumes: `TokenCursor`, `reportTrailing`, `diagnosticAt` (existentes).
- Produces:
  ```ts
  // ast.ts
  export interface UseDecl {
    path: string;      // tal como se escribió, sin comillas
    range: Range;      // desde `use` hasta la comilla de cierre
    pathRange: Range;  // el string, comillas incluidas
  }
  export interface ParsedDocument {
    uri: DocumentUri;
    uses: UseDecl[];
    entities: EntityDecl[];
    blocks: DiagramBlock[];
  }
  // parser/cursor.ts
  export function isTopLevelKeyword(value: string): boolean; // entity | flow | sequence | use
  ```

- [ ] **Step 1: Escribir los tests que fallan**

En `packages/core/src/parser/document.test.ts`:

1. El test `"accepts an empty document and a catalog-only document with no diagnostics"` compara el documento vacío completo; actualizar la expectativa a:

```ts
    expect(parseDocument("", "a.flo")).toEqual({
      document: { uri: "a.flo", uses: [], entities: [], blocks: [] },
      diagnostics: [],
    });
```

2. El test `"reports E040 for an unknown top-level line and resumes at the next statement"` usaba `use` como línea inválida; ahora `use` es válido. Reemplazarlo por:

```ts
  it("reports E040 for an unknown top-level line and resumes at the next statement", () => {
    const { document, diagnostics } = parseDocument('import "./catalog.flo"\nentity a\n', "a.flo");
    expect(diagnostics.map((d) => d.code)).toEqual(["E040"]);
    expect(diagnostics[0].message).toBe("se esperaba 'entity', 'flow', 'sequence' o 'use', se encontró 'import'");
    expect(document.entities).toHaveLength(1);
  });
```

3. Agregar un `describe` nuevo al final del archivo (dentro del `describe` de nivel superior si lo hay; si no, al final):

```ts
describe("use", () => {
  it("parses 'use \"path\"' into document.uses with the path and its ranges", () => {
    const { document, diagnostics } = parseDocument('use "./catalog.flo"\nentity a\n', "a.flo");
    expect(diagnostics).toEqual([]);
    expect(document.uses).toEqual([
      {
        path: "./catalog.flo",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 20 } },
        pathRange: { start: { line: 1, column: 5 }, end: { line: 1, column: 20 } },
      },
    ]);
  });

  it("accepts use anywhere at top level, in any order with entities and blocks", () => {
    const source = 'entity a\nflow f {\n  a -> a\n}\nuse "./b.flo"\nuse "../c.flo"\n';
    const { document, diagnostics } = parseDocument(source, "dir/a.flo");
    expect(diagnostics).toEqual([]);
    expect(document.uses.map((u) => u.path)).toEqual(["./b.flo", "../c.flo"]);
  });

  it("reports E046 when use is not followed by a quoted path, and resumes at the next line", () => {
    const { document, diagnostics } = parseDocument("use catalog.flo\nuse\nentity a\n", "a.flo");
    expect(diagnostics.map((d) => [d.code, d.range.start.line, d.range.start.column])).toEqual([
      ["E046", 1, 5],
      ["E046", 2, 4],
    ]);
    expect(diagnostics[0].message).toBe("se esperaba la ruta entre comillas después de 'use'");
    expect(document.uses).toEqual([]);
    expect(document.entities).toHaveLength(1);
  });

  it("reports E016 for content after the path", () => {
    const { document, diagnostics } = parseDocument('use "./b.flo" extra\n', "a.flo");
    expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
    expect(document.uses).toHaveLength(1);
  });

  it("treats 'use' as a plain identifier inside a block edge", () => {
    const { document, diagnostics } = parseDocument("flow f {\n  use -> a\n}\n", "a.flo");
    expect(diagnostics).toEqual([]);
    expect(document.uses).toEqual([]);
    expect(document.blocks[0].edges[0].from.name).toBe("use");
  });

  it("a 'use' line inside an unclosed block or entity body closes it (E052/E045) and is parsed as top level", () => {
    const block = parseDocument('flow f {\n  a -> b\nuse "./x.flo"\n', "a.flo");
    expect(block.diagnostics.map((d) => d.code)).toEqual(["E052"]);
    expect(block.document.uses.map((u) => u.path)).toEqual(["./x.flo"]);

    const entity = parseDocument('entity a {\n  type: t\nuse "./x.flo"\n', "a.flo");
    expect(entity.diagnostics.map((d) => d.code)).toEqual(["E045"]);
    expect(entity.document.uses.map((u) => u.path)).toEqual(["./x.flo"]);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/parser/document.test.ts`
Expected: FAIL (`uses` no existe; `use` da `E040`; mensaje de `E040` distinto).

- [ ] **Step 3: Implementar**

`packages/core/src/ast.ts` — agregar antes de `ParsedDocument` y sumar el campo:

```ts
/** `use "ruta"`: trae al catálogo alcanzable las entidades de otro documento. */
export interface UseDecl {
  path: string; // tal como se escribió, sin comillas
  range: Range; // desde `use` hasta la comilla de cierre
  pathRange: Range; // el string, comillas incluidas
}

export interface ParsedDocument {
  uri: DocumentUri;
  uses: UseDecl[];
  entities: EntityDecl[];
  blocks: DiagramBlock[];
}
```

`packages/core/src/parser/cursor.ts` — agregar al final:

```ts
/**
 * Palabras clave de nivel superior (decisiones #3, #13 y #23): solo son
 * especiales al inicio de una línea de nivel superior, pero una línea que
 * empieza con una de ellas dentro de un cuerpo sin cerrar lo cierra.
 */
export function isTopLevelKeyword(value: string): boolean {
  return value === "entity" || value === "flow" || value === "sequence" || value === "use";
}
```

`packages/core/src/parser/block.ts` — borrar la función local `isTopLevelKeyword` (líneas 10-12) e importarla:

```ts
import {
  describeToken,
  isTopLevelKeyword,
  type TokenCursor,
  reportTrailing,
  reportTrailingAfterOpenBrace,
} from "./cursor.js";
```

El comentario de la línea ~117 (`// Una línea 'entity'/'flow'/'sequence' que no es un edge ...`) pasa a decir `'entity'/'flow'/'sequence'/'use'`.

`packages/core/src/parser/entity.ts:97` — reemplazar la condición por
`if (token.kind === "IDENT" && isTopLevelKeyword(token.value)) {` e importar
`isTopLevelKeyword` desde `./cursor.js` junto a lo que ya importa de ahí.

`packages/core/src/parser/document.ts`:

```ts
import { Lexer } from "../lexer.js";
import type { Token } from "../tokens.js";
import { TokenCursor, describeToken, reportTrailing } from "./cursor.js";
import { parseEntity } from "./entity.js";
import { parseBlock } from "./block.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument, UseDecl } from "../ast.js";

function topLevelMessage(token: Token): string {
  if (token.kind === "IDENT" && token.value === "diagram") {
    return "el header 'diagram <tipo>' ya no existe: declara entidades con 'entity' y diagramas con 'flow <nombre> { ... }' o 'sequence <nombre> { ... }'";
  }
  return `se esperaba 'entity', 'flow', 'sequence' o 'use', se encontró '${describeToken(token)}'`;
}

/** `Use ::= "use" String Newline`. Devuelve null si la línea no parsea (ya descartada). */
function parseUse(cursor: TokenCursor, diagnostics: Diagnostic[]): UseDecl | null {
  const keyword = cursor.advance();
  const pathToken = cursor.current();
  if (pathToken.kind !== "STRING") {
    diagnostics.push(diagnosticAt("E046", "se esperaba la ruta entre comillas después de 'use'", pathToken.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();
  reportTrailing(cursor, diagnostics);
  return {
    path: pathToken.value,
    range: { start: keyword.range.start, end: pathToken.range.end },
    pathRange: pathToken.range,
  };
}
```

En `parseDocument`: el doc-comment pasa a `Document ::= (BlankLine | Use | EntityDecl | Block)* EOF`; el documento inicial es `{ uri, uses: [], entities: [], blocks: [] }`; y se agrega una rama antes del `else` final:

```ts
    } else if (keyword === "use") {
      const use = parseUse(cursor, diagnostics);
      if (use) document.uses.push(use);
      inErrorRun = use === null;
    } else {
```

`packages/core/src/index.ts` — agregar `UseDecl` a la lista de `export type { ... } from "./ast.js"`.

- [ ] **Step 4: Correr la suite del core**

Run: `pnpm --filter @flo/core exec vitest run && pnpm --filter @flo/core typecheck`
Expected: PASS. Si algún otro test construye un `ParsedDocument` literal sin `uses`, agregarle `uses: []` (no cambiar nada más).

- [ ] **Step 5: GRAMMAR.md y §11**

En `packages/core/GRAMMAR.md`:

- La producción `Document` pasa a `Document     ::= (BlankLine | Use | EntityDecl | Block)* EOF` y se agrega debajo de `BlankLine`:
  `Use          ::= "use" String Newline`
- En "Reglas léxicas y de parseo", el bullet de palabras clave pasa a nombrar `entity`, `flow`, `sequence` y `use`; y en el bullet de recuperación de errores, "una línea que empieza con `entity`, `flow` o `sequence`" pasa a "`entity`, `flow`, `sequence` o `use`".
- Agregar un bullet: "`use` va en su propia línea, en cualquier lugar del nivel superior; la ruta es un string entre comillas (`E046` si no). Qué documento nombra y qué trae al catálogo se decide en la resolución (ver abajo)."
- En "Fuera de esta gramática", borrar "`use \"path\"` y documentos múltiples (Fase D);".
- Tabla: la fila `E040` pasa a `se esperaba \`entity\`, \`flow\`, \`sequence\` o \`use\``; agregar después de `E045`:
  `| E046 | use | se esperaba la ruta entre comillas después de \`use\` |`

Al final de `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`, agregar:

```markdown

### Decisiones de la Fase D (2026-09-28)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 23 | 2026-09-28 | **`use` es palabra clave contextual** como las de #3, y entra en la enmienda #13: una línea `use` dentro de un cuerpo sin cerrar lo cierra. `use` sin string es `E046`. | parser (D) |
```

- [ ] **Step 6: Commit**

```bash
git add packages/core docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "feat(core): sentencia 'use \"ruta\"' en el parser

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Resolución de rutas de `use`

**Files:**
- Create: `packages/core/src/workspace/uri.ts`
- Test: `packages/core/src/workspace/uri.test.ts`

**Interfaces:**
- Consumes: `DocumentUri` de `ast.ts`.
- Produces: `export function resolveUse(from: DocumentUri, path: string): DocumentUri | null;`
  Las uris son rutas POSIX relativas a la raíz del workspace (`"a.flo"`,
  `"dir/b.flo"`).

- [ ] **Step 1: Escribir el test que falla**

`packages/core/src/workspace/uri.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveUse } from "./uri.js";

describe("resolveUse", () => {
  it.each([
    ["a.flo", "./b.flo", "b.flo"],
    ["a.flo", "b.flo", "b.flo"],
    ["dir/a.flo", "./b.flo", "dir/b.flo"],
    ["dir/a.flo", "../b.flo", "b.flo"],
    ["dir/a.flo", "sub/./c.flo", "dir/sub/c.flo"],
    ["dir/sub/a.flo", "../../b.flo", "b.flo"],
    ["dir/a.flo", "/b.flo", "b.flo"], // '/' inicial = raíz del workspace
    ["", "./b.flo", "b.flo"], // uri por defecto de parse()
  ])("resolves %s + %s to %s", (from, path, expected) => {
    expect(resolveUse(from, path)).toBe(expected);
  });

  it.each([
    ["a.flo", "../b.flo"],
    ["dir/a.flo", "../../b.flo"],
    ["a.flo", ""],
    ["a.flo", "./"],
  ])("returns null for %s + %s (outside the root or empty)", (from, path) => {
    expect(resolveUse(from, path)).toBeNull();
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/uri.test.ts`
Expected: FAIL (no existe `./uri.js`).

- [ ] **Step 3: Implementar**

`packages/core/src/workspace/uri.ts`:

```ts
import type { DocumentUri } from "../ast.js";

/**
 * Resuelve la ruta de un `use` relativa al documento que la declara. Las
 * uris son rutas POSIX relativas a la raíz del workspace; un '/' inicial
 * parte de la raíz. Devuelve null si la ruta sale de la raíz o no nombra
 * nada. Sin `node:path`: `@flo/core` también corre en el navegador.
 */
export function resolveUse(from: DocumentUri, path: string): DocumentUri | null {
  const parts = path.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.length === 0 ? null : parts.join("/");
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/uri.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/workspace/uri.ts packages/core/src/workspace/uri.test.ts
git commit -m "feat(core): resolución de rutas relativas de 'use'

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Resolución multi-documento (`linkDocuments`)

**Files:**
- Modify: `packages/core/src/diagnostics.ts` (agregar `sortDiagnostics`)
- Modify: `packages/core/src/workspace/resolver.ts` (reemplaza `resolveDocument`)
- Modify: `packages/core/src/parser/index.ts`
- Modify: `packages/core/GRAMMAR.md`
- Modify: `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` (fila #24)
- Test: `packages/core/src/workspace/resolver.test.ts` (reescrito)

**Interfaces:**
- Consumes: `resolveUse` (task 2); `ParsedDocument.uses` (task 1).
- Produces:
  ```ts
  // diagnostics.ts
  export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[]; // ordena in place por (línea, columna) y devuelve el mismo array
  // workspace/resolver.ts
  export type Catalog = Map<EntityId, EntityDecl>;
  export function byUri(a: { uri: DocumentUri }, b: { uri: DocumentUri }): number;
  export interface LinkedDocuments {
    entities: Catalog;                              // global: la declaración ganadora de cada id
    catalogs: Map<DocumentUri, Catalog>;            // por documento: lo alcanzable vía `use`
    uses: Map<DocumentUri, DocumentUri[]>;          // por documento: uris que sus `use` resuelven
    diagnostics: Map<DocumentUri, Diagnostic[]>;    // solo resolución (E030–E033), ordenados
  }
  export function linkDocuments(documents: ParsedDocument[]): LinkedDocuments;
  ```
  Efecto: rellena `Ref.target` de **todas** las referencias de todos los documentos (resuelta o `null`).

Reglas (decisión #24, texto en el step 5):
- Los documentos se procesan **ordenados por uri** (comparación de strings), sin importar el orden de entrada.
- **Catálogo global**: por documento en ese orden y por entidad en orden de fuente, la primera declaración de un id gana; las demás dan `E031` en su `nameRange` (mensaje con `en '<uri>'` si la primera está en otro documento).
- **`use`**: `resolveUse(doc.uri, use.path)`; si da `null` o la uri no está entre los documentos → `E032` en `pathRange`. Las uris resueltas se guardan en orden de aparición y sin repetir.
- **Catálogo alcanzable** de un documento: post-orden DFS sobre `use` desde él (dependencias primero, él al final; los ciclos se cortan por visitado); de cada documento visitado, sus entidades en orden de fuente **que son la ganadora global** de su id.
- **Referencias** se resuelven contra el catálogo alcanzable. Si no resuelve pero el id existe en el catálogo global, el `E030` dice dónde está.
- `E033` sigue siendo por documento.

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar todo `packages/core/src/workspace/resolver.test.ts` por:

```ts
import { describe, it, expect } from "vitest";
import { parseDocument } from "../parser/document.js";
import { linkDocuments } from "./resolver.js";
import type { Diagnostic } from "../diagnostics.js";

function link(files: Record<string, string>) {
  const documents = Object.entries(files).map(([uri, source]) => parseDocument(source, uri).document);
  const byUri = new Map(documents.map((d) => [d.uri, d]));
  return { documents: byUri, ...linkDocuments(documents) };
}

function codes(diagnostics: Diagnostic[] | undefined) {
  return (diagnostics ?? []).map((d) => [d.code, d.range.start.line, d.range.start.column]);
}

describe("linkDocuments — un documento", () => {
  it("resolves references to entities declared anywhere in the document (order-independent)", () => {
    const { documents, catalogs, diagnostics } = link({ "a.flo": "flow f {\n  a -> b\n}\nentity a\nentity b\n" });
    expect(diagnostics.get("a.flo")).toEqual([]);
    expect([...catalogs.get("a.flo")!.keys()]).toEqual(["a", "b"]);
    const edge = documents.get("a.flo")!.blocks[0].edges[0];
    expect(edge.from.target).toBe("a");
    expect(edge.to.target).toBe("b");
  });

  it("reports E030 at each unresolved reference, with the fix in the message", () => {
    const { documents, diagnostics } = link({ "a.flo": "entity a\nflow f {\n  a -> Cache\n}\n" });
    expect(diagnostics.get("a.flo")).toEqual([
      {
        code: "E030",
        message: "la entidad 'Cache' no está declarada; añade 'entity Cache'",
        range: { start: { line: 3, column: 8 }, end: { line: 3, column: 13 } },
        severity: "error",
      },
    ]);
    expect(documents.get("a.flo")!.blocks[0].edges[0].to.target).toBeNull();
  });

  it("keeps the first declaration of a duplicated entity and reports E031 at the second one's name", () => {
    const { entities, diagnostics } = link({ "a.flo": "entity a [Primera]\nentity a [Segunda]\n" });
    expect(entities.get("a")?.label).toBe("Primera");
    expect(diagnostics.get("a.flo")!.map((d) => d.message)).toEqual(["la entidad 'a' ya fue declarada"]);
    expect(codes(diagnostics.get("a.flo"))).toEqual([["E031", 2, 8]]);
  });

  it("reports E033 at the name of a duplicated block, across flow and sequence", () => {
    const { diagnostics } = link({ "a.flo": "entity a\nflow x {\n  a -> a\n}\nsequence x {\n  a -> a : y\n}\n" });
    expect(codes(diagnostics.get("a.flo"))).toEqual([["E033", 5, 10]]);
  });

  it("returns diagnostics sorted by position", () => {
    const { diagnostics } = link({ "a.flo": "flow f {\n  x -> y\n}\nentity a\nentity a\n" });
    expect(codes(diagnostics.get("a.flo"))).toEqual([
      ["E030", 2, 3],
      ["E030", 2, 8],
      ["E031", 5, 8],
    ]);
  });
});

describe("linkDocuments — varios documentos", () => {
  const catalog = "entity db [Base de datos]\nentity api\n";
  const login = 'use "./catalog.flo"\nentity ui\nflow f {\n  ui -> api\n  api -> db\n}\n';

  it("resolves references through use; the reachable catalog lists dependencies first", () => {
    const { documents, catalogs, diagnostics } = link({ "catalog.flo": catalog, "login.flo": login });
    expect(diagnostics.get("login.flo")).toEqual([]);
    expect(diagnostics.get("catalog.flo")).toEqual([]);
    expect([...catalogs.get("login.flo")!.keys()]).toEqual(["db", "api", "ui"]);
    expect([...catalogs.get("catalog.flo")!.keys()]).toEqual(["db", "api"]);
    const edges = documents.get("login.flo")!.blocks[0].edges;
    expect(edges.map((e) => [e.from.target, e.to.target])).toEqual([
      ["ui", "api"],
      ["api", "db"],
    ]);
  });

  it("resolves use transitively, deepest dependency first", () => {
    const { catalogs, diagnostics } = link({
      "a.flo": 'use "./b.flo"\nentity x\nflow f {\n  x -> z\n}\n',
      "b.flo": 'use "./sub/c.flo"\nentity y\n',
      "sub/c.flo": "entity z\n",
    });
    expect(diagnostics.get("a.flo")).toEqual([]);
    expect([...catalogs.get("a.flo")!.keys()]).toEqual(["z", "y", "x"]);
  });

  it("does not see entities of documents it does not reach; E030 says where they are", () => {
    const { diagnostics } = link({
      "catalog.flo": "entity db\nflow f {\n  db -> ui\n}\n",
      "login.flo": login,
    });
    expect(diagnostics.get("catalog.flo")!.map((d) => [d.code, d.message])).toEqual([
      ["E030", "la entidad 'ui' está declarada en 'login.flo', que este documento no alcanza; añade un 'use' a ese archivo"],
    ]);
  });

  it("reports E032 at the path of a use that names a missing document or leaves the root", () => {
    const { diagnostics } = link({ "a.flo": 'use "./nope.flo"\nuse "../fuera.flo"\nentity a\n' });
    expect(codes(diagnostics.get("a.flo"))).toEqual([
      ["E032", 1, 5],
      ["E032", 2, 5],
    ]);
    expect(diagnostics.get("a.flo")![0].message).toBe("el documento './nope.flo' no existe en el workspace");
  });

  it("cuts cycles, self-use and repeated use without diagnostics or duplicates", () => {
    const { catalogs, uses, diagnostics } = link({
      "a.flo": 'use "./b.flo"\nuse "./b.flo"\nuse "./a.flo"\nentity x\n',
      "b.flo": 'use "./a.flo"\nentity y\n',
    });
    expect(diagnostics.get("a.flo")).toEqual([]);
    expect(diagnostics.get("b.flo")).toEqual([]);
    expect(uses.get("a.flo")).toEqual(["b.flo", "a.flo"]);
    expect([...catalogs.get("a.flo")!.keys()]).toEqual(["y", "x"]);
    expect([...catalogs.get("b.flo")!.keys()]).toEqual(["x", "y"]);
  });

  it("keeps the declaration of the first document by uri and reports E031 in the other, naming where the first is", () => {
    const { entities, diagnostics } = link({ "b.flo": "entity x [B]\n", "a.flo": "entity x [A]\n" });
    expect(entities.get("x")?.label).toBe("A");
    expect(diagnostics.get("a.flo")).toEqual([]);
    expect(diagnostics.get("b.flo")!.map((d) => [d.code, d.message])).toEqual([
      ["E031", "la entidad 'x' ya fue declarada en 'a.flo'"],
    ]);
  });

  it("gives the same result whatever the input order", () => {
    const files = {
      "catalog.flo": catalog + "entity ui\n",
      "login.flo": login,
      "admin.flo": 'use "./catalog.flo"\nflow g {\n  api -> ghost\n}\n',
    };
    const forward = link(files);
    const backward = link(Object.fromEntries(Object.entries(files).reverse()));
    expect([...backward.entities.keys()]).toEqual([...forward.entities.keys()]);
    expect([...backward.diagnostics.entries()].sort()).toEqual([...forward.diagnostics.entries()].sort());
    expect(forward.entities.get("ui")?.uri).toBe("catalog.flo");
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/resolver.test.ts`
Expected: FAIL (`linkDocuments` no existe).

- [ ] **Step 3: Implementar**

`packages/core/src/diagnostics.ts` — agregar:

```ts
/** Ordena in place por (línea, columna) y devuelve el mismo array. */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column
  );
}
```

Reemplazar todo `packages/core/src/workspace/resolver.ts` por:

```ts
import { diagnosticAt, sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, EntityDecl, EntityId, ParsedDocument } from "../ast.js";
import { resolveUse } from "./uri.js";

export type Catalog = Map<EntityId, EntityDecl>;

export interface LinkedDocuments {
  /** Catálogo global: la declaración ganadora de cada id (los ids son únicos en el workspace). */
  entities: Catalog;
  /** Por documento, el catálogo alcanzable vía `use`: dependencias primero, el documento al final. */
  catalogs: Map<DocumentUri, Catalog>;
  /** Por documento, las uris que resuelven sus `use`, en orden de aparición y sin repetir. */
  uses: Map<DocumentUri, DocumentUri[]>;
  /** Por documento, diagnósticos de resolución (E030–E033), ordenados por posición. */
  diagnostics: Map<DocumentUri, Diagnostic[]>;
}

/** Orden determinista de documentos (decisión #24): por uri, sin importar el orden de carga. */
export function byUri(a: { uri: DocumentUri }, b: { uri: DocumentUri }): number {
  return a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0;
}

/**
 * Resolución de un conjunto de documentos: arma el catálogo global (la
 * primera declaración de cada id gana, decisión #2), resuelve los `use`
 * (E032), calcula el catálogo alcanzable de cada documento, rellena todos
 * los `Ref.target` contra ese catálogo (E030) y reporta bloques repetidos
 * dentro de un documento (E033).
 */
export function linkDocuments(input: ParsedDocument[]): LinkedDocuments {
  const documents = [...input].sort(byUri);
  const documentsByUri = new Map(documents.map((d) => [d.uri, d]));
  const diagnostics = new Map<DocumentUri, Diagnostic[]>(documents.map((d) => [d.uri, []]));

  const entities: Catalog = new Map();
  for (const document of documents) {
    for (const entity of document.entities) {
      const first = entities.get(entity.id);
      if (first === undefined) {
        entities.set(entity.id, entity);
        continue;
      }
      const where = first.uri === entity.uri ? "" : ` en '${first.uri}'`;
      diagnostics
        .get(document.uri)!
        .push(diagnosticAt("E031", `la entidad '${entity.id}' ya fue declarada${where}`, entity.nameRange));
    }
  }

  const uses = new Map<DocumentUri, DocumentUri[]>();
  for (const document of documents) {
    const targets: DocumentUri[] = [];
    for (const use of document.uses) {
      const target = resolveUse(document.uri, use.path);
      if (target === null || !documentsByUri.has(target)) {
        diagnostics
          .get(document.uri)!
          .push(diagnosticAt("E032", `el documento '${use.path}' no existe en el workspace`, use.pathRange));
      } else if (!targets.includes(target)) {
        targets.push(target);
      }
    }
    uses.set(document.uri, targets);
  }

  const catalogs = new Map<DocumentUri, Catalog>();
  for (const document of documents) {
    const catalog: Catalog = new Map();
    for (const uri of reachable(document.uri, uses)) {
      for (const entity of documentsByUri.get(uri)!.entities) {
        if (entities.get(entity.id) === entity) catalog.set(entity.id, entity);
      }
    }
    catalogs.set(document.uri, catalog);
    resolveBlocks(document, catalog, entities, diagnostics.get(document.uri)!);
  }

  for (const list of diagnostics.values()) sortDiagnostics(list);
  return { entities, catalogs, uses, diagnostics };
}

/** Post-orden DFS sobre `use`: dependencias primero, `root` al final. Los ciclos se cortan por visitado. */
function reachable(root: DocumentUri, uses: Map<DocumentUri, DocumentUri[]>): DocumentUri[] {
  const order: DocumentUri[] = [];
  const visited = new Set<DocumentUri>();
  const visit = (uri: DocumentUri): void => {
    if (visited.has(uri)) return;
    visited.add(uri);
    for (const dependency of uses.get(uri) ?? []) visit(dependency);
    order.push(uri);
  };
  visit(root);
  return order;
}

function resolveBlocks(document: ParsedDocument, catalog: Catalog, entities: Catalog, diagnostics: Diagnostic[]): void {
  const blockNames = new Set<string>();
  for (const block of document.blocks) {
    if (blockNames.has(block.name)) {
      diagnostics.push(diagnosticAt("E033", `el bloque '${block.name}' ya fue declarado`, block.nameRange));
    }
    blockNames.add(block.name);

    for (const edge of block.edges) {
      for (const ref of [edge.from, edge.to]) {
        ref.target = catalog.has(ref.name) ? ref.name : null;
        if (ref.target === null) diagnostics.push(diagnosticAt("E030", unresolvedMessage(ref.name, entities), ref.range));
      }
    }
  }
}

function unresolvedMessage(name: string, entities: Catalog): string {
  const elsewhere = entities.get(name);
  return elsewhere
    ? `la entidad '${name}' está declarada en '${elsewhere.uri}', que este documento no alcanza; añade un 'use' a ese archivo`
    : `la entidad '${name}' no está declarada; añade 'entity ${name}'`;
}
```

`packages/core/src/parser/index.ts` — reemplazar por:

```ts
import { parseDocument } from "./document.js";
import { linkDocuments, type Catalog } from "../workspace/resolver.js";
import { sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";

export interface ParseResult {
  document: ParsedDocument;
  catalog: Catalog;
  diagnostics: Diagnostic[];
}

/** Un documento suelto: sus `use` no encuentran nada (E032) y solo ve su propio catálogo. */
export function parse(source: string, uri: DocumentUri = ""): ParseResult {
  const parsed = parseDocument(source, uri);
  const linked = linkDocuments([parsed.document]);
  return {
    document: parsed.document,
    catalog: linked.catalogs.get(uri)!,
    diagnostics: sortDiagnostics([...parsed.diagnostics, ...linked.diagnostics.get(uri)!]),
  };
}
```

- [ ] **Step 4: Correr la suite del core**

Run: `pnpm --filter @flo/core exec vitest run && pnpm --filter @flo/core typecheck`
Expected: PASS, incluidos `render/reference-diagrams.test.ts` y sus snapshots **sin cambios**. Si `git status` muestra `__snapshots__` modificado, es un bug: no regenerar.

- [ ] **Step 5: GRAMMAR.md y §11**

En `packages/core/GRAMMAR.md`, reemplazar el bullet que empieza con "Un bloque solo contiene aristas; sus nodos se derivan..." por:

```markdown
- Un bloque solo contiene aristas; sus nodos se derivan de las entidades
  que referencia. Los ids de entidad son únicos en todo el workspace: la
  primera declaración de un id gana (documentos ordenados por uri, dentro
  de cada documento en orden de fuente) y las siguientes se reportan con
  `E031`. Cada documento ve un **catálogo alcanzable**: sus propias
  entidades más las de los documentos que nombra con `use`,
  transitivamente (los ciclos se cortan, no son error; repetir un `use` no
  hace nada). Toda referencia debe resolver a una entidad de ese catálogo,
  declarada antes o después en el archivo (`E030` si no resuelve; si la
  entidad existe en un documento no alcanzable, el mensaje lo nombra). Una
  ruta de `use` es relativa al documento que la declara (`/` inicial = la
  raíz del workspace); si sale de la raíz o no nombra un documento del
  workspace es `E032`. Los nombres de bloque son únicos dentro del
  documento (`E033` para los repetidos).
```

En el bullet "Orden de nodos/columnas en el render", cambiar "el orden de declaración de las entidades en el catálogo" por "el orden del catálogo alcanzable (primero las entidades de los documentos usados, en post-orden de `use`; al final las del propio documento, en orden de declaración)".

Tabla: la fila `E031` pasa a `entidad declarada dos veces (en el mismo documento o en otro)`; agregar después de `E031`:
`| E032 | resolver | \`use\` apunta a un documento inexistente o fuera de la raíz |`

Agregar a la tabla de "Decisiones de la Fase D" del spec (creada en la task 1):

```markdown
| 24 | 2026-09-28 | **Namespace y orden del workspace.** Los ids de entidad son globales al workspace: `E031` también entre documentos que no se usan entre sí. "Primera declaración" (#2) = documentos ordenados por uri (comparación de strings), luego orden de fuente; así el ganador no depende del orden de carga. El catálogo alcanzable de un documento es el post-orden DFS de sus `use` (dependencias primero, él al final) filtrado a las declaraciones ganadoras; es el orden de columnas de #1. | resolver (D), layout, mapa agregado (F), `.md` (K1) |
```

- [ ] **Step 6: Commit**

```bash
git add packages/core docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "feat(core): resolución multi-documento con 'use' (E031 entre documentos, E032)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Índice de referencias cruzadas (`XRefIndex`)

**Files:**
- Create: `packages/core/src/workspace/xref.ts`
- Modify: `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` (fila #25)
- Test: `packages/core/src/workspace/xref.test.ts`

**Interfaces:**
- Consumes: `linkDocuments`, `byUri`, `Catalog` (task 3). Precondición: los `Ref.target` ya están rellenados por `linkDocuments`.
- Produces:
  ```ts
  export type BlockId = string; // `${uri}#${nombre}`
  export interface Location { uri: DocumentUri; range: Range }
  export function blockId(uri: DocumentUri, name: string): BlockId;
  export class XRefIndex {
    constructor(documents: ParsedDocument[], entities: Catalog);
    definitionOf(id: EntityId): Location | null;   // nameRange de la declaración ganadora
    referencesTo(id: EntityId): Location[];        // toda Ref resuelta a id; docs por uri, luego orden de fuente
    flowsUsing(id: EntityId): BlockId[];           // bloques (flow y sequence) que la referencian
    entitiesIn(block: BlockId): EntityId[];        // entidades resueltas del bloque, en orden del catálogo global
    neighbors(id: EntityId): EntityId[];           // adyacentes por alguna arista de cualquier bloque, sin sí misma, en orden del catálogo global
  }
  ```

Reglas: un bloque con nombre repetido en su documento (`E033`) no entra en
`flowsUsing`/`entitiesIn` (gana el primero), pero sus referencias sí
cuentan en `referencesTo` y sus aristas en `neighbors` (renombrar tiene que
alcanzarlas).

- [ ] **Step 1: Escribir el test que falla**

`packages/core/src/workspace/xref.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseDocument } from "../parser/document.js";
import { linkDocuments } from "./resolver.js";
import { XRefIndex, blockId } from "./xref.js";

function index(files: Record<string, string>): XRefIndex {
  const documents = Object.entries(files).map(([uri, source]) => parseDocument(source, uri).document);
  const { entities } = linkDocuments(documents);
  return new XRefIndex(documents, entities);
}

const files = {
  "catalog.flo": "entity api\nentity db\nentity cache\n",
  "login.flo": [
    'use "./catalog.flo"',
    "flow login {",
    "  api -> db",
    "  db -> api",
    "}",
    "sequence detalle {",
    "  api -> cache : get",
    "  api -> ghost : x",
    "}",
    "",
  ].join("\n"),
  "admin.flo": 'use "./catalog.flo"\nflow admin {\n  api -> db\n}\n',
};

describe("XRefIndex", () => {
  const xref = index(files);

  it("builds block ids as uri#name", () => {
    expect(blockId("dir/a.flo", "login")).toBe("dir/a.flo#login");
  });

  it("finds the definition of an entity, or null", () => {
    expect(xref.definitionOf("db")).toEqual({
      uri: "catalog.flo",
      range: { start: { line: 2, column: 8 }, end: { line: 2, column: 10 } },
    });
    expect(xref.definitionOf("ghost")).toBeNull();
  });

  it("lists every resolved reference, documents by uri then source order", () => {
    expect(xref.referencesTo("db").map((l) => [l.uri, l.range.start.line, l.range.start.column])).toEqual([
      ["admin.flo", 3, 10],
      ["login.flo", 3, 10],
      ["login.flo", 4, 3],
    ]);
    expect(xref.referencesTo("ghost")).toEqual([]);
  });

  it("lists the blocks that use an entity, flow and sequence alike", () => {
    expect(xref.flowsUsing("api")).toEqual(["admin.flo#admin", "login.flo#login", "login.flo#detalle"]);
    expect(xref.flowsUsing("cache")).toEqual(["login.flo#detalle"]);
    expect(xref.flowsUsing("nadie")).toEqual([]);
  });

  it("lists the resolved entities of a block in catalog order", () => {
    expect(xref.entitiesIn("login.flo#detalle")).toEqual(["api", "cache"]);
    expect(xref.entitiesIn("login.flo#login")).toEqual(["api", "db"]);
    expect(xref.entitiesIn("nope.flo#x")).toEqual([]);
  });

  it("lists neighbors across all blocks, in catalog order, without the entity itself", () => {
    expect(xref.neighbors("api")).toEqual(["db", "cache"]);
    expect(xref.neighbors("cache")).toEqual(["api"]);
    expect(index({ "a.flo": "entity a\nflow f {\n  a -> a\n}\n" }).neighbors("a")).toEqual([]);
  });

  it("keeps the first of two same-named blocks for block queries, but counts every reference", () => {
    const dup = index({ "dup.flo": "entity a\nentity b\nflow f {\n  a -> a\n}\nflow f {\n  b -> a\n}\n" });
    expect(dup.entitiesIn("dup.flo#f")).toEqual(["a"]);
    expect(dup.flowsUsing("b")).toEqual([]);
    expect(dup.referencesTo("b")).toHaveLength(1);
    expect(dup.neighbors("a")).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/xref.test.ts`
Expected: FAIL (no existe `./xref.js`).

- [ ] **Step 3: Implementar**

`packages/core/src/workspace/xref.ts`:

```ts
import type { DocumentUri, EntityId, ParsedDocument, Range } from "../ast.js";
import { byUri, type Catalog } from "./resolver.js";

/** Identidad de un bloque en el workspace: `uri#nombre` (decisión #25). */
export type BlockId = string;

export interface Location {
  uri: DocumentUri;
  range: Range;
}

export function blockId(uri: DocumentUri, name: string): BlockId {
  return `${uri}#${name}`;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Índice de referencias cruzadas del workspace (spec §6.2). Se construye a
 * partir de referencias ya resueltas por `linkDocuments`; las no resueltas
 * (E030) no entran. Inmutable: cada `link()` construye uno nuevo.
 */
export class XRefIndex {
  private readonly references = new Map<EntityId, Location[]>();
  private readonly blocksByEntity = new Map<EntityId, BlockId[]>();
  private readonly entitiesByBlock = new Map<BlockId, EntityId[]>();
  private readonly adjacent = new Map<EntityId, Set<EntityId>>();

  constructor(
    documents: ParsedDocument[],
    private readonly entities: Catalog
  ) {
    for (const document of [...documents].sort(byUri)) {
      const seen = new Set<string>();
      for (const block of document.blocks) {
        const inBlock = new Set<EntityId>();
        for (const edge of block.edges) {
          for (const ref of [edge.from, edge.to]) {
            if (ref.target === null) continue;
            push(this.references, ref.target, { uri: document.uri, range: ref.range });
            inBlock.add(ref.target);
          }
          const { target: from } = edge.from;
          const { target: to } = edge.to;
          if (from !== null && to !== null && from !== to) {
            this.adjacentOf(from).add(to);
            this.adjacentOf(to).add(from);
          }
        }

        if (seen.has(block.name)) continue; // E033: para consultas de bloque gana el primero
        seen.add(block.name);
        const id = blockId(document.uri, block.name);
        this.entitiesByBlock.set(id, this.inCatalogOrder(inBlock));
        for (const entity of inBlock) push(this.blocksByEntity, entity, id);
      }
    }
  }

  definitionOf(id: EntityId): Location | null {
    const entity = this.entities.get(id);
    return entity ? { uri: entity.uri, range: entity.nameRange } : null;
  }

  referencesTo(id: EntityId): Location[] {
    return this.references.get(id) ?? [];
  }

  flowsUsing(id: EntityId): BlockId[] {
    return this.blocksByEntity.get(id) ?? [];
  }

  entitiesIn(block: BlockId): EntityId[] {
    return this.entitiesByBlock.get(block) ?? [];
  }

  neighbors(id: EntityId): EntityId[] {
    return this.inCatalogOrder(this.adjacent.get(id) ?? new Set());
  }

  private adjacentOf(id: EntityId): Set<EntityId> {
    let set = this.adjacent.get(id);
    if (!set) this.adjacent.set(id, (set = new Set()));
    return set;
  }

  // ponytail: recorre el catálogo entero por consulta; indexar posiciones si el workspace crece a miles de entidades
  private inCatalogOrder(ids: Set<EntityId>): EntityId[] {
    return [...this.entities.keys()].filter((id) => ids.has(id));
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/xref.test.ts && pnpm --filter @flo/core typecheck`
Expected: PASS.

- [ ] **Step 5: §11**

Agregar a la tabla de "Decisiones de la Fase D" del spec:

```markdown
| 25 | 2026-09-28 | **Identidad de bloque = `uri#nombre`** (`BlockId`). Los nombres de bloque solo son únicos dentro de su documento: `E033` es por documento (enmienda §7, que decía "en el workspace"). Con un nombre repetido, las consultas por bloque del índice toman el primero; las referencias y aristas de todos cuentan. Es la misma forma que usa `relations.target` en K1 (`auth.flo#acceso`). | xref (D), atributos `data-flo-block` (E), explorador (F), `.md` (K1) |
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/workspace/xref.ts packages/core/src/workspace/xref.test.ts docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "feat(core): índice de referencias cruzadas del workspace

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `Workspace`, `parse()` sobre él y aristas por entidad resuelta

**Files:**
- Create: `packages/core/src/workspace/workspace.ts`
- Modify: `packages/core/src/parser/index.ts`
- Modify: `packages/core/src/layout/nodes.ts`, `packages/core/src/layout/flowchart.ts:60,74-77`, `packages/core/src/layout/sequence.ts:43-44`
- Test: `packages/core/src/workspace/workspace.test.ts`

**Interfaces:**
- Consumes: `parseDocument` (task 1), `linkDocuments`/`byUri`/`Catalog` (task 3), `sortDiagnostics` (task 3), `XRefIndex` (task 4).
- Produces:
  ```ts
  export interface LinkedDocument { document: ParsedDocument; catalog: Catalog }
  export interface LinkResult {
    entities: Catalog;                              // catálogo global
    documents: Map<DocumentUri, LinkedDocument>;    // en orden de uri
    diagnostics: Map<DocumentUri, Diagnostic[]>;    // lexer + parser + resolución, ordenados por posición
    xref: XRefIndex;
  }
  export class Workspace {
    setDocument(uri: DocumentUri, source: string): void; // parsea y reemplaza
    removeDocument(uri: DocumentUri): void;
    link(): LinkResult;                                  // recalcula todo (sin incremental, spec §9)
  }
  // layout/nodes.ts
  export function nodeId(ref: Ref): string; // ref.target ?? ref.name (decisión #15)
  ```

- [ ] **Step 1: Escribir el test que falla**

`packages/core/src/workspace/workspace.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Workspace } from "./workspace.js";
import type { Diagnostic } from "../diagnostics.js";

const catalog = "entity usuario (Usuario)\nentity api [API Gateway]\nentity db [Base de datos]\n";
const login = [
  'use "./catalogo.flo"',
  "entity pantalla [Login]",
  'flow acceso "Inicio de sesión" {',
  "  usuario -> pantalla",
  "  pantalla -> api : POST /login",
  "  api -> db",
  "}",
  "",
].join("\n");
const admin = 'use "../catalogo.flo"\nsequence alta {\n  usuario -> api : crear\n  api -> db : INSERT\n}\n';

function workspace(files: Record<string, string>): Workspace {
  const ws = new Workspace();
  for (const [uri, source] of Object.entries(files)) ws.setDocument(uri, source);
  return ws;
}

function codes(diagnostics: Diagnostic[] | undefined) {
  return (diagnostics ?? []).map((d) => [d.code, d.range.start.line, d.range.start.column]);
}

describe("Workspace", () => {
  const files = { "catalogo.flo": catalog, "login.flo": login, "admin/alta.flo": admin };

  it("links a set of documents that share a catalog", () => {
    const result = workspace(files).link();
    for (const list of result.diagnostics.values()) expect(list).toEqual([]);
    expect([...result.documents.keys()]).toEqual(["admin/alta.flo", "catalogo.flo", "login.flo"]);
    expect([...result.documents.get("login.flo")!.catalog.keys()]).toEqual(["usuario", "api", "db", "pantalla"]);
    expect([...result.documents.get("admin/alta.flo")!.catalog.keys()]).toEqual(["usuario", "api", "db"]);
    expect(result.xref.flowsUsing("db")).toEqual(["admin/alta.flo#alta", "login.flo#acceso"]);
    expect(result.xref.definitionOf("api")?.uri).toBe("catalogo.flo");
    expect(result.xref.referencesTo("usuario")).toHaveLength(2);
  });

  it("does not depend on the order documents were added", () => {
    const forward = workspace(files).link();
    const backward = workspace(Object.fromEntries(Object.entries(files).reverse())).link();
    expect([...backward.documents.keys()]).toEqual([...forward.documents.keys()]);
    expect([...backward.entities.keys()]).toEqual([...forward.entities.keys()]);
    expect([...backward.diagnostics.entries()]).toEqual([...forward.diagnostics.entries()]);
  });

  it("merges lexer, parser and resolver diagnostics per document, sorted by position", () => {
    const result = workspace({ "a.flo": 'use "./nope.flo"\nflow f {\n  a -> ghost\n  start ->\n}\n@\nentity a\n' }).link();
    expect(codes(result.diagnostics.get("a.flo"))).toEqual([
      ["E032", 1, 5],
      ["E030", 3, 8],
      ["E014", 4, 11],
      ["E002", 6, 1],
    ]);
  });

  it("reports E032 and E030 in the next link after a used document is removed", () => {
    const ws = workspace(files);
    ws.removeDocument("catalogo.flo");
    const result = ws.link();
    expect(result.documents.has("catalogo.flo")).toBe(false);
    expect(codes(result.diagnostics.get("login.flo"))).toEqual([
      ["E032", 1, 5],
      ["E030", 4, 3],
      ["E030", 5, 15],
      ["E030", 6, 3],
      ["E030", 6, 10],
    ]);
    expect(result.xref.definitionOf("db")).toBeNull();
  });

  it("re-links from scratch after setDocument replaces a document: stale targets are cleared", () => {
    const ws = workspace(files);
    const before = ws.link().documents.get("login.flo")!.document.blocks[0].edges[2];
    expect(before.to.target).toBe("db");

    ws.setDocument("catalogo.flo", "entity usuario (Usuario)\nentity api [API Gateway]\n");
    const result = ws.link();
    const after = result.documents.get("login.flo")!.document.blocks[0].edges[2];
    expect(after.to.target).toBeNull();
    expect(result.diagnostics.get("login.flo")!.map((d) => d.code)).toEqual(["E030"]);
    expect(result.xref.flowsUsing("db")).toEqual([]);
  });
});
```

Nota sobre el test de "removed": en `login`, línea 4 es `  usuario -> pantalla` (`usuario` col 3), línea 5 `  pantalla -> api : POST /login` (`api` col 15), línea 6 `  api -> db` (`api` col 3, `db` col 10). `pantalla` es local y resuelve.

Nota sobre el test de "merges": `  start ->` da `E014` en la posición del fin de línea (col 11), igual que el test existente de `parser/index.test.ts`; si el lexer lo ancla en otra columna, ajustar **solo** esa columna al valor que reporte el lexer, sin tocar el código.

- [ ] **Step 2: Verificar que falla**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/workspace.test.ts`
Expected: FAIL (no existe `./workspace.js`).

- [ ] **Step 3: Implementar el `Workspace`**

`packages/core/src/workspace/workspace.ts`:

```ts
import { parseDocument } from "../parser/document.js";
import { sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";
import { byUri, linkDocuments, type Catalog } from "./resolver.js";
import { XRefIndex } from "./xref.js";

export interface LinkedDocument {
  document: ParsedDocument;
  /** Catálogo alcanzable del documento vía `use`. */
  catalog: Catalog;
}

export interface LinkResult {
  /** Catálogo global: la declaración ganadora de cada id. */
  entities: Catalog;
  /** En orden de uri. */
  documents: Map<DocumentUri, LinkedDocument>;
  /** Lexer, parser y resolución, por documento y ordenados por posición. */
  diagnostics: Map<DocumentUri, Diagnostic[]>;
  xref: XRefIndex;
}

/**
 * Conjunto de documentos en memoria (spec §6). `setDocument` parsea una vez;
 * `link()` resuelve todo desde cero cada vez (sin linking incremental,
 * spec §9) y reescribe todos los `Ref.target`.
 */
export class Workspace {
  private readonly parsed = new Map<DocumentUri, { document: ParsedDocument; diagnostics: Diagnostic[] }>();

  setDocument(uri: DocumentUri, source: string): void {
    this.parsed.set(uri, parseDocument(source, uri));
  }

  removeDocument(uri: DocumentUri): void {
    this.parsed.delete(uri);
  }

  link(): LinkResult {
    const parsed = [...this.parsed.values()].sort((a, b) => byUri(a.document, b.document));
    const linked = linkDocuments(parsed.map((p) => p.document));

    const documents = new Map<DocumentUri, LinkedDocument>();
    const diagnostics = new Map<DocumentUri, Diagnostic[]>();
    for (const { document, diagnostics: parseDiagnostics } of parsed) {
      documents.set(document.uri, { document, catalog: linked.catalogs.get(document.uri)! });
      diagnostics.set(document.uri, sortDiagnostics([...parseDiagnostics, ...linked.diagnostics.get(document.uri)!]));
    }

    return {
      entities: linked.entities,
      documents,
      diagnostics,
      xref: new XRefIndex(parsed.map((p) => p.document), linked.entities),
    };
  }
}
```

- [ ] **Step 4: `parse()` sobre el `Workspace`**

`packages/core/src/parser/index.ts` — reemplazar por:

```ts
import { Workspace } from "../workspace/workspace.js";
import type { Catalog } from "../workspace/resolver.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";
import type { Diagnostic } from "../diagnostics.js";

export interface ParseResult {
  document: ParsedDocument;
  catalog: Catalog;
  diagnostics: Diagnostic[];
}

/** Un documento suelto, como un workspace de uno: sus `use` no encuentran nada (E032). */
export function parse(source: string, uri: DocumentUri = ""): ParseResult {
  const workspace = new Workspace();
  workspace.setDocument(uri, source);
  const result = workspace.link();
  const { document, catalog } = result.documents.get(uri)!;
  return { document, catalog, diagnostics: result.diagnostics.get(uri)! };
}
```

- [ ] **Step 5: Aristas por entidad resuelta (decisión #15)**

`packages/core/src/layout/nodes.ts` — cambiar el import a `import type { DiagramBlock, NodeShape, Ref } from "../ast.js";` y agregar:

```ts
/**
 * Id de nodo de un extremo de arista: la entidad resuelta, o el nombre
 * escrito si no resolvió (placeholder). Decisión #15.
 */
export function nodeId(ref: Ref): string {
  return ref.target ?? ref.name;
}
```

`packages/core/src/layout/flowchart.ts` — importar `nodeId` junto a `blockNodes` y reemplazar los usos de `edge.from.name` / `edge.to.name` (líneas 60 y 74-77) por `nodeId(edge.from)` / `nodeId(edge.to)`:

```ts
  for (const edge of block.edges) {
    graph.setEdge(nodeId(edge.from), nodeId(edge.to));
  }
```

```ts
    edges: block.edges.map((edge) => ({
      from: nodeId(edge.from),
      to: nodeId(edge.to),
      label: edge.label,
      points: graph.edge(nodeId(edge.from), nodeId(edge.to)).points,
    })),
```

`packages/core/src/layout/sequence.ts` — importar `nodeId` junto a `blockNodes` y en `messages` usar `from: nodeId(edge.from), to: nodeId(edge.to),`.

Hoy `ref.target === ref.name` siempre que resuelve (no hay alias), así que el SVG no cambia.

- [ ] **Step 6: Verificación completa**

Run: `pnpm --filter @flo/core exec vitest run && pnpm --filter @flo/core typecheck`
Expected: PASS; `git status` no muestra cambios en `render/__snapshots__/`.

Run (desde la raíz del repo): `pnpm --filter @flo/core build && pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: todo PASS, incluida la suite de `@flo/web` sin cambios en su código.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): Workspace multi-documento con link() e índice de referencias

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
