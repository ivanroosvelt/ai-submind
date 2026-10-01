# .flo — revisión general Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-10-01 (`d342559`..`44bb40a`).

- Once tasks; solo la task 1 tuvo una ronda de fixes (rango del id antes de una letra no ASCII, `d2ad77b`).
- Revisión final (whole-branch): lista con fixes, aplicados en `44bb40a`:
  - el pan capturaba el puntero en `pointerdown` y le robaba el click a los nodos del grafo; ahora captura recién al pasar el umbral de arrastre;
  - Ctrl/Cmd+S ignora el auto-repeat y acepta `code === "KeyS"` (teclados no latinos);
  - el test de `exportSvg` vuelve a verificar el tipo del blob.
- **Queda:**
  - checks manuales en navegador de las tasks 8 (PNG 2× y nombre), 10 (pan y click en nodos, touch) y 11 (F2/Escape/Enter, diálogos);
  - `Cafés` da `E002` y además un id `s` suelto (el lookahead consume una sola letra);
  - `flo-highlight.ts` no quita un BOM pegado a mano;
  - con `code === "KeyS"`, en Dvorak la tecla física S también guarda.

**Goal:** Cerrar lo que encontró la revisión general del 2026-09-30:
- tres bugs: el guardado que pisa archivos, el BOM en `.flo` y el auto-mensaje invisible;
- mejoras de uso: atajo, aviso al salir, nombres de archivo, PNG nítido, labels largos, mensaje de ids, pan táctil, diálogos y tuteo;
- limpieza de ingeniería: ids de marcador, duplicados, severidad muerta y menores.

**Architecture:** Once tasks independientes, en orden core → mcp → web:
- **Core (tasks 1–4):** cambia la API pública (`severity` sale y entran helpers nuevos). Cada una de estas tasks termina con `pnpm --filter @flo/core build`.
- **Web (tasks 6–11):** cambios locales a `packages/web/src/`.
  - Las tasks 6, 7, 8 y 11 tocan `app.ts`; se ejecutan en orden.
  - La task 11 vuelve asíncronos varios métodos de `App`, por eso va última.

**Tech Stack:** TypeScript 5 (strict, NodeNext), dagre 0.8, CodeMirror 6, Vitest 2 + jsdom 25, MCP SDK + zod 4.

**Spec:** `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` §11, decisiones nuevas **#51–#60** (escritas junto con este plan, sección "Decisiones de la revisión general").

| Hallazgo de la revisión | Task | Decisión |
|---|---|---|
| BOM en `.flo` (MCP) · mensaje para `entity Café` | 1 | #51 |
| auto-mensaje `a -> a` invisible · labels largos en `sequence` | 2 | #52 |
| severidad `warning` que nadie emite | 3 | #53 |
| duplicados (`parseBlockId`, `push`, `GRAPH_OPTIONS`/`finiteOrZero`, `IGNORED`, `MEMORY_TYPES`) · comparador de `renameEntity` | 4 | #54 |
| versión MCP escrita a mano · `<meta viewport>` · `unescape` · fallback de abrir que no rechaza | 5 | — |
| **guardar pisa otro archivo (ejemplo multiarchivo)** · `suggestedName` | 6 | #55 |
| Ctrl/Cmd+S · `beforeunload` | 7 | #56 |
| PNG 1× borroso · nombre `diagrama.*` fijo | 8 | #57 |
| ids `flo-arrow` repetidos en la página | 9 | #58 |
| pan solo con mouse | 10 | #59 |
| `prompt`/`alert`/`confirm` · voseo/tuteo mezclados | 11 | #60 |

Fuera de alcance (decidido): el tamaño del bundle (640 KB), que no se toca hasta que crezca; y #43, por el que reemplazar un ejemplo o un documento sin carpeta no pregunta.

**Precondición:** los cambios del working tree que convierten los ejemplos en workspaces multiarchivo (`examples.ts`, `app.ts`, `workspace.ts`, `explorer.ts`, `examples/04-conocimiento/`) tienen que estar commiteados antes de empezar. La task 6 arregla un bug que esos cambios destapan.

## Global Constraints

- **Sin dependencias nuevas.**
- **Snapshots de SVG** (`packages/core/src/render/__snapshots__/`):
  - Ninguno cambia y ninguno se regenera (`vitest -u` prohibido).
  - Las tasks 2 y 9 están diseñadas para dejarlos byte a byte iguales. Si un snapshot falla, es un bug de la task.
- **Códigos de diagnóstico:** ninguno nuevo. `E002` cambia solo su mensaje para letras no ASCII (#51). La tabla de `packages/core/GRAMMAR.md` se actualiza en la task 1.
- **Imports relativos con sufijo `.js`** en `packages/*/src/`.
- **`@flo/web` y `@flo/mcp` consumen `@flo/core` por `dist/`.** Las tasks 1–4 terminan con `pnpm --filter @flo/core build` antes de correr tests de web o mcp.
- **Idioma:**
  - comentarios y mensajes en español;
  - **tuteo** en todo texto al usuario (#60);
  - nombres de test en inglés.
- **Commits:** uno por task, con el prefijo indicado en cada una y la línea final `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Verificación final (desde la raíz):** `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

## Review Focus

1. **Un `.flo` con BOM y un error en la línea 1:** la columna del diagnóstico es la que ve el editor (el BOM no cuenta). Test en la task 1.
2. **Un auto-mensaje como último mensaje del bloque:** el lazo (y + 20) queda dentro del SVG y por encima del final de la lifeline. Test en la task 2.
3. **Workspace sin carpeta con dos archivos, "Guardar" en cada uno:** cada archivo va a su propio handle y ninguno se escribe sobre el otro. Test en la task 6.
4. **Escape en un diálogo:** se trata como "Cancelar" (`null`/`false`) y la acción no ocurre, por ejemplo al renombrar. Tests en la task 11.
5. **Ctrl+Alt+S, o un atajo sin Ctrl/Cmd:** no guarda y no bloquea el comportamiento normal del navegador (AltGr+S escribe caracteres en algunos teclados). Test en la task 7.

---

### Task 1: entrada de usuarios — BOM en `.flo` y letras no ASCII (#51)

**Files:**
- Modify: `packages/core/src/parser/document.ts:47`
- Modify: `packages/core/src/lexer.ts:122-125`
- Modify: `packages/core/GRAMMAR.md` (fila `E002` de la tabla)
- Test: `packages/core/src/lexer.test.ts`, `packages/core/src/parser/document.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: el mensaje de `E002` para una letra no ASCII es exactamente `` `carácter inesperado '${ch}': los ids solo admiten letras ASCII, dígitos y '_'` ``.

- [ ] **Step 1: Write the failing tests**

En `packages/core/src/lexer.test.ts`, dentro del `describe` del lexer, junto al test `"reports E002 for an unexpected character and keeps lexing"`:

```ts
  it("explains the ASCII rule when E002 is a non-ASCII letter", () => {
    const lexer = new Lexer("Café\n");
    expect(lexer.next()).toMatchObject({ kind: "IDENT", value: "Caf" });
    expect(lexer.diagnostics.map((d) => d.message)).toEqual([
      "carácter inesperado 'é': los ids solo admiten letras ASCII, dígitos y '_'",
    ]);
  });
```

En `packages/core/src/parser/document.test.ts`, en el `describe` de `parseDocument` (importar `parseDocument` si el archivo no lo hace todavía):

```ts
  it("ignores a leading BOM, keeping the editor's columns on line 1", () => {
    const { document, diagnostics } = parseDocument("﻿entity a\nflow f {\n  a -> a\n}\n", "x.flo");
    expect(diagnostics).toEqual([]);
    expect(document.entities[0].nameRange.start).toEqual({ line: 1, column: 8 });
  });

  it("reports a line-1 error at the column the editor shows when there is a BOM", () => {
    const { diagnostics } = parseDocument("﻿nope\n", "x.flo");
    expect(diagnostics[0].range.start).toEqual({ line: 1, column: 1 });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/core exec vitest run src/lexer.test.ts src/parser/document.test.ts`
Expected: FAIL. El lexer da `"carácter inesperado 'é'"` y el parser da `E002 carácter inesperado '﻿'`.

- [ ] **Step 3: Implement**

`packages/core/src/parser/document.ts`, en `parseDocument`:

```ts
  // Editores de Windows escriben BOM al guardar (#51, como en un .md): se
  // descarta, y las columnas de la línea 1 son las que ve el editor.
  const lexer = new Lexer(source.replace(/^﻿/, ""));
```

`packages/core/src/lexer.ts`, el `E002` genérico al final de `scanCodeToken`:

```ts
      this.advance();
      // Los ids son ASCII (GRAMMAR); con una letra como 'é' se dice por qué (#51).
      const reason = /\p{L}/u.test(ch) ? ": los ids solo admiten letras ASCII, dígitos y '_'" : "";
      this.diagnostics.push(
        diagnosticAt("E002", `carácter inesperado '${ch}'${reason}`, { start, end: { line: this.line, column: this.column } })
      );
```

`packages/core/GRAMMAR.md`, la fila `E002` pasa a decir:

```
| E002 | lexer | carácter inesperado (si es una letra no ASCII, el mensaje explica que los ids son ASCII), o cadena sin cerrar |
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/core test`
Expected: PASS. Los snapshots no cambian.

- [ ] **Step 5: Build core**

Run: `pnpm --filter @flo/core build`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/parser/document.ts packages/core/src/lexer.ts packages/core/GRAMMAR.md packages/core/src/lexer.test.ts packages/core/src/parser/document.test.ts
git commit -m "fix(core): BOM en .flo y mensaje de ids no ASCII (#51)"
```

---

### Task 2: `sequence` — auto-mensaje y columnas a la medida (#52)

**Files:**
- Modify: `packages/core/src/layout/sequence.ts`
- Modify: `packages/core/src/render/sequence.ts`
- Test: `packages/core/src/render/sequence.test.ts`, `packages/core/src/layout/sequence.test.ts`

**Interfaces:**
- Consumes: `blockNodes`, `nodeId` de `layout/nodes.ts`.
- Produces: `SequenceLayout.columnWidth: number`. El render deja de importar `COLUMN_WIDTH` y usa `layout.columnWidth`. `COLUMN_WIDTH` sigue exportado como mínimo (160).

- [ ] **Step 1: Write the failing tests**

En `packages/core/src/render/sequence.test.ts`, dentro de `describe("renderSequenceToSvg")`:

```ts
  it("draws a message to the same participant as a visible loop (#52)", () => {
    const svg = renderFirst("entity a\nsequence s {\n  a -> a : yo\n}\n");
    expect(svg).toContain('<polyline points="80,120 110,120 110,140 80,140" fill="none" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" data-flo-from="a" data-flo-to="a"');
    expect(svg).toContain('<text x="95" y="112"');
    expect(svg).not.toMatch(/<line x1="80" y1="120" x2="80" y2="120"/);
  });

  it("keeps a final self-message loop inside the lifeline and the SVG", () => {
    const svg = renderFirst("entity a\nentity b\nsequence s {\n  a -> b : x\n  b -> b : y\n}\n");
    // Último mensaje en y=170; el lazo baja a 190; la lifeline termina en 220 y el SVG mide 240.
    expect(svg).toContain('points="240,170 270,170 270,190 240,190"');
    expect(svg).toContain('y2="220"');
    expect(svg).toContain('height="240"');
  });

  it("widens every column to fit the longest participant label (#52)", () => {
    const svg = renderFirst("entity a [Un participante con un nombre largo]\nentity b\nsequence s {\n  a -> b : x\n}\n");
    // 35 caracteres × 8 + 40 = 320 por columna.
    expect(svg).toContain('width="640" height="190"');
    expect(svg).toContain('<rect x="10" y="0" width="300" height="50"');
    expect(svg).toContain('<text x="160" y="25"');
  });

  it("widens the columns to fit the longest message label (#52)", () => {
    const svg = renderFirst("entity a\nentity b\nsequence s {\n  a -> b : un mensaje bastante largo para una columna\n}\n");
    // 42 caracteres × 7 + 28 = 322 por columna.
    expect(svg).toContain('width="644"');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/core exec vitest run src/render/sequence.test.ts`
Expected: FAIL. Hoy no hay `<polyline>` en `sequence` y el ancho es fijo (320).

- [ ] **Step 3: Implement the layout**

`packages/core/src/layout/sequence.ts`:
- agregar `columnWidth: number;` a `SequenceLayout`, después de `height`;
- reemplazar el cuerpo de `layoutSequence`:

```ts
// Las mismas medidas que el flowchart (measureFlowchartNode) y que svgLabel.
const CHAR_WIDTH = 8;
const LABEL_CHAR_WIDTH = 7;

export function layoutSequence(block: DiagramBlock, catalog: Catalog): SequenceLayout {
  const nodes = blockNodes(block, catalog);
  // Una sola columna para todas (#52): la del label más largo, o 160 si todo cabe.
  const columnWidth = Math.max(
    COLUMN_WIDTH,
    ...nodes.map((node) => node.label.length * CHAR_WIDTH + 40),
    ...block.edges.map((edge) => (edge.label ?? "").length * LABEL_CHAR_WIDTH + 28)
  );
  const participants: SequenceParticipantLayout[] = nodes.map((node, index) => ({
    id: node.id,
    label: node.label,
    resolved: node.resolved,
    x: columnWidth / 2 + index * columnWidth,
    range: node.range,
  }));

  const messages: SequenceMessageLayout[] = block.edges.map((edge, index) => ({
    from: nodeId(edge.from),
    to: nodeId(edge.to),
    label: edge.label ?? "", // el parser garantiza la etiqueta en `sequence`
    y: HEADER_HEIGHT + TOP_MARGIN + (index + 1) * ROW_HEIGHT,
    range: edge.range,
  }));

  const lifelineTop = HEADER_HEIGHT;
  const lifelineBottom = HEADER_HEIGHT + TOP_MARGIN + (messages.length + 1) * ROW_HEIGHT;

  return {
    width: participants.length * columnWidth,
    height: lifelineBottom + BOTTOM_MARGIN,
    columnWidth,
    lifelineTop,
    lifelineBottom,
    participants,
    messages,
  };
}
```

- [ ] **Step 4: Implement the render**

`packages/core/src/render/sequence.ts`:
- cambiar el import a `import { HEADER_HEIGHT } from "../layout/sequence.js";`;
- en `participantElements`:

```ts
    const left = participant.x - layout.columnWidth / 2 + 10;
    const boxWidth = layout.columnWidth - 20;
```

- en `messageElements`, después de calcular `data`:

```ts
    if (message.from === message.to) {
      // Auto-mensaje (#52): un lazo a la derecha de la lifeline, que vuelve a ella.
      const { y } = message;
      const loop = `<polyline points="${x1},${y} ${x1 + 30},${y} ${x1 + 30},${y + 20} ${x1},${y + 20}" fill="none" stroke="${STROKE_COLOR}" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})"${data} />`;
      return `${loop}${svgLabel(x1 + 15, y - 8, message.label)}`;
    }
```

- [ ] **Step 5: Fix layout tests that compare the whole object**

En `packages/core/src/layout/sequence.test.ts`, el `toEqual` de la línea ~14 compara el layout entero: agregarle `columnWidth: 160,`. No cambiar ningún otro valor esperado. Si otro número cambia, el layout está mal.

- [ ] **Step 6: Run all core tests**

Run: `pnpm --filter @flo/core test`
Expected: PASS. Los tres snapshots de `reference-diagrams.test.ts.snap` pasan sin `-u`: sus labels caben en 160.

- [ ] **Step 7: Build core and run web tests**

Run: `pnpm --filter @flo/core build && pnpm --filter @flo/web test`
Expected: PASS. `sequence-view.ts` lee la altura del `rect`, no el ancho.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/layout/sequence.ts packages/core/src/render/sequence.ts packages/core/src/render/sequence.test.ts packages/core/src/layout/sequence.test.ts
git commit -m "fix(core): auto-mensaje visible y columnas a la medida en sequence (#52)"
```

---

### Task 3: `Diagnostic` sin severidad (#53)

**Files:**
- Modify: `packages/core/src/diagnostics.ts`
- Modify: `packages/core/src/index.ts:52`
- Modify: `packages/web/src/flo-lint.ts`
- Modify: `packages/mcp/src/folder.ts:43-59`
- Test: `packages/core/src/diagnostics.test.ts`, `packages/core/src/index.test.ts`, `packages/core/src/lexer.test.ts`, `packages/core/src/workspace/resolver.test.ts`, `packages/web/src/preview.test.ts`, `packages/web/src/flo-lint.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `interface Diagnostic { code: string; message: string; range: Range }`;
  - `diagnosticAt(code, message, range): Diagnostic`;
  - `DiagnosticSeverity` ya no existe;
  - `LintDiagnostic.severity` es el literal `"error"`.

- [ ] **Step 1: Update the tests to the new shape (they become the failing tests)**

- `packages/core/src/diagnostics.test.ts`:
  - borrar el test `"formats a warning diagnostic"` entero;
  - en los otros dos, borrar la línea `severity: "error",`.
- Borrar la línea `severity: "error",` de los objetos esperados en:
  - `packages/core/src/index.test.ts:45`;
  - `packages/core/src/lexer.test.ts:46`;
  - `packages/core/src/workspace/resolver.test.ts:33`;
  - `packages/web/src/preview.test.ts:10`;
  - `packages/web/src/flo-lint.test.ts:21,27`.
- En `packages/web/src/flo-lint.test.ts`, el test que usa `severity: "warning"` (líneas ~40-45) pasa a:

```ts
    expect(
      toLintDiagnostics([{ code: "E999", message: "x", range }], doc)
    ).toEqual([{ from: 17, to: 17, severity: "error", message: "E999: x" }]);
```

  y su título cambia a `"marks every diagnostic as an error"`.

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `pnpm --filter @flo/core typecheck`
Expected: FAIL. `diagnostics.test.ts` y los demás construyen `Diagnostic` sin `severity`, que todavía es obligatorio.

- [ ] **Step 3: Implement in core**

`packages/core/src/diagnostics.ts` completo:

```ts
import type { Range } from "./ast.js";

/** Todo diagnóstico es un error (#53). */
export interface Diagnostic {
  code: string;
  message: string;
  range: Range;
}

export function diagnosticAt(code: string, message: string, range: Range): Diagnostic {
  return { code, message, range };
}

/** Ordena in place por (línea, columna) y devuelve el mismo array. */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column
  );
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `${diagnostic.code} error [${diagnostic.range.start.line}:${diagnostic.range.start.column}]: ${diagnostic.message}`;
}
```

`packages/core/src/index.ts:52`: `export type { Diagnostic } from "./diagnostics.js";`

Run: `grep -rn "severity\|DiagnosticSeverity" packages/core/src packages/core/GRAMMAR.md docs/SYNTAX.md README.md`
Expected: sin resultados. Si queda alguno, borrarlo.

- [ ] **Step 4: Build core and fix the consumers**

Run: `pnpm --filter @flo/core build`

`packages/web/src/flo-lint.ts`:

```ts
export interface LintDiagnostic {
  from: number;
  to: number;
  severity: "error";
  message: string;
}
```

y en `toLintDiagnostics`: `return { from, to, severity: "error", message: \`${d.code}: ${d.message}\` };`.

`packages/mcp/src/folder.ts`, `newErrors` (todo diagnóstico es un error):

```ts
function newErrors(before: LinkResult, after: LinkResult, uri: string): UriDiagnostic[] {
  const found: UriDiagnostic[] = [];
  for (const [other, errors] of after.diagnostics) {
    if (other === uri) {
      found.push(...errors.map((d) => ({ uri: other, ...d })));
      continue;
    }
    const previous = (before.diagnostics.get(other) ?? []).map(errorKey);
    for (const d of errors) {
      const index = previous.indexOf(errorKey(d));
      if (index >= 0) previous.splice(index, 1);
      else found.push({ uri: other, ...d });
    }
  }
  return found;
}
```

Run: `grep -rn "severity" packages/web/src packages/mcp/src`
Expected: solo `flo-lint.ts` y `flo-lint.test.ts` (el literal `"error"` que pide CodeMirror).

- [ ] **Step 5: Run everything**

Run: `pnpm -r typecheck && pnpm -r test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core packages/web/src/flo-lint.ts packages/web/src/flo-lint.test.ts packages/web/src/preview.test.ts packages/mcp/src/folder.ts
git commit -m "refactor(core): Diagnostic sin severidad, todo es error (#53)"
```

---

### Task 4: helpers compartidos en core (#54)

**Files:**
- Modify: `packages/core/src/ast.ts:20` (`MEMORY_TYPES`)
- Modify: `packages/core/src/workspace/uri.ts` (`parseBlockId`, `IGNORED_DIRS`, `isDocumentUri`, `isIgnoredUri`)
- Modify: `packages/core/src/workspace/xref.ts` (exporta `push`), `packages/core/src/workspace/query.ts`, `packages/core/src/workspace/navigation.ts`
- Modify: `packages/core/src/layout/flowchart.ts` (exporta `GRAPH_OPTIONS`, `finiteOrZero`), `packages/core/src/render/knowledge.ts`
- Modify: `packages/core/src/parser/markdown.ts:16`, `packages/core/src/index.ts`
- Modify: `packages/mcp/src/folder.ts:18-28`, `packages/mcp/src/tools.ts:6`
- Modify: `packages/web/src/folder-io.ts`, `packages/web/src/presets.ts:15`, `packages/web/src/knowledge-view.ts:20`, `packages/web/src/entity-panel.ts:4-10`, `packages/web/src/app.ts:469`
- Test: `packages/core/src/workspace/uri.test.ts` (crearlo si no existe), `packages/core/src/workspace/navigation.test.ts`

**Interfaces:**
- Consumes: `SCHEMA_URI` de `workspace/schema.ts`.
- Produces (todo exportado desde `@flo/core`):
  - `MEMORY_TYPES: readonly ["working", "short_term", "long_term"]`, y `MemoryType = (typeof MEMORY_TYPES)[number]`;
  - `parseBlockId(id: BlockId): { uri: DocumentUri; name: string }`;
  - `IGNORED_DIRS: ReadonlySet<string>`;
  - `isDocumentUri(uri: string): boolean`;
  - `isIgnoredUri(uri: string): boolean`.

  Internos de core: `push` (de `xref.ts`), `GRAPH_OPTIONS` y `finiteOrZero` (de `layout/flowchart.ts`).

- [ ] **Step 1: Write the failing tests**

`packages/core/src/workspace/uri.test.ts` (si ya existe, agregar el `describe`):

```ts
import { describe, it, expect } from "vitest";
import { blockId, isDocumentUri, isIgnoredUri, parseBlockId } from "./uri.js";

describe("shared uri helpers (#54)", () => {
  it("parses a BlockId back into uri and name", () => {
    expect(parseBlockId(blockId("kb/a.flo", "login"))).toEqual({ uri: "kb/a.flo", name: "login" });
    expect(parseBlockId("#mapa")).toEqual({ uri: "", name: "mapa" });
  });

  it("knows which uris are workspace documents and which are ignored", () => {
    expect(["a.flo", "kb/b.md", "knowledge.schema.yaml"].map(isDocumentUri)).toEqual([true, true, true]);
    expect(["a.txt", "kb/knowledge.schema.yaml"].map(isDocumentUri)).toEqual([false, false]);
    expect(["node_modules/x.md", "a/.git/b.flo", "gitx/a.flo"].map(isIgnoredUri)).toEqual([true, true, false]);
  });
});
```

En `packages/core/src/workspace/navigation.test.ts`, un test del orden de las ediciones:

```ts
  it("returns each document's edits in source order, also within one line", () => {
    const workspace = new Workspace();
    workspace.setDocument("a.flo", "entity api\nflow f {\n  api -> api\n}\n");
    const result = renameEntity(workspace.link(), "api", "gw");
    if ("error" in result) throw new Error(result.error);
    expect(result.edits.get("a.flo")!.map((edit) => edit.range.start)).toEqual([
      { line: 1, column: 8 },
      { line: 3, column: 3 },
      { line: 3, column: 10 },
    ]);
  });
```

(Importar `Workspace` y `renameEntity` como lo hagan los demás tests del archivo.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/uri.test.ts src/workspace/navigation.test.ts`
Expected: FAIL. `parseBlockId`, `isDocumentUri` e `isIgnoredUri` no existen. El test de orden puede pasar ya; es un test de regresión del comparador.

- [ ] **Step 3: Implement the core helpers**

`packages/core/src/ast.ts`, reemplazar la línea de `MemoryType`:

```ts
export const MEMORY_TYPES = ["working", "short_term", "long_term"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];
```

`packages/core/src/workspace/uri.ts`, agregar al final (con `import { SCHEMA_URI } from "./schema.js";` arriba):

```ts
/** Inverso de `blockId`: el nombre es un identificador (sin '#'), así que va después del último '#'. */
export function parseBlockId(id: BlockId): { uri: DocumentUri; name: string } {
  const hash = id.lastIndexOf("#");
  return { uri: id.slice(0, hash), name: id.slice(hash + 1) };
}

/** Carpetas que ni la carga ni el watcher recorren (#33, #37). */
export const IGNORED_DIRS: ReadonlySet<string> = new Set(["node_modules", ".git"]);

/** Los documentos del workspace: `.flo`, `.md` y el esquema en la raíz (decisión #29). */
export function isDocumentUri(uri: string): boolean {
  return uri === SCHEMA_URI || uri.endsWith(".flo") || uri.endsWith(".md");
}

export function isIgnoredUri(uri: string): boolean {
  return uri.split("/").some((segment) => IGNORED_DIRS.has(segment));
}
```

`packages/core/src/workspace/xref.ts`: cambiar `function push` por `export function push` (mismo cuerpo).

`packages/core/src/workspace/query.ts`: borrar su `push` local y agregar `import { push } from "./xref.js";`.

`packages/core/src/workspace/navigation.ts`:
- agregar `import { push } from "./xref.js";`;
- borrar el closure `add` y reemplazar cada `add(uri, range, text)` por `push(edits, uri, { range, text })`;
- reemplazar el sort final:

```ts
  for (const list of edits.values()) {
    list.sort((a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column);
  }
```

`packages/core/src/layout/flowchart.ts`: `export const GRAPH_OPTIONS = …` y `export function finiteOrZero(…)` (mismos cuerpos).

`packages/core/src/render/knowledge.ts`:
- borrar su `GRAPH_OPTIONS`, su `finiteOrZero` y `uriOf`;
- importar `GRAPH_OPTIONS`, `finiteOrZero` y `measureFlowchartNode` de `../layout/flowchart.js`, y `parseBlockId` de `../workspace/uri.js`;
- reescribir `blockTitle`:

```ts
function blockTitle(link: LinkResult, id: BlockId): string {
  const { uri, name } = parseBlockId(id);
  const block = link.documents.get(uri)?.document.blocks.find((candidate) => candidate.name === name);
  return block?.title ?? name;
}
```

  y en `graphOf`: `data: { block, uri: parseBlockId(block).uri },`.

`packages/core/src/parser/markdown.ts`:
- borrar la constante local `MEMORY_TYPES` e importar `MEMORY_TYPES` de `../ast.js` (import de valor);
- la condición queda `MEMORY_TYPES.includes(value.value as MemoryType)`.

`packages/core/src/index.ts`, agregar:

```ts
export { MEMORY_TYPES } from "./ast.js";
export { parseBlockId, IGNORED_DIRS, isDocumentUri, isIgnoredUri } from "./workspace/uri.js";
```

- [ ] **Step 4: Run core tests and build**

Run: `pnpm --filter @flo/core test && pnpm --filter @flo/core build`
Expected: PASS. Los snapshots no cambian.

- [ ] **Step 5: Replace the copies in mcp and web**

`packages/mcp/src/folder.ts`:
- borrar `IGNORED`, `isDocumentUri` e `isIgnored`;
- importar `IGNORED_DIRS`, `isDocumentUri` e `isIgnoredUri` de `@flo/core`;
- reemplazar `IGNORED.has(` por `IGNORED_DIRS.has(` y `isIgnored(` por `isIgnoredUri(`.

Run: `grep -rn "IGNORED\b\|isIgnored\b" packages/mcp/src`
Expected: ningún uso de los nombres viejos. Si un test los importaba desde `./folder.js`, importarlos desde `@flo/core` con el nombre nuevo.

`packages/mcp/src/tools.ts:6`: `const memory = z.enum(MEMORY_TYPES);` (importar `MEMORY_TYPES` de `@flo/core`).

`packages/web/src/folder-io.ts`:
- borrar `IGNORED` e importar `IGNORED_DIRS`, `isDocumentUri` e `isIgnoredUri` de `@flo/core`;
- `isWorkspaceFile` queda así:

```ts
export function isWorkspaceFile(uri: string): boolean {
  return !isIgnoredUri(uri) && isDocumentUri(uri);
}
```

- en `readDirectory`: `if (!IGNORED_DIRS.has(handle.name)) …`.

`packages/web/src/presets.ts:15`: `const MEMORY = new Set<string>(MEMORY_TYPES);` (importar de `@flo/core`).

`packages/web/src/knowledge-view.ts:20`: borrar `const MEMORY_TYPES = Object.keys(MEMORY_FILL) as MemoryType[];` e importar `MEMORY_TYPES` de `@flo/core`. El orden es el mismo.

`packages/web/src/entity-panel.ts`, `blockLabel`:

```ts
export function blockLabel(link: LinkResult, id: BlockId): string {
  const { uri, name } = parseBlockId(id);
  const block = link.documents.get(uri)?.document.blocks.find((candidate) => candidate.name === name);
  return `${block?.title ?? name} · ${uri}`;
}
```

`packages/web/src/app.ts:469`: `const { uri } = parseBlockId(id);` (importar `parseBlockId` de `@flo/core`).

- [ ] **Step 6: Run everything**

Run: `pnpm -r typecheck && pnpm -r test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core packages/mcp/src packages/web/src
git commit -m "refactor: helpers compartidos en core en vez de copias (#54)"
```

---

### Task 5: menores — versión MCP, viewport, data URL y fallback de abrir

**Files:**
- Modify: `packages/mcp/src/tools.ts:43`
- Modify: `packages/web/index.html` (`<head>`)
- Modify: `packages/web/src/export.ts:11-13`
- Modify: `packages/web/src/file-io.ts:28-44`
- Test: `packages/mcp/src/tools.test.ts`, `packages/web/src/export.test.ts`, `packages/web/src/file-io.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `svgDataUrl(svg)` devuelve `data:image/svg+xml;charset=utf-8,<encodeURIComponent(svg)>`. `openFloFile()` rechaza si el fallback no puede leer el archivo.

- [ ] **Step 1: Write the failing tests**

`packages/mcp/src/tools.test.ts` (agregar `readFileSync` al import de `node:fs`):

```ts
  it("reports the version from package.json", async () => {
    const { client } = await connect();
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(client.getServerVersion()?.version).toBe(pkg.version);
  });
```

`packages/web/src/export.test.ts`, reemplazar el test de `svgDataUrl`:

```ts
  it("encodes the svg as a utf-8 data URL, accents included", () => {
    const svg = "<svg>ñandú</svg>";
    const url = svgDataUrl(svg);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.slice("data:image/svg+xml;charset=utf-8,".length))).toBe(svg);
  });
```

`packages/web/src/file-io.test.ts`, junto al test del fallback:

```ts
  it("rejects when the fallback picker cannot read the file", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, "files", { value: [new File(["x"], "a.flo")], configurable: true });
      this.dispatchEvent(new Event("change"));
    });
    vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>));
    });
    await expect(openFloFile()).rejects.toBeInstanceOf(Error);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/mcp test && pnpm --filter @flo/web exec vitest run src/export.test.ts src/file-io.test.ts`
Expected:
- el test de versión pasa si `package.json` dice `0.1.0`; es de regresión;
- `svgDataUrl` falla (base64);
- el test del fallback se cuelga hasta el timeout (la promesa nunca se resuelve).

- [ ] **Step 3: Implement**

`packages/mcp/src/tools.ts`:

```ts
import { createRequire } from "node:module";
…
// Una sola fuente de la versión: package.json (está junto a dist/ y a src/).
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };
…
  const server = new McpServer({ name: "flo-mcp", version });
```

`packages/web/index.html`, después de `<meta charset="UTF-8" />`:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1" />
```

`packages/web/src/export.ts`:

```ts
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
```

`packages/web/src/file-io.ts`, `openFloFileFallback`:

```ts
function openFloFileFallback(): Promise<OpenResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".flo,.md,text/plain";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      readFileAsText(file).then((source) => resolve({ source, handle: null, name: file.name }), reject);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/mcp test && pnpm --filter @flo/mcp build && pnpm --filter @flo/web test`
Expected: PASS. El build de mcp confirma que `../package.json` resuelve desde `dist/`.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools.ts packages/mcp/src/tools.test.ts packages/web/index.html packages/web/src/export.ts packages/web/src/export.test.ts packages/web/src/file-io.ts packages/web/src/file-io.test.ts
git commit -m "fix: versión MCP de package.json, viewport, data URL utf-8 y fallback que rechaza"
```

---

### Task 6: un handle de archivo por documento (#55)

**Files:**
- Modify: `packages/web/src/app.ts` (`fileHandle` → `fileHandles`, en `load` y `save`)
- Modify: `packages/web/src/file-io.ts:76-97` (`suggestedName`)
- Modify: `packages/web/src/file-system-access.d.ts:9-11`
- Test: `packages/web/src/app.test.ts`, `packages/web/src/file-io.test.ts`

**Interfaces:**
- Consumes: `saveFloFile(source, handle, name)` de `file-io.ts`; `name` es el uri del documento.
- Produces: `App` guarda un `Map<DocumentUri, FileSystemFileHandle>` privado. `FilePickerOptions.suggestedName?: string`.

- [ ] **Step 1: Write the failing tests**

`packages/web/src/app.test.ts`, en el `describe` de guardado o al final del principal:

```ts
  it("saves each document of a folderless workspace to its own file (#55)", async () => {
    const written = new Map<string, string>();
    const handle = (name: string) =>
      ({
        name,
        createWritable: async () => ({ write: async (text: string) => void written.set(name, text), close: async () => {} }),
      }) as unknown as FileSystemFileHandle;
    window.showOpenFilePicker = vi.fn();
    window.showSaveFilePicker = vi.fn().mockResolvedValueOnce(handle("a")).mockResolvedValueOnce(handle("b"));
    try {
      const app = new App(elements(), FILES); // sin carpeta, dos archivos, activo login.flo
      await app.save();
      app.openDocument("catalog.flo");
      await app.save();
      expect(window.showSaveFilePicker).toHaveBeenCalledTimes(2);
      expect(written.get("a")).toBe(FILES.files["login.flo"]);
      expect(written.get("b")).toBe(FILES.files["catalog.flo"]);
    } finally {
      delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
      delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    }
  });
```

`packages/web/src/file-io.test.ts`, junto a `"prompts for a new file when there is no handle yet"`, en el mismo estilo de ese test (handle falso con `createWritable`):

```ts
  it("suggests the document's file name in the save picker (#55)", async () => {
    window.showOpenFilePicker = vi.fn();
    const writable = { write: vi.fn(), close: vi.fn() };
    window.showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable: vi.fn().mockResolvedValue(writable) });
    await saveFloFile("x", null, "decisiones/pkce.md");
    expect(window.showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: "pkce.md" }));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/app.test.ts src/file-io.test.ts`
Expected: FAIL:
- el picker se llama una sola vez y `written.get("a")` termina con el contenido de `catalog.flo`;
- falta `suggestedName`.

- [ ] **Step 3: Implement**

`packages/web/src/file-system-access.d.ts`:

```ts
  interface FilePickerOptions {
    types?: FilePickerAcceptType[];
    suggestedName?: string;
  }
```

`packages/web/src/file-io.ts`, en `saveFloFile`:

```ts
        target = await window.showSaveFilePicker!({ ...FLO_PICKER_OPTIONS, suggestedName: name.slice(name.lastIndexOf("/") + 1) });
```

Si un test existente hace `toHaveBeenCalledWith(<opciones exactas>)` sobre `showSaveFilePicker`, agregarle `suggestedName` con el valor que corresponda.

`packages/web/src/app.ts`:
- reemplazar `private fileHandle: FileSystemFileHandle | null = null;` por:

```ts
  /** Sin carpeta, el handle de cada documento (#55): un uri nunca se guarda sobre el archivo de otro. */
  private readonly fileHandles = new Map<DocumentUri, FileSystemFileHandle>();
```

- en `load`, reemplazar `this.fileHandle = fileHandle;` por:

```ts
    this.fileHandles.clear();
    if (fileHandle) this.fileHandles.set(this.ws.active, fileHandle);
```

  (va después de `this.ws = new EditorWorkspace(snapshot);`).
- en `save`, la rama sin carpeta queda así:

```ts
      const uri = ws.active;
      const handle = await saveFloFile(ws.source(uri), this.fileHandles.get(uri) ?? null, uri);
      if (handle) {
        if (this.ws === ws) this.fileHandles.set(uri, handle);
        ws.markSaved(uri);
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/app.ts packages/web/src/app.test.ts packages/web/src/file-io.ts packages/web/src/file-io.test.ts packages/web/src/file-system-access.d.ts
git commit -m "fix(web): cada documento sin carpeta se guarda en su propio archivo (#55)"
```

---

### Task 7: Ctrl/Cmd+S y aviso al salir (#56)

**Files:**
- Modify: `packages/web/src/app.ts` (métodos `onKeydown`, `onBeforeUnload`)
- Modify: `packages/web/src/main.ts`
- Test: `packages/web/src/app.test.ts`

**Interfaces:**
- Consumes: `App.save(): Promise<void>`, `EditorWorkspace.hasUnsavedChanges()`.
- Produces: `App.onKeydown(event: KeyboardEvent): void` y `App.onBeforeUnload(event: BeforeUnloadEvent): void`. `main.ts` los conecta a `window`.

- [ ] **Step 1: Write the failing tests**

`packages/web/src/app.test.ts`:

```ts
  it("saves on Ctrl/Cmd+S and keeps the browser's own dialog away (#56)", () => {
    const app = new App(elements(), FILES);
    const save = vi.spyOn(app, "save").mockResolvedValue();
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { ctrlKey: true, key: "S" }]) {
      const event = new KeyboardEvent("keydown", { key: "s", cancelable: true, ...init });
      app.onKeydown(event);
      expect(event.defaultPrevented).toBe(true);
    }
    for (const init of [{ ctrlKey: true, altKey: true }, {}]) {
      const event = new KeyboardEvent("keydown", { key: "s", cancelable: true, ...init });
      app.onKeydown(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(save).toHaveBeenCalledTimes(3);
  });

  it("warns before leaving the page only with changes that would be lost (#56)", () => {
    const app = new App(elements(), FILES);
    const leave = () => new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const clean = leave();
    app.onBeforeUnload(clean);
    expect(clean.defaultPrevented).toBe(false);
    app.ws.setSource("catalog.flo", "entity x\n");
    const dirty = leave();
    app.onBeforeUnload(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/app.test.ts`
Expected: FAIL con `app.onKeydown is not a function`.

- [ ] **Step 3: Implement**

`packages/web/src/app.ts`, después de `save()`:

```ts
  /** Ctrl/Cmd+S guarda en toda la página (#56); sin Alt, que con AltGr escribe caracteres. */
  onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "s") return;
    event.preventDefault();
    void this.run("Guardar", () => this.save());
  }

  /** Cerrar o recargar la pestaña avisa si hay cambios que se perderían (#56, criterio de #43). */
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.ws.hasUnsavedChanges()) return;
    event.preventDefault();
    // Safari todavía pide `returnValue` además de preventDefault.
    event.returnValue = "";
  }
```

`packages/web/src/main.ts`, reemplazar la última línea de `main`:

```ts
  const app = new App(el as AppElements, draft ?? newWorkspace());
  window.addEventListener("keydown", (event) => app.onKeydown(event));
  window.addEventListener("beforeunload", (event) => app.onBeforeUnload(event));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/app.ts packages/web/src/app.test.ts packages/web/src/main.ts
git commit -m "feat(web): Ctrl/Cmd+S guarda y cerrar la pestaña avisa si hay cambios (#56)"
```

---

### Task 8: exportar PNG a 2× y con el nombre del bloque (#57)

**Files:**
- Modify: `packages/web/src/export.ts`
- Modify: `packages/web/src/app.ts` (`exportable`, handlers de la toolbar)
- Test: `packages/web/src/export.test.ts`, `packages/web/src/app.test.ts`

**Interfaces:**
- Consumes: `RenderedDiagram.name`.
- Produces:
  - `exportSvg(svg: string, name: string): void`;
  - `exportPng(svg: string, name: string, scale = 2): Promise<void>`;
  - `App.exportable(): { svg: string; name: string } | undefined` (privado).

- [ ] **Step 1: Write the failing tests**

`packages/web/src/export.test.ts`, ajustar el test existente de `exportSvg` para que llame `exportSvg("<svg/>", "login")` y espere la descarga `login.svg`, en el mismo estilo de ese test. Si no hay test de `exportSvg`, agregar:

```ts
describe("exportSvg", () => {
  it("downloads the svg named after the block (#57)", () => {
    let name: string | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    exportSvg("<svg/>", "login");
    expect(name).toBe("login.svg");
  });
});
```

`packages/web/src/app.test.ts`:
- en el test que exporta el bloque seleccionado y después el mapa (líneas ~340-348), agregar:

```ts
    expect(vi.mocked(exportSvg).mock.calls[0][1]).toBe("vacio"); // el nombre del bloque elegido en ese test
    expect(vi.mocked(exportSvg).mock.calls[1][1]).toBe("mapa");
```

  El primer valor tiene que ser el nombre del bloque que ese test selecciona; leer el test para confirmarlo.
- en `"exports the graph as shown"`: `expect(vi.mocked(exportSvg).mock.calls[0][1]).toBe("grafo");`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/export.test.ts src/app.test.ts`
Expected: FAIL. Hoy se descarga como `diagrama.svg` y `exportSvg` recibe un solo argumento.

- [ ] **Step 3: Implement**

`packages/web/src/export.ts`:

```ts
export function exportSvg(svg: string, name: string): void {
  downloadText(svg, `${name}.svg`, "image/svg+xml");
}
```

`exportPng(svg: string, name: string, scale = 2)`:
- `canvas.width = width * scale;`
- `canvas.height = height * scale;`
- `ctx.drawImage(image, 0, 0, width * scale, height * scale);`
- `downloadBlob(blob, \`${name}.png\`);`

El comentario `ponytail:` existente sigue valiendo (jsdom no tiene canvas).

`packages/web/src/app.ts`:
- `exportable()` pasa a:

```ts
  /** Lo que exportan los botones (#41, #57): el SVG y el nombre del archivo, sin extensión. */
  private exportable(): { svg: string; name: string } | undefined {
    if (this.mode === "map") return { svg: renderMap(this.ws.link()).svg, name: "mapa" };
    if (this.mode === "graph") {
      // Lo que se ve, con su viewBox (#45), sin las franjas de click.
      const svg = this.el.preview.querySelector(".flo-kg svg")?.cloneNode(true) as Element | undefined;
      svg?.querySelectorAll(".flo-map-hit").forEach((hit) => hit.remove());
      return svg ? { svg: svg.outerHTML, name: "grafo" } : undefined;
    }
    const diagrams = this.previewState.lastDiagrams;
    const diagram = diagrams.find((d) => blockId(this.ws.active, d.name) === this.selectedBlock) ?? diagrams[0];
    return diagram ? { svg: diagram.svg, name: diagram.name } : undefined;
  }
```

- los handlers de la toolbar:

```ts
        onExportSvg: () =>
          void this.run("Exportar SVG", async () => {
            const out = this.exportable();
            if (out) exportSvg(out.svg, out.name);
          }),
        onExportPng: () =>
          void this.run("Exportar PNG", async () => {
            const out = this.exportable();
            if (out) await exportPng(out.svg, out.name);
          }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck`
Expected: PASS.

- [ ] **Step 5: Manual check (jsdom no tiene canvas)**

Run: `pnpm --filter @flo/web dev`. En el navegador:
1. Ejemplos → Flowchart.
2. Exportar PNG.
3. El archivo descargado se llama `<bloque>.png` y mide el doble del SVG (por ejemplo, abrirlo y mirar sus dimensiones).

Anotar el resultado en el reporte de la task.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/export.ts packages/web/src/export.test.ts packages/web/src/app.ts packages/web/src/app.test.ts
git commit -m "feat(web): exportar PNG a 2x y con el nombre del bloque (#57)"
```

---

### Task 9: ids de marcador únicos en el preview (#58)

**Files:**
- Modify: `packages/web/src/preview.ts` (nueva `scopeMarkerIds`)
- Modify: `packages/web/src/app.ts` (`refresh`)
- Test: `packages/web/src/preview.test.ts`, `packages/web/src/app.test.ts`

**Interfaces:**
- Consumes: el SVG del core, con `<marker id="flo-arrow">` y `marker-end="url(#flo-arrow)"`.
- Produces: `scopeMarkerIds(container: ParentNode): void`. Renombra el marcador del SVG `n` del contenedor a `flo-arrow-<n>`.

- [ ] **Step 1: Write the failing tests**

`packages/web/src/preview.test.ts` (importar `render` de `@flo/core` y `scopeMarkerIds` de `./preview.js`):

```ts
describe("scopeMarkerIds", () => {
  it("gives each SVG of the page its own arrow marker (#58)", () => {
    const div = document.createElement("div");
    div.innerHTML = render("entity a\nentity b\nflow f {\n  a -> b\n}\nflow g {\n  b -> a\n}\n")
      .diagrams.map((d) => d.svg)
      .join("");
    scopeMarkerIds(div);
    expect([...div.querySelectorAll("marker")].map((m) => m.id)).toEqual(["flo-arrow-0", "flo-arrow-1"]);
    const second = div.querySelectorAll("svg")[1].querySelector("polyline")!;
    expect(second.getAttribute("marker-end")).toBe("url(#flo-arrow-1)");
  });
});
```

`packages/web/src/app.test.ts`:

```ts
  it("never repeats an element id in the preview (#58)", () => {
    const el = elements();
    new App(el, { ...FILES, files: { ...FILES.files, "login.flo": 'use "./catalog.flo"\nflow a {\n  api -> db\n}\nflow b {\n  db -> api\n}\n' } });
    const ids = [...el.preview.querySelectorAll("[id]")].map((node) => node.id);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/preview.test.ts src/app.test.ts`
Expected: FAIL. `scopeMarkerIds` no existe, y en el preview aparece `flo-arrow` dos veces.

- [ ] **Step 3: Implement**

`packages/web/src/preview.ts`:

```ts
/**
 * Ids de marcador únicos en la página (#58): el core repite `flo-arrow` en
 * cada SVG (los exportados son archivos sueltos y lo necesitan así).
 */
export function scopeMarkerIds(container: ParentNode): void {
  container.querySelectorAll("svg").forEach((svg, index) => {
    const marker = svg.querySelector("marker[id]");
    if (!marker) return;
    const ref = `url(#${marker.id})`;
    marker.id = `${marker.id}-${index}`;
    svg.querySelectorAll(`[marker-end="${ref}"]`).forEach((line) => line.setAttribute("marker-end", `url(#${marker.id})`));
  });
}
```

`packages/web/src/app.ts`, en `refresh()`, inmediatamente después del bloque `if (this.mode === "map") … else if (graph) … else …`:

```ts
    scopeMarkerIds(this.el.preview);
```

(importar `scopeMarkerIds` de `./preview.js`). Cubre los tres modos, porque `renderGraph` también escribe en `el.preview`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test`
Expected: PASS. `"exports the graph as shown"` sigue pasando: el SVG exportado desde el DOM lleva `flo-arrow-0`, coherente dentro del archivo.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/preview.ts packages/web/src/preview.test.ts packages/web/src/app.ts packages/web/src/app.test.ts
git commit -m "fix(web): un id de marcador por SVG en el preview (#58)"
```

---

### Task 10: pan con pointer events (#59)

**Files:**
- Modify: `packages/web/src/pan-zoom.ts:52-79`
- Modify: `packages/web/index.html` (regla `.flo-kg svg`)
- Test: `packages/web/src/pan-zoom.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `bindPanZoom` con la misma firma; escucha `pointerdown`/`pointermove`/`pointerup`/`pointercancel`.

- [ ] **Step 1: Update the tests (they become the failing tests)**

En `packages/web/src/pan-zoom.test.ts`, el helper `mouse` dispara eventos por nombre. Cambiar en todos los tests:
- `"mousedown"` → `"pointerdown"`;
- `"mousemove"` → `"pointermove"`;
- `"mouseup"` → `"pointerup"`.

jsdom no tiene `PointerEvent`; un `MouseEvent` con `type: "pointerdown"` llega igual a los listeners. Si hay un test de `mouseleave`, reemplazarlo por este:

```ts
  it("stops panning on pointercancel", () => {
    const { svg } = setup();
    mouse(svg, "pointerdown", 10);
    mouse(svg, "pointercancel", 10);
    mouse(svg, "pointermove", 30, 10);
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 50");
  });

  it("captures the pointer so a drag keeps going outside the SVG", () => {
    const { svg } = setup();
    const capture = vi.fn();
    (svg as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = capture;
    svg.dispatchEvent(Object.assign(new MouseEvent("pointerdown", { bubbles: true, button: 0 }), { pointerId: 7 }));
    expect(capture).toHaveBeenCalledWith(7);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/pan-zoom.test.ts`
Expected: FAIL. El pan no reacciona a eventos `pointer*`.

- [ ] **Step 3: Implement**

`packages/web/src/pan-zoom.ts`, reemplazar desde `svg.addEventListener("mousedown", …)` hasta `svg.addEventListener("mouseleave", end);`:

```ts
  // Pointer events (#59): mouse, touch y lápiz; la captura sigue el arrastre fuera del SVG.
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    down = { x: event.clientX, y: event.clientY };
    last = { x: event.clientX, y: event.clientY };
    isDrag = false;
    // ponytail: jsdom no implementa setPointerCapture.
    svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener("pointermove", (event) => {
    if (!last || !down) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    last = { x: event.clientX, y: event.clientY };
    // Marcamos como arrastre si el desplazamiento neto desde pointerdown supera el umbral.
    if (!isDrag) {
      const netDistance = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      isDrag = netDistance > DRAG_THRESHOLD;
    }
    const s = scale();
    set(panViewBox(current(), dx * s, dy * s));
  });
  const end = () => {
    down = null;
    last = null;
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
```

`packages/web/index.html`, en `.flo-kg svg { … }`, agregar `touch-action: none;`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck`
Expected: PASS. El test del click que cierra un arrastre (captura en `click`) sigue pasando.

- [ ] **Step 5: Manual check**

Run: `pnpm --filter @flo/web dev`. Ejemplos → Grafo de conocimiento → Grafo:
- arrastrar y soltar fuera del SVG: el pan sigue mientras se arrastra y se corta al soltar;
- con las devtools en modo táctil, arrastrar con el dedo también desplaza.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/pan-zoom.ts packages/web/src/pan-zoom.test.ts packages/web/index.html
git commit -m "feat(web): pan del grafo con pointer events y captura (#59)"
```

---

### Task 11: diálogos propios y tuteo (#60)

**Files:**
- Create: `packages/web/src/dialogs.ts`
- Create: `packages/web/src/dialogs.test.ts`
- Modify: `packages/web/src/app.ts`: `reportActionError`, `savePreset`, `confirmDiscard`, `newDocument`, `openFile`, `openFolder`, `loadExample`, `rename`, `renameAt`, `onPanelClick`, el host y la toolbar.
- Modify: `packages/web/src/file-io.ts:98` (prompt del nombre de descarga)
- Modify: `packages/web/src/preview.ts:36` ("Escribí")
- Modify: `packages/web/index.html` (estilos `.flo-dialog`)
- Modify: `examples/README.md:16-19` (voseo)
- Test: `packages/web/src/app.test.ts`, `packages/web/src/file-io.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `ask(message: string, initial?: string): Promise<string | null>`;
  - `confirmDialog(message: string): Promise<boolean>`;
  - `notify(message: string): Promise<void>`.

  En `App` pasan a devolver `Promise<void>`: `newDocument`, `openFile`, `openFolder`, `loadExample`, `rename` y `renameAt`. `confirmDiscard` devuelve `Promise<boolean>` (privado).

- [ ] **Step 1: Write the failing tests for the dialogs**

`packages/web/src/dialogs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ask, confirmDialog, notify } from "./dialogs.js";

const open = () => document.querySelector<HTMLDialogElement>("dialog.flo-dialog")!;
const button = (value: string) => open().querySelector<HTMLButtonElement>(`button[value="${value}"]`)!;

describe("dialogs (#60)", () => {
  it("ask resolves the typed text and removes the dialog", async () => {
    const answer = ask("Nombre:", "viejo");
    expect(open().querySelector("input")!.value).toBe("viejo");
    open().querySelector("input")!.value = "nuevo";
    button("ok").click();
    expect(await answer).toBe("nuevo");
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("ask resolves null on Cancelar and on Escape", async () => {
    const cancelled = ask("Nombre:");
    button("cancel").click();
    expect(await cancelled).toBeNull();
    const escaped = ask("Nombre:");
    open().dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(await escaped).toBeNull();
  });

  it("shows the message as text, never as HTML", async () => {
    const answer = ask("<b>x</b>");
    expect(open().querySelector("p")!.textContent).toBe("<b>x</b>");
    expect(open().querySelector("b")).toBeNull();
    button("cancel").click();
    await answer;
  });

  it("confirmDialog resolves true on Aceptar and false on Cancelar", async () => {
    const yes = confirmDialog("¿Seguro?");
    button("ok").click();
    expect(await yes).toBe(true);
    const no = confirmDialog("¿Seguro?");
    button("cancel").click();
    expect(await no).toBe(false);
  });

  it("notify has only Aceptar", async () => {
    const done = notify("Listo");
    expect(open().querySelector('button[value="cancel"]')).toBeNull();
    button("ok").click();
    await expect(done).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/dialogs.test.ts`
Expected: FAIL con `Cannot find module './dialogs.js'`.

- [ ] **Step 3: Implement `dialogs.ts`**

```ts
/**
 * Diálogos propios sobre <dialog> nativo (decisión #60), en vez de
 * prompt/alert/confirm: no bloquean la página y se ven como la app.
 * Escape o "Cancelar" = null.
 */
function openDialog(message: string, options: { input?: string; cancel: boolean }): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "flo-dialog";
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      dialog.close?.();
      dialog.remove();
      resolve(value);
    };

    const form = document.createElement("form");
    const text = document.createElement("p");
    text.textContent = message;
    form.append(text);
    const input = options.input === undefined ? null : document.createElement("input");
    if (input) {
      input.value = options.input!;
      form.append(input);
    }
    const buttons = document.createElement("p");
    buttons.className = "flo-dialog-buttons";
    if (options.cancel) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.value = "cancel";
      cancel.textContent = "Cancelar";
      cancel.addEventListener("click", () => finish(null));
      buttons.append(cancel);
    }
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.value = "ok";
    ok.textContent = "Aceptar";
    buttons.append(ok);
    form.append(buttons);
    dialog.append(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      finish(input ? input.value : "ok");
    });
    // Escape: el <dialog> nativo dispara `cancel`.
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(null);
    });

    document.body.append(dialog);
    // ponytail: jsdom no implementa showModal; ahí se abre sin modal.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (input) input.select();
    (input ?? ok).focus();
  });
}

export function ask(message: string, initial = ""): Promise<string | null> {
  return openDialog(message, { input: initial, cancel: true });
}

export async function confirmDialog(message: string): Promise<boolean> {
  return (await openDialog(message, { cancel: true })) !== null;
}

export async function notify(message: string): Promise<void> {
  await openDialog(message, { cancel: false });
}
```

`packages/web/index.html`, junto a los demás estilos:

```css
      .flo-dialog {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 16px;
        min-width: 280px;
        font: inherit;
      }
      .flo-dialog input {
        width: 100%;
        box-sizing: border-box;
        font: inherit;
      }
      .flo-dialog-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin: 12px 0 0;
      }
```

Run: `pnpm --filter @flo/web exec vitest run src/dialogs.test.ts`
Expected: PASS.

- [ ] **Step 4: Switch `app.ts` and `file-io.ts` to the dialogs**

`packages/web/src/app.ts` (importar `ask`, `confirmDialog` y `notify` de `./dialogs.js`):

```ts
function reportActionError(action: string, error: unknown): void {
  console.error(`flo: ${action} falló`, error);
  void notify(`No se pudo completar: ${action}. Revisa la consola para más detalle.`);
}
```

- `savePreset`:
  - `const answer = await ask("Nombre de la vista:");`;
  - `await notify("El nombre de una vista solo puede tener letras, números, '-' y '_'.");` (y `return`);
  - `… && !(await confirmDialog(\`Ya existe la vista '${name}'. ¿Reemplazarla?\`))) return;`.
- `private async confirmDiscard(): Promise<boolean>` con `return !this.ws.hasUnsavedChanges() || (await confirmDialog("Hay cambios sin guardar. ¿Descartarlos?"));`
- `async newDocument(kind)`: `if (await this.confirmDiscard()) this.load(newWorkspace(kind));`.
- `openFile`: `if (!opened || !(await this.confirmDiscard())) return;`.
- `openFolder`:
  - `await notify("La carpeta no tiene archivos .flo ni .md.");`;
  - `if (await this.confirmDiscard()) this.load(snapshot);`.
- `async loadExample(id)`: `if (!example || !(await this.confirmDiscard())) return;`.
- `async rename(id)`:
  - `const answer = await ask(\`Nuevo id para '${id}':\`, id);`;
  - en error, `await notify(result.error); return;`.

  Después del `await`, el editor puede tener otro documento activo: `renameEntity` se calcula sobre `this.ws.link()` en ese momento, y el bucle de ediciones ya distingue el activo.
- `renameAt(position): Promise<void>`: `return id === null ? Promise.resolve() : this.rename(id);`.
- host: `onRename: (position) => void this.renameAt(position),`.
- `onPanelClick`: `void this.rename(panel.id);`.
- toolbar:
  - `onNew: (kind) => void this.run("Nuevo", () => this.newDocument(kind)),`;
  - `onLoadExample: (id) => void this.run("Ejemplo", () => this.loadExample(id)),`.

`packages/web/src/file-io.ts:98`: `const chosenName = await ask("Nombre del archivo para descargar:", name);` (importar `ask` de `./dialogs.js`).

Run: `grep -rn "window\.\(prompt\|alert\|confirm\)" packages/web/src --include=*.ts | grep -v test`
Expected: sin resultados.

- [ ] **Step 5: Migrate the tests from window spies to the dialogs mock**

En `packages/web/src/app.test.ts` y `packages/web/src/file-io.test.ts`, agregar arriba (junto al `vi.mock` existente en `app.test.ts`):

```ts
vi.mock("./dialogs.js", () => ({ ask: vi.fn(), confirmDialog: vi.fn(), notify: vi.fn() }));
import { ask, confirmDialog, notify } from "./dialogs.js";
```

y en el `beforeEach` (crearlo si no hay):

```ts
  vi.mocked(ask).mockReset().mockResolvedValue(null);
  vi.mocked(confirmDialog).mockReset().mockResolvedValue(false);
  vi.mocked(notify).mockReset().mockResolvedValue();
```

Cada spy viejo se traduce así, y el test pasa a ser `async` con `await` sobre el método o `await vi.waitFor(...)` cuando la acción sale de un click:

| Antes | Después |
|---|---|
| `vi.spyOn(window, "prompt").mockReturnValue(x)` | `vi.mocked(ask).mockResolvedValue(x)` |
| `vi.spyOn(window, "confirm").mockReturnValue(b)` | `vi.mocked(confirmDialog).mockResolvedValue(b)` |
| `vi.spyOn(window, "alert")…` + `expect(alert).toHaveBeenCalledWith(m)` | `expect(notify).toHaveBeenCalledWith(m)` |
| `prompt` esperado con `("Nuevo id para 'api':", "api")` | `expect(ask).toHaveBeenCalledWith("Nuevo id para 'api':", "api")` |

Ejemplos concretos:

```ts
  it("replaces the workspace for a new document without a folder, asking before discarding changes", async () => {
    const app = new App(elements(), FILES);
    app.ws.setSource("catalog.flo", "entity api\n");
    vi.mocked(confirmDialog).mockResolvedValue(false);
    await app.newDocument("flowchart");
    expect(confirmDialog).toHaveBeenCalledWith("Hay cambios sin guardar. ¿Descartarlos?");
    expect(app.ws.uris()).toEqual(["catalog.flo", "login.flo"]);
    vi.mocked(confirmDialog).mockResolvedValue(true);
    await app.newDocument("flowchart");
    expect(app.ws.uris()).toEqual(["nuevo.flo"]);
  });

  it("renames across documents: the active one through the editor, the rest in the workspace", async () => {
    const el = elements();
    const app = new App(el, FILES);
    app.selectEntity("api");
    vi.mocked(ask).mockResolvedValue("gateway");
    click(el.panel.querySelector("[data-flo-rename]")!);
    await vi.waitFor(() => expect(app.view.state.doc.toString()).toContain("  gateway -> db"));
    expect(app.ws.source("catalog.flo")).toBe("entity gateway [API Gateway]\nentity db [Base]\n");
  });
```

Agregar el caso de Review Focus 4:

```ts
  it("does nothing when the rename dialog is dismissed (Escape = null)", async () => {
    const app = new App(elements(), FILES);
    vi.mocked(ask).mockResolvedValue(null);
    await app.rename("api");
    expect(app.ws.hasUnsavedChanges()).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
```

Todos los llamados directos a `app.newDocument`, `app.loadExample`, `app.rename` y `app.renameAt` en tests llevan `await`. También el test de la task 6 si llama alguno.

En `file-io.test.ts`, los tres tests del nombre de descarga usan `vi.mocked(ask).mockResolvedValue("diagrama.flo" | "arquitectura.flo" | null)` y `expect(ask).toHaveBeenCalledWith("Nombre del archivo para descargar:", "diagrama.flo")`.

- [ ] **Step 6: Tuteo en los textos al usuario**

- `packages/web/src/preview.ts:36`: `'<div class="flo-empty">Escribe un diagrama .flo para ver el preview</div>'`.
- `examples/README.md`:
  - "(o abrila con **Abrir carpeta**); tocá **Grafo**" → "(o ábrela con **Abrir carpeta**); toca **Grafo**";
  - "podés abrirlos" → "puedes abrirlos";
  - "También podés pegar" → "También puedes pegar".

Run: `grep -rnE "(Escribí|Revisá|abrila|tocá|podés|tenés|usá|probá|elegí|agregá|mirá|hacé|poné|querés|pegá|guardá|fijate)" packages/core/src packages/web/src packages/mcp/src packages/web/index.html README.md examples/README.md docs/SYNTAX.md`
Expected: sin resultados. Si aparece alguno en un test que compara el texto, actualizar el test.

- [ ] **Step 7: Run everything**

Run: `pnpm -r typecheck && pnpm -r test`
Expected: PASS.

- [ ] **Step 8: Manual check**

Run: `pnpm --filter @flo/web dev`, y en el navegador:
1. Renombrar con F2: aparece el diálogo con el id seleccionado. Escape no cambia nada; Enter renombra.
2. Con una carpeta abierta y cambios, "Nuevo flowchart" crea el archivo; abrir un ejemplo pregunta antes de descartar.
3. Guardar vista: aparece el diálogo de nombre.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/dialogs.ts packages/web/src/dialogs.test.ts packages/web/src/app.ts packages/web/src/app.test.ts packages/web/src/file-io.ts packages/web/src/file-io.test.ts packages/web/src/preview.ts packages/web/index.html examples/README.md
git commit -m "feat(web): diálogos propios sobre <dialog> y textos en tuteo (#60)"
```

---

## Cierre

- [ ] Verificación final desde la raíz: `pnpm -r typecheck && pnpm -r test && pnpm -r build`.
- [ ] `git status` limpio y `git diff --stat packages/core/src/render/__snapshots__/` vacío desde el inicio del plan.
- [ ] Marcar el plan como completado (bloque **Estado** al principio, como en `2026-09-30-flo-arreglos-post-k4.md`).
