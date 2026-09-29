# .flo — `.md` como documento del workspace (Fase K1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-09-28 (`dd7d274`..`088f153`, fix de la revisión final `ad3b9ce`); revisión final: 1 hallazgo importante (`parse()` con uris que no son documentos) y 2 menores, corregidos; el resto quedó en §11 como pendientes diferidos de F y K3.

**Goal:** Que un `.md` con frontmatter tipado sea una entidad más del
catálogo del workspace: se parsea y valida (`E060`–`E068`), sus bloques
` ```flo ` embebidos entran al workspace, sus `use:` y rutas de
`relations` participan de la resolución transitiva de la Fase D (`E035`), y
el `XRefIndex` responde `relationsFrom` / `relationsTo`.

**Architecture:** Un helper `parser/yaml.ts` envuelve la dependencia `yaml`
(rangos de nodo → `Range`, errores → `E061`). `parser/markdown.ts`
(`parseMarkdownDocument`) separa frontmatter y cuerpo, arma la
`EntityDecl` con `knowledge` y parsea cada bloque ` ```flo ` con el
`parseDocument` existente sobre una fuente rellenada con líneas vacías, así
los rangos salen exactos sin desplazar nada. `Workspace.setDocument` elige
el parser por uri (`.md`, `knowledge.schema.yaml`, resto `.flo`).
`workspace/schema.ts` parsea el esquema y valida vocabulario (`E065`,
`E066`, `E068`); `workspace/knowledge.ts` resuelve `relations.target`
(`E035`) y aporta los `use` implícitos a `linkDocuments`.

**Tech Stack:** TypeScript 5 (strict), Vitest, **`yaml` ^2.9.1** (única
dependencia nueva, decisión #19).

**Spec:** `docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md`
(§3 formato, §4 modelo, §8 diagnósticos, §10 K1, §11 testing). Decisiones
vigentes en `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
§11 (#2, #9, #16–#22, #24, #25). Orden de fases: D → E → **K1** → K2 → K3 →
F → K4.

## Global Constraints

- **Snapshots de SVG no se regeneran** (`vitest -u` prohibido); ningún
  `.snap` cambia en esta fase.
- **Imports relativos en `packages/core/src/` llevan sufijo `.js`.**
- **Única dependencia nueva: `yaml`** (`pnpm --filter @flo/core add yaml@^2.9.1`,
  task 1). Nada de módulos de Node en el código de `@flo/core` (corre en el
  navegador).
- **Mensajes de diagnóstico y comentarios en español.** Nombres de test en
  inglés.
- **Códigos nuevos exactamente estos**, con el significado de spec §8:
  `E035`, `E060`–`E068`. Se agregan a la tabla de `packages/core/GRAMMAR.md`
  en la task que los emite. Ningún código existente cambia de significado.
- **Columnas y líneas 1-based, `end` exclusivo** (como todo `Range` del
  core). Un rango YAML es `[range[0], range[1])` del nodo (sin comentarios
  de cola), convertido con `LineCounter` de `yaml`.
- **El comportamiento `.flo` no cambia**: toda la suite existente pasa sin
  editar expectativas, salvo agregar `knowledge: null` donde un test compara
  una `EntityDecl` completa con `toEqual`.
- **Decisiones nuevas** van al final de §11 del spec de 2026-09-19, en una
  tabla "Decisiones de la Fase K1 (2026-09-28)", en la task que las
  implementa (#27–#30, texto dado en cada task).
- `@flo/web` no se toca, pero consume `@flo/core` por `dist/`: la task 5
  termina con `pnpm --filter @flo/core build` y la verificación completa.
- Un commit por task, con la línea final
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verificación final (desde la raíz): `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

## Review Focus

1. **`.md` con finales de línea CRLF** (editado en Windows): `---\r` se
   reconoce como delimitador y los rangos (`nameRange`, fin del
   frontmatter, `typeTagRanges`) son los mismos que con LF. Test en task 1.
2. **Frontmatter parcialmente inválido no produce cascada**: con `id`
   válido la entidad existe (label = id, `memoryType: null`), así un flujo
   que la usa no recibe `E030`. Test en tasks 1 y 3.
3. **Un `.md` que pierde su `---` inicial** deja de ser documento del
   workspace en el siguiente `setDocument`: desaparece de `documents` y sus
   usuarios reciben `E032`/`E030` en el próximo `link()`. Test en task 3.
4. **Un bloque sin cerrar dentro de un ` ```flo `, o una cerca sin cerrar**,
   no se traga las cercas siguientes ni el texto fuera de ellas; el `E052`
   queda dentro de su cerca. Test en task 2.
5. **Targets de relación raros** — ruta a `.flo` sin `#bloque`, bloque
   inexistente, id fuera del catálogo, ciclo `a.md` ↔ `b.md` — dan `E035` o
   resuelven, nunca excepción; los `use` implícitos son transitivos. Test en
   task 4.

---

## File Structure

| Archivo | Responsabilidad | Task |
|---|---|---|
| `packages/core/package.json` | dependencia `yaml` | 1 |
| `packages/core/src/ast.ts` | `BlockId`, `MemoryType`, `CustomTagValue`, `Relation`, `KnowledgeMeta`, `EntityDecl.knowledge` | 1 |
| `packages/core/src/parser/yaml.ts` | `parseYamlSource` (rangos + `E061`), `isIdentifier` | 1 |
| `packages/core/src/parser/markdown.ts` | `parseMarkdownDocument`, frontmatter (task 1), cercas ` ```flo ` (task 2) | 1, 2 |
| `packages/core/src/parser/entity.ts` | `knowledge: null` en entidades `.flo` | 1 |
| `packages/core/src/workspace/xref.ts` | `BlockId` pasa a `ast.ts`; `relationsFrom`/`relationsTo` (task 4) | 1, 4 |
| `packages/core/src/workspace/schema.ts` | `SCHEMA_URI`, `parseSchema`, `checkVocabulary` | 3 |
| `packages/core/src/workspace/workspace.ts` | despacho por uri, esquema | 3 |
| `packages/core/src/workspace/resolver.ts` | vocabulario/`E068` (task 3), `use` implícitos y relaciones (task 4) | 3, 4 |
| `packages/core/src/workspace/uri.ts` | `blockId` se muda aquí (evita ciclo knowledge ↔ xref) | 4 |
| `packages/core/src/workspace/knowledge.ts` | `relationPath`, `relationUses`, `resolveRelations` | 4 |
| `packages/core/src/index.ts` | exports nuevos | 5 |
| `packages/core/GRAMMAR.md` | sección `.md`, códigos nuevos | 1–4 |
| spec 2026-09-19 §11 | decisiones #27–#30 | 1–4 |

---

### Task 1: Frontmatter → entidad del catálogo

**Files:**
- Modify: `packages/core/package.json` (vía `pnpm add`)
- Modify: `packages/core/src/ast.ts`
- Create: `packages/core/src/parser/yaml.ts`
- Create: `packages/core/src/parser/markdown.ts`
- Create: `packages/core/src/parser/markdown.test.ts`
- Modify: `packages/core/src/parser/entity.ts:134-143`
- Modify: `packages/core/src/parser/entity.test.ts:22-31`
- Modify: `packages/core/src/workspace/xref.ts:4-5`
- Modify: `packages/core/GRAMMAR.md`, spec 2026-09-19 §11

**Interfaces:**
- Consumes: `diagnosticAt`, `Diagnostic` (`src/diagnostics.ts`); tipos de `src/ast.ts`.
- Produces:
  ```ts
  // ast.ts
  export type BlockId = string; // `uri#nombre` (decisión #25)
  export type MemoryType = "working" | "short_term" | "long_term";
  export type CustomTagValue = string | number | boolean;
  export interface Relation {
    type: string;
    target: string; // tal como se escribió
    resolved: { kind: "entity"; id: EntityId } | { kind: "block"; id: BlockId } | null; // lo rellena el resolver
    range: Range; // el valor de `target`
    typeRange: Range; // el valor de `type`
  }
  export interface KnowledgeMeta {
    memoryType: MemoryType | null; // null solo si el frontmatter lo diagnosticó
    typeTags: string[];
    typeTagRanges: Range[]; // paralelo a typeTags
    contextTags: string[];
    customTags: Record<string, CustomTagValue>;
    relations: Relation[];
    body: string;
  }
  // EntityDecl gana: knowledge: KnowledgeMeta | null;

  // parser/yaml.ts
  export interface YamlSource {
    contents: unknown;
    rangeOf(node: unknown, fallback?: unknown): Range;
    diagnostics: Diagnostic[]; // E061
  }
  export function parseYamlSource(text: string, firstLine: number): YamlSource;
  export function isIdentifier(value: unknown): value is string;

  // parser/markdown.ts
  export function openingRange(): Range; // 1:1–1:4, el `---` de apertura
  export function parseMarkdownDocument(
    source: string,
    uri: DocumentUri
  ): { document: ParsedDocument; diagnostics: Diagnostic[] } | null; // null = no es documento del workspace
  ```

- [x] **Step 1: Agregar la dependencia**

Run (desde la raíz): `pnpm --filter @flo/core add yaml@^2.9.1`
Expected: `packages/core/package.json` lista `"yaml": "^2.9.1"` en `dependencies`; `pnpm-lock.yaml` actualizado.

- [x] **Step 2: Escribir los tests que fallan**

`packages/core/src/parser/markdown.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseMarkdownDocument } from "./markdown.js";
import type { Diagnostic } from "../diagnostics.js";

const DECISION = [
  "---", // 1
  "id: decision_auth", // 2
  'title: "Decisión: OAuth2 + PKCE"', // 3
  "memory_type: long_term", // 4
  "type_tags: [decision, architecture]", // 5
  'context_tags: ["project:core"]', // 6
  "custom_tags:", // 7
  "  status: approved", // 8
  "  level: 3", // 9
  'use: ["../catalogo.flo"]', // 10
  "relations:", // 11
  "  - target: api", // 12
  "    type: affects", // 13
  "---", // 14
  "", // 15
  "# Decisión", // 16
  "",
].join("\n");

const r = (sl: number, sc: number, el: number, ec: number) => ({
  start: { line: sl, column: sc },
  end: { line: el, column: ec },
});

function codes(diagnostics: Diagnostic[]) {
  return diagnostics.map((d) => [d.code, d.range.start.line]);
}

describe("parseMarkdownDocument: frontmatter", () => {
  it("turns a valid frontmatter into a catalog entity with exact ranges", () => {
    const result = parseMarkdownDocument(DECISION, "decisiones/auth.md")!;
    expect(result.diagnostics).toEqual([]);
    expect(result.document.uses).toEqual([
      { path: "../catalogo.flo", range: r(10, 7, 10, 24), pathRange: r(10, 7, 10, 24) },
    ]);
    expect(result.document.entities).toEqual([
      {
        id: "decision_auth",
        label: "Decisión: OAuth2 + PKCE",
        shape: "rectangle",
        type: null,
        tags: [],
        uri: "decisiones/auth.md",
        range: r(1, 1, 14, 4),
        nameRange: r(2, 5, 2, 18),
        knowledge: {
          memoryType: "long_term",
          typeTags: ["decision", "architecture"],
          typeTagRanges: [r(5, 13, 5, 21), r(5, 23, 5, 35)],
          contextTags: ["project:core"],
          customTags: { status: "approved", level: 3 },
          relations: [
            { type: "affects", target: "api", resolved: null, range: r(12, 13, 12, 16), typeRange: r(13, 11, 13, 18) },
          ],
          body: "\n# Decisión\n",
        },
      },
    ]);
    expect(result.document.blocks).toEqual([]);
  });

  it("gives the same ranges with CRLF line endings", () => {
    const crlf = parseMarkdownDocument(DECISION.replace(/\n/g, "\r\n"), "a.md")!;
    expect(crlf.diagnostics).toEqual([]);
    const entity = crlf.document.entities[0];
    expect(entity.nameRange).toEqual(r(2, 5, 2, 18));
    expect(entity.range).toEqual(r(1, 1, 14, 4));
    expect(entity.knowledge?.typeTagRanges).toEqual([r(5, 13, 5, 21), r(5, 23, 5, 35)]);
  });

  it("is not a workspace document without '---' on the first line", () => {
    expect(parseMarkdownDocument("# README\n", "README.md")).toBeNull();
    expect(parseMarkdownDocument("\n---\nid: a\n---\n", "a.md")).toBeNull();
    expect(parseMarkdownDocument("", "a.md")).toBeNull();
  });

  it("reports E060 when the frontmatter is never closed, and parses nothing else", () => {
    const result = parseMarkdownDocument("---\nid: a\ntitle: A\n\n```flo\nentity b\n```\n", "a.md")!;
    expect(result.diagnostics.map((d) => [d.code, d.range])).toEqual([["E060", r(1, 1, 1, 4)]]);
    expect(result.document.entities).toEqual([]);
    expect(result.document.blocks).toEqual([]);
  });

  it("reports one E062 per missing mandatory field on the opening delimiter", () => {
    const result = parseMarkdownDocument("---\n---\n", "a.md")!;
    expect(result.diagnostics.map((d) => [d.code, d.range, d.message])).toEqual([
      ["E062", r(1, 1, 1, 4), "falta el campo obligatorio 'id'"],
      ["E062", r(1, 1, 1, 4), "falta el campo obligatorio 'title'"],
      ["E062", r(1, 1, 1, 4), "falta el campo obligatorio 'memory_type'"],
    ]);
    expect(result.document.entities).toEqual([]);
  });

  it("reports YAML syntax errors as E061 and does not build the entity", () => {
    const result = parseMarkdownDocument("---\nid: a\nid: b\ntitle: A\nmemory_type: working\n---\n", "a.md")!;
    expect(codes(result.diagnostics)).toEqual([["E061", 3]]);
    expect(result.diagnostics[0].message).toMatch(/^error de sintaxis YAML: /);
    expect(result.document.entities).toEqual([]);
  });

  it("reports one diagnostic per invalid field without cascading", () => {
    const source = [
      "---", // 1
      "id: 9lives", // 2 E063
      'title: ""', // 3 E063
      "memory_type: forever", // 4 E064
      "type_tags: decision", // 5 E063
      'context_tags: [project, "a:b"]', // 6 E063 en 'project'
      "custom_tags: {a: [1]}", // 7 E063
      "relations:", // 8
      "  - target: api", // 9 E062 falta 'type' (rango del ítem)
      "    kind: x", // 10 E067
      "foo: 1", // 11 E067
      "---",
      "",
    ].join("\n");
    const result = parseMarkdownDocument(source, "a.md")!;
    expect(codes(result.diagnostics)).toEqual([
      ["E063", 2],
      ["E063", 3],
      ["E064", 4],
      ["E063", 5],
      ["E063", 6],
      ["E063", 7],
      ["E062", 9],
      ["E067", 10],
      ["E067", 11],
    ]);
    expect(result.document.entities).toEqual([]); // sin id válido no hay entidad
  });

  it("keeps the entity when only the id is valid: label falls back to the id, memoryType to null", () => {
    const result = parseMarkdownDocument("---\nid: a\ntitle: 3\nmemory_type: 1\n---\n", "a.md")!;
    expect(codes(result.diagnostics)).toEqual([
      ["E063", 3],
      ["E064", 4],
    ]);
    expect(result.document.entities[0]).toMatchObject({ id: "a", label: "a", knowledge: { memoryType: null } });
  });
});
```

En `packages/core/src/parser/entity.test.ts`, el primer test (`parses the short form with shape and properties, with exact ranges`): agregar `knowledge: null,` después de la línea `nameRange: ...` del objeto esperado.

- [x] **Step 3: Correr los tests y verificar que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/parser/markdown.test.ts src/parser/entity.test.ts`
Expected: FAIL (`./markdown.js` no existe; la entidad `.flo` no tiene `knowledge`).

- [x] **Step 4: Implementar**

`packages/core/src/ast.ts` — agregar después de `export type DocumentUri = string;`:

```ts
/** Identidad de un bloque en el workspace: `uri#nombre` (decisión #25). */
export type BlockId = string;

export type MemoryType = "working" | "short_term" | "long_term";
export type CustomTagValue = string | number | boolean;

/** Una entrada de `relations` en el frontmatter de un `.md`. */
export interface Relation {
  type: string;
  target: string; // tal como se escribió
  resolved: { kind: "entity"; id: EntityId } | { kind: "block"; id: BlockId } | null; // lo rellena el resolver
  range: Range; // el valor de `target`
  typeRange: Range; // el valor de `type`
}

/** Lo que un `.md` agrega a su entidad (spec de conocimiento §4). */
export interface KnowledgeMeta {
  memoryType: MemoryType | null; // null solo si el frontmatter lo diagnosticó
  typeTags: string[];
  typeTagRanges: Range[]; // paralelo a typeTags, para E065
  contextTags: string[]; // "clave:valor"
  customTags: Record<string, CustomTagValue>;
  relations: Relation[];
  body: string; // Markdown sin frontmatter
}
```

y en `EntityDecl`, después de `nameRange`:

```ts
  knowledge: KnowledgeMeta | null; // null en entidades declaradas en .flo
```

`packages/core/src/workspace/xref.ts` — reemplazar

```ts
/** Identidad de un bloque en el workspace: `uri#nombre` (decisión #25). */
export type BlockId = string;
```

por

```ts
import type { BlockId } from "../ast.js";
export type { BlockId };
```

(y sacar `BlockId` de cualquier otro import que lo pida a `ast.js` en ese archivo si hiciera falta; el `import type { DocumentUri, EntityId, ParsedDocument, Range }` existente queda igual).

`packages/core/src/parser/entity.ts` — en el literal `const entity: EntityDecl = { ... }`, agregar después de `nameRange: idToken.range,`:

```ts
    knowledge: null,
```

`packages/core/src/parser/yaml.ts`:

```ts
import { LineCounter, parseDocument as parseYaml } from "yaml";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { Position, Range } from "../ast.js";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/; // la misma regla que el IDENT del lexer

export function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENT.test(value);
}

export interface YamlSource {
  contents: unknown;
  /** Rango de un nodo (sin comentarios de cola); el de `fallback` si el nodo falta o está vacío. */
  rangeOf(node: unknown, fallback?: unknown): Range;
  /** Errores de sintaxis del YAML (E061). */
  diagnostics: Diagnostic[];
}

type YamlSpan = { range?: [number, number, number] | null } | null | undefined;

/** `text` empieza en la línea `firstLine` del archivo, columna 1. */
export function parseYamlSource(text: string, firstLine: number): YamlSource {
  const lineCounter = new LineCounter();
  const doc = parseYaml(text, { lineCounter });

  const position = (offset: number): Position => {
    const { line, col } = lineCounter.linePos(offset);
    return { line: line + firstLine - 1, column: col };
  };
  const span = (node: unknown): [number, number] | null => {
    const range = (node as YamlSpan)?.range;
    return range && range[1] > range[0] ? [range[0], range[1]] : null;
  };

  return {
    contents: doc.contents,
    rangeOf(node, fallback) {
      const [start, end] = span(node) ?? span(fallback) ?? [0, 0];
      return { start: position(start), end: position(end) };
    },
    diagnostics: doc.errors.map((error) =>
      diagnosticAt("E061", `error de sintaxis YAML: ${yamlMessage(error.message)}`, {
        start: position(error.pos[0]),
        end: position(error.pos[1]),
      })
    ),
  };
}

// Los mensajes de `yaml` traen la posición y un extracto del fuente; el
// Range ya lleva la posición.
function yamlMessage(message: string): string {
  return message.split("\n")[0].replace(/ at line \d+, column \d+:?$/, "");
}
```

`packages/core/src/parser/markdown.ts`:

```ts
import { isMap, isScalar, isSeq } from "yaml";
import { diagnosticAt, sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import { isIdentifier, parseYamlSource, type YamlSource } from "./yaml.js";
import type {
  CustomTagValue,
  DocumentUri,
  EntityDecl,
  KnowledgeMeta,
  MemoryType,
  ParsedDocument,
  Range,
  UseDecl,
} from "../ast.js";

const MEMORY_TYPES: readonly string[] = ["working", "short_term", "long_term"];
const REQUIRED = ["id", "title", "memory_type"];
const CONTEXT_TAG = /^[^:]+:.+$/;

/** El `---` de apertura: ancla de E060, E062 y del E068 por esquema ausente. */
export function openingRange(): Range {
  return { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } };
}

function isDelimiter(line: string): boolean {
  return line.trimEnd() === "---";
}

/**
 * Un `.md` del workspace (spec de conocimiento §3). Devuelve null si la
 * primera línea no es `---`: no es un documento del workspace (decisión
 * #21). Su entidad va primera en `entities` (decisión #22).
 */
export function parseMarkdownDocument(
  source: string,
  uri: DocumentUri
): { document: ParsedDocument; diagnostics: Diagnostic[] } | null {
  const lines = source.split("\n");
  if (!isDelimiter(lines[0])) return null;

  const document: ParsedDocument = { uri, uses: [], entities: [], blocks: [] };
  const diagnostics: Diagnostic[] = [];
  const close = lines.findIndex((line, index) => index > 0 && isDelimiter(line));
  if (close === -1) {
    diagnostics.push(diagnosticAt("E060", "falta el '---' que cierra el frontmatter", openingRange()));
    return { document, diagnostics };
  }

  const yaml = parseYamlSource(lines.slice(1, close).join("\n"), 2);
  const range: Range = { start: { line: 1, column: 1 }, end: { line: close + 1, column: 4 } };
  const body = lines.slice(close + 1).join("\n");
  const entity = readFrontmatter(yaml, uri, range, body, document.uses, diagnostics);
  if (entity) document.entities.push(entity);

  return { document, diagnostics: sortDiagnostics(diagnostics) };
}

/**
 * Valida el frontmatter campo por campo (decisión #27): un campo inválido
 * da un diagnóstico y no impide leer los demás. Hay entidad si y solo si
 * `id` es válido; con un error de sintaxis YAML no se valida nada.
 */
function readFrontmatter(
  yaml: YamlSource,
  uri: DocumentUri,
  range: Range,
  body: string,
  uses: UseDecl[],
  diagnostics: Diagnostic[]
): EntityDecl | null {
  diagnostics.push(...yaml.diagnostics);
  if (yaml.diagnostics.length > 0) return null;

  // Un frontmatter vacío (`---` seguido de `---`) es un mapa sin campos.
  const contents = isMap(yaml.contents) ? yaml.contents : null;
  if (yaml.contents !== null && contents === null) {
    diagnostics.push(diagnosticAt("E063", "el frontmatter debe ser un mapa de campos", yaml.rangeOf(yaml.contents)));
    return null;
  }

  const invalid = (node: unknown, message: string, fallback?: unknown): void => {
    diagnostics.push(diagnosticAt("E063", message, yaml.rangeOf(node, fallback)));
  };
  const listOf = (node: unknown, key: string, fallback: unknown): unknown[] => {
    if (isSeq(node)) return node.items;
    invalid(node, `'${key}' debe ser una lista`, fallback);
    return [];
  };

  const knowledge: KnowledgeMeta = {
    memoryType: null,
    typeTags: [],
    typeTagRanges: [],
    contextTags: [],
    customTags: {},
    relations: [],
    body,
  };
  let id: { value: string; range: Range } | null = null;
  let title: string | null = null;
  const present = new Set<string>();

  for (const pair of contents?.items ?? []) {
    const key = isScalar(pair.key) ? String(pair.key.value) : "?";
    const value = pair.value;
    present.add(key);
    switch (key) {
      case "id":
        if (isScalar(value) && isIdentifier(value.value)) id = { value: value.value, range: yaml.rangeOf(value) };
        else invalid(value, "'id' debe ser un identificador: letras, dígitos y '_', sin empezar con dígito", pair.key);
        break;
      case "title":
        if (isScalar(value) && typeof value.value === "string" && value.value.trim() !== "") title = value.value;
        else invalid(value, "'title' debe ser un texto no vacío", pair.key);
        break;
      case "memory_type":
        if (isScalar(value) && MEMORY_TYPES.includes(value.value as string)) {
          knowledge.memoryType = value.value as MemoryType;
        } else {
          diagnostics.push(
            diagnosticAt(
              "E064",
              "'memory_type' debe ser 'working', 'short_term' o 'long_term'",
              yaml.rangeOf(value, pair.key)
            )
          );
        }
        break;
      case "type_tags":
        for (const item of listOf(value, key, pair.key)) {
          if (isScalar(item) && isIdentifier(item.value)) {
            knowledge.typeTags.push(item.value);
            knowledge.typeTagRanges.push(yaml.rangeOf(item));
          } else {
            invalid(item, "cada 'type_tags' debe ser un identificador");
          }
        }
        break;
      case "context_tags":
        for (const item of listOf(value, key, pair.key)) {
          if (isScalar(item) && typeof item.value === "string" && CONTEXT_TAG.test(item.value)) {
            knowledge.contextTags.push(item.value);
          } else {
            invalid(item, "cada 'context_tags' debe tener la forma 'clave:valor'");
          }
        }
        break;
      case "custom_tags":
        if (!isMap(value)) {
          invalid(value, "'custom_tags' debe ser un mapa de clave a valor", pair.key);
          break;
        }
        for (const tag of value.items) {
          const tagValue = isScalar(tag.value) ? tag.value.value : undefined;
          if (isScalar(tag.key) && ["string", "number", "boolean"].includes(typeof tagValue)) {
            knowledge.customTags[String(tag.key.value)] = tagValue as CustomTagValue;
          } else {
            invalid(tag.value, "cada valor de 'custom_tags' debe ser un texto, un número o un booleano", tag.key);
          }
        }
        break;
      case "use":
        for (const item of listOf(value, key, pair.key)) {
          if (isScalar(item) && typeof item.value === "string" && item.value !== "") {
            const itemRange = yaml.rangeOf(item);
            uses.push({ path: item.value, range: itemRange, pathRange: itemRange });
          } else {
            invalid(item, "cada 'use' debe ser una ruta");
          }
        }
        break;
      case "relations":
        for (const item of listOf(value, key, pair.key)) readRelation(yaml, item, knowledge, diagnostics);
        break;
      default:
        diagnostics.push(diagnosticAt("E067", `campo desconocido '${key}' en el frontmatter`, yaml.rangeOf(pair.key)));
    }
  }

  for (const field of REQUIRED) {
    if (!present.has(field)) {
      diagnostics.push(diagnosticAt("E062", `falta el campo obligatorio '${field}'`, openingRange()));
    }
  }

  if (!id) return null;
  return {
    id: id.value,
    label: title ?? id.value,
    shape: "rectangle",
    type: null,
    tags: [],
    uri,
    range,
    nameRange: id.range,
    knowledge,
  };
}

/** `{ target, type }`; solo entra a `relations` si ambos son válidos. */
function readRelation(yaml: YamlSource, item: unknown, knowledge: KnowledgeMeta, diagnostics: Diagnostic[]): void {
  if (!isMap(item)) {
    diagnostics.push(diagnosticAt("E063", "cada relación debe ser un mapa con 'target' y 'type'", yaml.rangeOf(item)));
    return;
  }
  let target: unknown = undefined;
  let type: unknown = undefined;
  const keys = new Map<string, unknown>();
  for (const pair of item.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : "?";
    if (key === "target" || key === "type") {
      keys.set(key, pair.key);
      if (key === "target") target = pair.value;
      else type = pair.value;
    } else {
      diagnostics.push(diagnosticAt("E067", `campo desconocido '${key}' en la relación`, yaml.rangeOf(pair.key)));
    }
  }
  for (const field of ["target", "type"]) {
    if (!keys.has(field)) {
      diagnostics.push(diagnosticAt("E062", `a la relación le falta '${field}'`, yaml.rangeOf(item)));
    }
  }
  if (!keys.has("target") || !keys.has("type")) return;

  const targetNode = isScalar(target) && typeof target.value === "string" && target.value !== "" ? target : null;
  const typeNode = isScalar(type) && isIdentifier(type.value) ? type : null;
  if (!targetNode) {
    diagnostics.push(diagnosticAt("E063", "'target' debe ser una ruta o un id", yaml.rangeOf(target, keys.get("target"))));
  }
  if (!typeNode) {
    diagnostics.push(diagnosticAt("E063", "'type' debe ser un identificador", yaml.rangeOf(type, keys.get("type"))));
  }
  if (!targetNode || !typeNode) return;
  knowledge.relations.push({
    type: typeNode.value as string,
    target: targetNode.value as string,
    resolved: null,
    range: yaml.rangeOf(targetNode),
    typeRange: yaml.rangeOf(typeNode),
  });
}
```

- [x] **Step 5: Correr la suite del core**

Run: `pnpm --filter @flo/core exec vitest run && pnpm --filter @flo/core typecheck`
Expected: PASS. Si otro test compara una `EntityDecl` completa con `toEqual`
y falla por `knowledge`, agregarle `knowledge: null` (nada más).

- [x] **Step 6: GRAMMAR.md y §11**

`packages/core/GRAMMAR.md` — antes de `## Fuera de esta gramática`, agregar:

````markdown
## Documentos `.md` de conocimiento

Un `.md` es documento del workspace solo si su primera línea es `---`
(decisión #21); el frontmatter termina en la siguiente línea `---`. Es YAML
(dependencia `yaml`) y declara una entidad del catálogo:

```yaml
---
id: decision_auth        # obligatorio, identificador (misma regla que IDENT)
title: "OAuth2 + PKCE"   # obligatorio, texto no vacío → label
memory_type: long_term   # obligatorio: working | short_term | long_term
type_tags: [decision]    # identificadores declarados en el esquema
context_tags: ["project:core"]  # 'clave:valor'
custom_tags: { status: approved, level: 3 }  # escalares
use: ["../catalogo.flo"] # como 'use' en .flo
relations:
  - target: api          # id, ruta a .md, o ruta a bloque 'x.flo#nombre'
    type: affects        # declarado en el esquema
---
```

La entidad es un rectángulo con `title` como label; su `range` es el
frontmatter completo y su `nameRange` el valor de `id`.
````

y en la tabla de diagnósticos, después de `E052`:

```markdown
| E060 | markdown | frontmatter sin cerrar (falta el `---` final) |
| E061 | markdown / esquema | error de sintaxis YAML |
| E062 | markdown | falta un campo obligatorio (`id`, `title`, `memory_type`; `target`/`type` de una relación) |
| E063 | markdown | valor con tipo inválido para su campo |
| E064 | markdown | `memory_type` fuera de `working`, `short_term`, `long_term` |
| E067 | markdown | campo de frontmatter (o de relación) desconocido |
```

Al final de `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`:

```markdown

### Decisiones de la Fase K1 (2026-09-28)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 27 | 2026-09-28 | **Recuperación del frontmatter.** Cada campo inválido da un diagnóstico y no impide validar los demás. Hay entidad si y solo si `id` es válido; `title` inválido ⇒ label = id; `memory_type` inválido (cualquier valor fuera del enum, también no-strings: `E064`) ⇒ `memoryType: null`. Con un `E061` no se valida nada del frontmatter; con `E060` no se parsea nada del archivo. `E062` (y el `E068` por esquema ausente) se anclan en el `---` de apertura (1:1–1:4); a una relación sin `target`/`type` le corresponde `E062` en el rango del ítem, y una clave desconocida en una relación es `E067`. Rangos: `Relation.range` = valor de `target`, `Relation.typeRange` = valor de `type`, `KnowledgeMeta.typeTagRanges` paralelo a `typeTags`. | parser (K1), MCP `write_node` (K3), renombrar (F) |
```

- [x] **Step 7: Commit**

```bash
git add packages/core pnpm-lock.yaml docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "feat(core): frontmatter de .md como entidad del catálogo (E060-E064, E067)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Bloques ` ```flo ` embebidos

**Files:**
- Modify: `packages/core/src/parser/markdown.ts`
- Modify: `packages/core/src/parser/markdown.test.ts`
- Modify: `packages/core/GRAMMAR.md`, spec 2026-09-19 §11

**Interfaces:**
- Consumes: `parseDocument(source, uri): { document: ParsedDocument; diagnostics: Diagnostic[] }` de `src/parser/document.ts`; `parseMarkdownDocument` de la task 1.
- Produces: `parseMarkdownDocument` agrega a `document.uses`/`entities`/`blocks` lo de cada cerca ` ```flo `, en orden de aparición, después de la entidad del frontmatter. Sin cambios de firma.

- [x] **Step 1: Escribir los tests que fallan**

Agregar a `packages/core/src/parser/markdown.test.ts`:

```ts
describe("parseMarkdownDocument: embedded flo blocks", () => {
  const source = [
    "---", // 1
    "id: nota", // 2
    "title: Nota", // 3
    "memory_type: working", // 4
    "---", // 5
    "Texto.", // 6
    "```flo", // 7
    "entity api [API]", // 8
    "flow pkce {", // 9
    "  nota -> api", // 10
    "}", // 11
    "```", // 12
    "~~~", // 13  cerca de otro tipo: lo de adentro no es flo
    "```flo", // 14
    "entity oculto", // 15
    "~~~", // 16
    "```ts", // 17
    "entity tampoco", // 18
    "```", // 19
    "```flo", // 20
    "flow roto {", // 21  sin '}': E052 dentro de su cerca
    "  api -> nota", // 22
    "```", // 23
    "```flo extra", // 24  el info-string es la primera palabra
    "entity cola", // 25
    "```", // 26
    "",
  ].join("\n");

  it("parses each flo fence with exact ranges, after the frontmatter entity", () => {
    const { document, diagnostics } = parseMarkdownDocument(source, "notas/nota.md")!;
    expect(document.entities.map((e) => [e.id, e.uri])).toEqual([
      ["nota", "notas/nota.md"],
      ["api", "notas/nota.md"],
      ["cola", "notas/nota.md"],
    ]);
    expect(document.entities[1].nameRange).toEqual(r(8, 8, 8, 11));
    expect(document.blocks.map((b) => b.name)).toEqual(["pkce", "roto"]);
    expect(document.blocks[0].edges[0].from.range).toEqual(r(10, 3, 10, 7));
    expect(document.blocks[1].edges.map((e) => [e.from.name, e.to.name])).toEqual([["api", "nota"]]);
    expect(diagnostics.map((d) => [d.code, d.range.start.line, d.range.start.column])).toEqual([["E052", 21, 11]]);
  });

  it("runs an unclosed fence to the end of the file", () => {
    const { document, diagnostics } = parseMarkdownDocument(
      "---\nid: a\ntitle: A\nmemory_type: working\n---\n```flo\nentity z\n",
      "a.md"
    )!;
    expect(diagnostics).toEqual([]);
    expect(document.entities.map((e) => [e.id, e.nameRange.start.line])).toEqual([
      ["a", 2],
      ["z", 7],
    ]);
  });

  it("parses fences even when the frontmatter has no valid id", () => {
    const { document } = parseMarkdownDocument("---\ntitle: A\n---\n```flo\nentity z\n```\n", "a.md")!;
    expect(document.entities.map((e) => e.id)).toEqual(["z"]);
  });
});
```

- [x] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/parser/markdown.test.ts`
Expected: FAIL (las cercas se ignoran: solo aparece la entidad del frontmatter).

- [x] **Step 3: Implementar**

En `packages/core/src/parser/markdown.ts`, agregar el import:

```ts
import { parseDocument } from "./document.js";
```

las funciones:

```ts
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;

function closesFence(line: string, marker: string): boolean {
  const match = FENCE_CLOSE.exec(line);
  return match !== null && match[1][0] === marker[0] && match[1].length >= marker.length;
}

/**
 * Líneas de contenido `[start, end)` (índices 0-based) de cada bloque de
 * código cercado cuyo info-string es `flo` (decisión #28). Una cerca sin
 * cerrar llega a fin de archivo, como en CommonMark; lo de adentro de
 * cualquier cerca no abre otra.
 */
function floFences(lines: string[], from: number): { start: number; end: number }[] {
  const fences: { start: number; end: number }[] = [];
  for (let index = from; index < lines.length; index++) {
    const open = FENCE_OPEN.exec(lines[index]);
    if (!open) continue;
    let end = index + 1;
    while (end < lines.length && !closesFence(lines[end], open[1])) end++;
    if (open[2] === "flo") fences.push({ start: index + 1, end });
    index = end;
  }
  return fences;
}
```

y en `parseMarkdownDocument`, entre `if (entity) document.entities.push(entity);` y el `return` final:

```ts
  // Cada cerca se parsea sola (un bloque sin cerrar no se traga la
  // siguiente) sobre líneas vacías hasta su posición: los rangos salen
  // exactos sin desplazar nada.
  for (const fence of floFences(lines, close + 1)) {
    const embedded = parseDocument("\n".repeat(fence.start) + lines.slice(fence.start, fence.end).join("\n"), uri);
    document.uses.push(...embedded.document.uses);
    document.entities.push(...embedded.document.entities);
    document.blocks.push(...embedded.document.blocks);
    diagnostics.push(...embedded.diagnostics);
  }
```

- [x] **Step 4: Correr la suite del core**

Run: `pnpm --filter @flo/core exec vitest run && pnpm --filter @flo/core typecheck`
Expected: PASS.

- [x] **Step 5: GRAMMAR.md y §11**

En `packages/core/GRAMMAR.md`, al final de la sección `## Documentos .md de conocimiento`:

```markdown
Cada bloque de código cercado (` ``` ` o `~~~`) cuyo info-string empieza
con la palabra `flo` se parsea como un `.flo` con el uri del `.md`, con sus
líneas y columnas reales. Sus entidades van después de la del frontmatter
(decisión #22). Los demás bloques de código se ignoran.
```

En la tabla "Decisiones de la Fase K1" de §11, agregar la fila:

```markdown
| 28 | 2026-09-28 | **Bloques ` ```flo ` embebidos.** Cada cerca se parsea por separado con `parseDocument` (un `flow` sin `}` no se traga la cerca siguiente; su `E052` queda dentro). El contenido se toma sin quitar indentación, así las columnas son las del archivo. Una cerca sin cerrar llega a fin de archivo (CommonMark); lo de adentro de cualquier cerca no abre otra. El info-string se compara por su primera palabra (` ```flo titulo ` cuenta). Se parsean aunque el frontmatter no tenga entidad. | parser (K1), `full+diagrams` (K2) |
```

- [x] **Step 6: Commit**

```bash
git add packages/core docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "feat(core): bloques flo embebidos en .md

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Esquema, despacho por uri y vocabulario

**Files:**
- Create: `packages/core/src/workspace/schema.ts`
- Create: `packages/core/src/workspace/schema.test.ts`
- Modify: `packages/core/src/workspace/workspace.ts`
- Modify: `packages/core/src/workspace/workspace.test.ts`
- Modify: `packages/core/src/workspace/resolver.ts:30` (firma) y antes del `sortDiagnostics` final
- Modify: `packages/core/GRAMMAR.md`, spec 2026-09-19 §11

**Interfaces:**
- Consumes: `parseYamlSource`, `isIdentifier` (task 1); `parseMarkdownDocument`, `openingRange` (tasks 1–2).
- Produces:
  ```ts
  // workspace/schema.ts
  export const SCHEMA_URI = "knowledge.schema.yaml";
  export interface KnowledgeSchema { typeTags: Set<string>; relationTypes: Set<string> }
  /** "missing" = no hay documento de esquema; "invalid" = lo hay y tiene diagnósticos. */
  export type Vocabulary = KnowledgeSchema | "missing" | "invalid";
  export function parseSchema(source: string): { schema: KnowledgeSchema | null; diagnostics: Diagnostic[] };
  export function checkVocabulary(document: ParsedDocument, schema: KnowledgeSchema, diagnostics: Diagnostic[]): void;

  // workspace/resolver.ts
  export function linkDocuments(input: ParsedDocument[], vocabulary?: Vocabulary /* = "missing" */): LinkedDocuments;
  ```
  `Workspace.setDocument(uri, source)`: `uri === SCHEMA_URI` → esquema; uri
  que termina en `.md` → `parseMarkdownDocument` (null ⇒ el uri deja de ser
  documento); resto → `parseDocument`. `LinkResult.diagnostics` incluye
  `SCHEMA_URI` (al final) si hay esquema cargado; `LinkResult.documents` no.

- [x] **Step 1: Escribir los tests que fallan**

`packages/core/src/workspace/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSchema } from "./schema.js";
import type { Diagnostic } from "../diagnostics.js";

function codes(diagnostics: Diagnostic[]) {
  return diagnostics.map((d) => [d.code, d.range.start.line, d.range.start.column]);
}

describe("parseSchema", () => {
  it("reads both vocabularies", () => {
    const { schema, diagnostics } = parseSchema("type_tags: [decision, architecture]\nrelation_types: [affects]\n");
    expect(diagnostics).toEqual([]);
    expect([...schema!.typeTags]).toEqual(["decision", "architecture"]);
    expect([...schema!.relationTypes]).toEqual(["affects"]);
  });

  it("reports structural problems as E068, sorted, and yields no schema", () => {
    const { schema, diagnostics } = parseSchema("type_tags: decision\nextra: 1\n");
    expect(schema).toBeNull();
    expect(codes(diagnostics)).toEqual([
      ["E068", 1, 1], // falta 'relation_types'
      ["E068", 1, 12], // 'type_tags' no es lista
      ["E068", 2, 1], // clave desconocida
    ]);
  });

  it("reports non-identifier values and an empty file as E068", () => {
    expect(codes(parseSchema("type_tags: [ok, 3]\nrelation_types: []\n").diagnostics)).toEqual([["E068", 1, 17]]);
    expect(codes(parseSchema("").diagnostics)).toEqual([["E068", 1, 1]]);
  });

  it("reports YAML syntax errors as E061", () => {
    const { schema, diagnostics } = parseSchema("type_tags: [a\n");
    expect(schema).toBeNull();
    expect(diagnostics.map((d) => d.code)).toEqual(["E061"]);
  });
});
```

Agregar a `packages/core/src/workspace/workspace.test.ts` (import nuevo:
`import { SCHEMA_URI } from "./schema.js";`):

```ts
const SCHEMA = "type_tags: [decision]\nrelation_types: [affects]\n";
const note = (id: string, extra: string[] = []) =>
  ["---", `id: ${id}`, `title: ${id}`, "memory_type: long_term", ...extra, "---", ""].join("\n");

describe("Workspace with .md documents", () => {
  it("lets a flow use the entity of a .md, transitively through its 'use:'", () => {
    const result = workspace({
      [SCHEMA_URI]: SCHEMA,
      "catalogo.flo": "entity api\n",
      "notas/pkce.md": note("pkce", ['use: ["../catalogo.flo"]']),
      "flujo.flo": 'use "./notas/pkce.md"\nflow f {\n  pkce -> api\n}\n',
    }).link();
    for (const list of result.diagnostics.values()) expect(list).toEqual([]);
    expect([...result.documents.keys()]).toEqual(["catalogo.flo", "flujo.flo", "notas/pkce.md"]);
    expect([...result.documents.get("flujo.flo")!.catalog.keys()]).toEqual(["api", "pkce"]);
    expect(result.xref.flowsUsing("pkce")).toEqual(["flujo.flo#f"]);
    expect(result.diagnostics.get(SCHEMA_URI)).toEqual([]);
  });

  it("does not cascade from a partially invalid frontmatter", () => {
    const result = workspace({
      [SCHEMA_URI]: SCHEMA,
      "n.md": "---\nid: n\ntitle: 3\nmemory_type: nope\n---\n",
      "f.flo": 'use "./n.md"\nflow f {\n  n -> n\n}\n',
    }).link();
    expect(codes(result.diagnostics.get("n.md"))).toEqual([
      ["E063", 3, 8],
      ["E064", 4, 14],
    ]);
    expect(result.diagnostics.get("f.flo")).toEqual([]);
  });

  it("validates type_tags and relation types against the schema", () => {
    const result = workspace({
      [SCHEMA_URI]: SCHEMA,
      "catalogo.flo": "entity api\n",
      "n.md": note("n", [
        "type_tags: [decision, nope]", // 5
        'use: ["./catalogo.flo"]', // 6
        "relations:", // 7
        "  - target: api", // 8
        "    type: breaks", // 9
      ]),
    }).link();
    expect(codes(result.diagnostics.get("n.md"))).toEqual([
      ["E065", 5, 23],
      ["E066", 9, 11],
    ]);
  });

  it("reports a single E068 on the first .md when there is no schema, and skips vocabulary", () => {
    const result = workspace({
      "b.md": note("b", ["type_tags: [whatever]"]),
      "a.md": note("a", ["type_tags: [whatever]"]),
    }).link();
    expect(codes(result.diagnostics.get("a.md"))).toEqual([["E068", 1, 1]]);
    expect(result.diagnostics.get("b.md")).toEqual([]);
    expect(result.diagnostics.has(SCHEMA_URI)).toBe(false);
  });

  it("reports an invalid schema on the schema document only", () => {
    const result = workspace({
      [SCHEMA_URI]: "type_tags: x\nrelation_types: []\n",
      "a.md": note("a", ["type_tags: [whatever]"]),
    }).link();
    expect(codes(result.diagnostics.get(SCHEMA_URI))).toEqual([["E068", 1, 12]]);
    expect(result.diagnostics.get("a.md")).toEqual([]);
    expect(result.documents.has(SCHEMA_URI)).toBe(false);
  });

  it("brings E068 back after the schema is removed", () => {
    const ws = workspace({ [SCHEMA_URI]: SCHEMA, "a.md": note("a") });
    expect(ws.link().diagnostics.get("a.md")).toEqual([]);
    ws.removeDocument(SCHEMA_URI);
    const result = ws.link();
    expect(codes(result.diagnostics.get("a.md"))).toEqual([["E068", 1, 1]]);
    expect(result.diagnostics.has(SCHEMA_URI)).toBe(false);
  });

  it("ignores a .md without frontmatter, also when an existing one loses it", () => {
    const ws = workspace({
      [SCHEMA_URI]: SCHEMA,
      "README.md": "# hola\n",
      "n.md": note("n"),
      "f.flo": 'use "./n.md"\nflow f {\n  n -> n\n}\n',
    });
    expect(ws.link().documents.has("README.md")).toBe(false);
    ws.setDocument("n.md", "# ya no tiene frontmatter\n");
    const result = ws.link();
    expect(result.documents.has("n.md")).toBe(false);
    expect(result.diagnostics.has("n.md")).toBe(false);
    expect(codes(result.diagnostics.get("f.flo")).map(([code]) => code)).toEqual(["E032", "E030", "E030"]);
  });
});
```

- [x] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/workspace`
Expected: FAIL (`./schema.js` no existe; los `.md` se parsean como `.flo`).

- [x] **Step 3: Implementar**

`packages/core/src/workspace/schema.ts`:

```ts
import { isMap, isScalar, isSeq } from "yaml";
import { isIdentifier, parseYamlSource } from "../parser/yaml.js";
import { diagnosticAt, sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { ParsedDocument } from "../ast.js";

/** El esquema vive en la raíz del workspace con este uri exacto (decisión #20). */
export const SCHEMA_URI = "knowledge.schema.yaml";

export interface KnowledgeSchema {
  typeTags: Set<string>;
  relationTypes: Set<string>;
}

/** "missing" = no hay documento de esquema; "invalid" = lo hay y tiene diagnósticos. */
export type Vocabulary = KnowledgeSchema | "missing" | "invalid";

const FIELDS = { type_tags: "typeTags", relation_types: "relationTypes" } as const;

/** `type_tags` y `relation_types`, ambas listas de identificadores y obligatorias. */
export function parseSchema(source: string): { schema: KnowledgeSchema | null; diagnostics: Diagnostic[] } {
  const yaml = parseYamlSource(source, 1);
  if (yaml.diagnostics.length > 0) return { schema: null, diagnostics: yaml.diagnostics };

  const diagnostics: Diagnostic[] = [];
  const invalid = (node: unknown, message: string, fallback?: unknown): void => {
    diagnostics.push(diagnosticAt("E068", message, yaml.rangeOf(node, fallback)));
  };
  const schema: KnowledgeSchema = { typeTags: new Set(), relationTypes: new Set() };

  if (!isMap(yaml.contents)) {
    invalid(yaml.contents, "el esquema debe ser un mapa con 'type_tags' y 'relation_types'");
    return { schema: null, diagnostics };
  }
  const present = new Set<string>();
  for (const pair of yaml.contents.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : "?";
    if (key !== "type_tags" && key !== "relation_types") {
      invalid(pair.key, `campo desconocido '${key}' en el esquema`);
      continue;
    }
    present.add(key);
    if (!isSeq(pair.value)) {
      invalid(pair.value, `'${key}' debe ser una lista de identificadores`, pair.key);
      continue;
    }
    for (const item of pair.value.items) {
      if (isScalar(item) && isIdentifier(item.value)) schema[FIELDS[key]].add(item.value);
      else invalid(item, `cada valor de '${key}' debe ser un identificador`);
    }
  }
  for (const key of Object.keys(FIELDS)) {
    if (!present.has(key)) invalid(null, `falta '${key}' en el esquema`);
  }
  return { schema: diagnostics.length === 0 ? schema : null, diagnostics: sortDiagnostics(diagnostics) };
}

/** E065 / E066 para las entidades de conocimiento de un documento. */
export function checkVocabulary(document: ParsedDocument, schema: KnowledgeSchema, diagnostics: Diagnostic[]): void {
  for (const entity of document.entities) {
    const knowledge = entity.knowledge;
    if (!knowledge) continue;
    knowledge.typeTags.forEach((tag, index) => {
      if (!schema.typeTags.has(tag)) {
        diagnostics.push(
          diagnosticAt("E065", `el type_tag '${tag}' no está declarado en '${SCHEMA_URI}'`, knowledge.typeTagRanges[index])
        );
      }
    });
    for (const relation of knowledge.relations) {
      if (!schema.relationTypes.has(relation.type)) {
        diagnostics.push(
          diagnosticAt("E066", `el tipo de relación '${relation.type}' no está declarado en '${SCHEMA_URI}'`, relation.typeRange)
        );
      }
    }
  }
}
```

`packages/core/src/workspace/resolver.ts`:

- imports nuevos:
  ```ts
  import { openingRange } from "../parser/markdown.js";
  import { SCHEMA_URI, checkVocabulary, type Vocabulary } from "./schema.js";
  ```
- firma: `export function linkDocuments(input: ParsedDocument[], vocabulary: Vocabulary = "missing"): LinkedDocuments {`
- en el doc-comment, agregar: "Valida el vocabulario de los `.md` contra el esquema (E065, E066) o reporta su ausencia (E068)."
- antes de `for (const list of diagnostics.values()) sortDiagnostics(list);`:

```ts
  if (vocabulary === "missing") {
    // Un solo E068, en el primer .md por uri (decisión #29).
    const first = documents.find((d) => d.uri.endsWith(".md"));
    if (first) {
      diagnostics
        .get(first.uri)!
        .push(
          diagnosticAt(
            "E068",
            `falta '${SCHEMA_URI}' en la raíz del workspace: no se validan 'type_tags' ni los tipos de relación`,
            openingRange()
          )
        );
    }
  } else if (vocabulary !== "invalid") {
    for (const document of documents) checkVocabulary(document, vocabulary, diagnostics.get(document.uri)!);
  }
```

`packages/core/src/workspace/workspace.ts`:

- imports nuevos:
  ```ts
  import { parseMarkdownDocument } from "../parser/markdown.js";
  import { SCHEMA_URI, parseSchema, type KnowledgeSchema } from "./schema.js";
  ```
- en `LinkResult.diagnostics`, cambiar el comentario a: `/** Lexer, parser y resolución, por documento y ordenados por posición; el esquema, si está cargado, al final. */`
- en la clase:

```ts
  private schema: { schema: KnowledgeSchema | null; diagnostics: Diagnostic[] } | null = null;

  /**
   * El parser se elige por uri (decisión #29): `knowledge.schema.yaml` es el
   * esquema, un `.md` es conocimiento y todo lo demás es `.flo`. Un `.md`
   * sin `---` inicial no es documento: si lo era, deja de serlo.
   */
  setDocument(uri: DocumentUri, source: string): void {
    if (uri === SCHEMA_URI) {
      this.schema = parseSchema(source);
      return;
    }
    const parsed = uri.endsWith(".md") ? parseMarkdownDocument(source, uri) : parseDocument(source, uri);
    if (parsed) this.parsed.set(uri, parsed);
    else this.parsed.delete(uri);
  }

  removeDocument(uri: DocumentUri): void {
    if (uri === SCHEMA_URI) this.schema = null;
    else this.parsed.delete(uri);
  }
```

- en `link()`:
  - `const linked = linkDocuments(parsed.map((p) => p.document), this.schema === null ? "missing" : (this.schema.schema ?? "invalid"));`
  - después del `for` que llena `documents`/`diagnostics`: `if (this.schema) diagnostics.set(SCHEMA_URI, this.schema.diagnostics);`

- [x] **Step 4: Correr la suite del core**

Run: `pnpm --filter @flo/core exec vitest run && pnpm --filter @flo/core typecheck`
Expected: PASS.

- [x] **Step 5: GRAMMAR.md y §11**

En `packages/core/GRAMMAR.md`, al final de la sección de `.md`:

````markdown
El vocabulario vive en `knowledge.schema.yaml`, en la raíz del workspace
(uri exacto):

```yaml
type_tags: [architecture, business_rule, decision, incident, pattern]
relation_types: [enforces, visualized_by, affects, supersedes]
```

Ambas claves son obligatorias y listas de identificadores. Sin esquema, el
primer `.md` (por uri) lleva un único `E068` y no se valida vocabulario; con
un esquema inválido, los diagnósticos van en el esquema y tampoco se valida.
````

y en la tabla, después de `E064`:

```markdown
| E065 | esquema | `type_tag` no declarado en el esquema |
| E066 | esquema | tipo de relación no declarado en el esquema |
```

y después de `E067`:

```markdown
| E068 | esquema | falta `knowledge.schema.yaml` o su contenido es inválido |
```

En la tabla "Decisiones de la Fase K1" de §11:

```markdown
| 29 | 2026-09-28 | **Despacho por uri y esquema.** `Workspace.setDocument` elige el parser por uri: exactamente `knowledge.schema.yaml` → esquema; termina en `.md` → conocimiento (sin `---` inicial el uri deja de ser documento, también si lo era); todo lo demás → `.flo`. El esquema no está en `LinkResult.documents`; sus diagnósticos sí, al final de `LinkResult.diagnostics`. Ambas claves del esquema son obligatorias. Esquema ausente ⇒ un único `E068` en el primer `.md` por uri (decisión #24), anclado en su `---`; esquema con diagnósticos (`E061`/`E068` en él) ⇒ no se valida vocabulario y no se repite `E068` en los `.md`. | workspace (K1), carga de carpeta (K3, F) |
```

- [x] **Step 6: Commit**

```bash
git add packages/core docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "feat(core): .md y esquema de conocimiento en el Workspace (E065, E066, E068)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Relaciones — `use` implícito, `E035` e índice

**Files:**
- Create: `packages/core/src/workspace/knowledge.ts`
- Create: `packages/core/src/workspace/knowledge.test.ts`
- Modify: `packages/core/src/workspace/uri.ts` (recibe `blockId`)
- Modify: `packages/core/src/workspace/xref.ts`
- Modify: `packages/core/src/workspace/xref.test.ts`
- Modify: `packages/core/src/workspace/resolver.ts`
- Modify: `packages/core/src/workspace/workspace.test.ts`
- Modify: `packages/core/GRAMMAR.md`, spec 2026-09-19 §11

**Interfaces:**
- Consumes: `Relation`, `BlockId` (task 1); `resolveUse(from, path): DocumentUri | null` (`workspace/uri.ts`); `linkDocuments` con `vocabulary` (task 3).
- Produces:
  ```ts
  // workspace/uri.ts (movido desde xref.ts; xref.ts lo re-exporta, index.ts no cambia)
  export function blockId(uri: DocumentUri, name: string): BlockId;

  // workspace/knowledge.ts
  export function relationPath(target: string): { path: string; block: string | null } | null; // null = forma id
  export function relationUses(document: ParsedDocument, exists: (uri: DocumentUri) => boolean): DocumentUri[];
  export function resolveRelations(
    document: ParsedDocument,
    catalog: Catalog,
    documentsByUri: Map<DocumentUri, ParsedDocument>,
    diagnostics: Diagnostic[]
  ): void;

  // XRefIndex
  relationsFrom(id: EntityId): Relation[];
  relationsTo(id: EntityId): { from: EntityId; relation: Relation }[];
  ```

- [x] **Step 1: Escribir los tests que fallan**

`packages/core/src/workspace/knowledge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { relationPath } from "./knowledge.js";

describe("relationPath", () => {
  it("tells paths from entity ids (spec §3.2)", () => {
    expect(relationPath("api")).toBeNull();
    expect(relationPath("#acceso")).toBeNull();
    expect(relationPath("../br/passwords.md")).toEqual({ path: "../br/passwords.md", block: null });
    expect(relationPath("auth.flo#acceso")).toEqual({ path: "auth.flo", block: "acceso" });
    expect(relationPath("dir/x")).toEqual({ path: "dir/x", block: null });
    expect(relationPath("notas.md")).toEqual({ path: "notas.md", block: null });
  });
});
```

Agregar a `packages/core/src/workspace/workspace.test.ts` (usa `SCHEMA_URI`,
`note`, `workspace` y `codes` de la task 3):

```ts
describe("Workspace relations", () => {
  const RELATIONS_SCHEMA = "type_tags: [decision]\nrelation_types: [enforces, visualized_by, affects]\n";
  const pkce = [
    "---", // 1
    "id: pkce", // 2
    "title: PKCE", // 3
    "memory_type: long_term", // 4
    "relations:", // 5
    "  - target: ../reglas/passwords.md", // 6
    "    type: enforces", // 7
    "  - target: ../flujos/auth.flo#acceso", // 8
    "    type: visualized_by", // 9
    "  - target: api", // 10  alcanzable solo vía el use implícito de flujos/auth.flo
    "    type: affects", // 11
    "  - target: ../flujos/auth.flo", // 12  .flo sin #bloque
    "    type: affects", // 13
    "  - target: ../flujos/auth.flo#nope", // 14
    "    type: affects", // 15
    "  - target: fantasma", // 16
    "    type: affects", // 17
    "---",
    "",
  ].join("\n");
  const files = {
    [SCHEMA_URI]: RELATIONS_SCHEMA,
    "catalogo.flo": "entity api\nentity auth\n",
    "flujos/auth.flo": 'use "../catalogo.flo"\nflow acceso {\n  api -> auth\n}\n',
    "reglas/passwords.md": note("br_passwords"),
    "decisiones/pkce.md": pkce,
  };

  it("resolves the three target forms and reports the rest as E035", () => {
    const result = workspace(files).link();
    expect(codes(result.diagnostics.get("decisiones/pkce.md"))).toEqual([
      ["E035", 12, 13],
      ["E035", 14, 13],
      ["E035", 16, 13],
    ]);
    const relations = result.entities.get("pkce")!.knowledge!.relations;
    expect(relations.map((relation) => relation.resolved)).toEqual([
      { kind: "entity", id: "br_passwords" },
      { kind: "block", id: "flujos/auth.flo#acceso" },
      { kind: "entity", id: "api" },
      null,
      null,
      null,
    ]);
    // Post-orden DFS de los use implícitos, en orden de aparición (decisión #24).
    expect([...result.documents.get("decisiones/pkce.md")!.catalog.keys()]).toEqual([
      "br_passwords",
      "api",
      "auth",
      "pkce",
    ]);
  });

  it("indexes relations both ways; only the id form counts as a reference", () => {
    const { xref } = workspace(files).link();
    expect(xref.relationsFrom("pkce")).toHaveLength(6);
    expect(xref.relationsFrom("api")).toEqual([]);
    expect(xref.relationsTo("api").map(({ from, relation }) => [from, relation.target])).toEqual([["pkce", "api"]]);
    expect(xref.relationsTo("br_passwords").map(({ from }) => from)).toEqual(["pkce"]);
    expect(xref.referencesTo("api")).toEqual([
      {
        uri: "decisiones/pkce.md",
        range: { start: { line: 10, column: 13 }, end: { line: 10, column: 16 } },
      },
      {
        uri: "flujos/auth.flo",
        range: { start: { line: 3, column: 3 }, end: { line: 3, column: 6 } },
      },
    ]);
    expect(xref.referencesTo("br_passwords")).toEqual([]);
  });

  it("accepts relation cycles between .md documents", () => {
    const result = workspace({
      [SCHEMA_URI]: RELATIONS_SCHEMA,
      "a.md": note("a", ["relations:", "  - target: ./b.md", "    type: affects"]),
      "b.md": note("b", ["relations:", "  - target: ./a.md", "    type: affects"]),
    }).link();
    for (const list of result.diagnostics.values()) expect(list).toEqual([]);
    expect(result.xref.relationsTo("a").map(({ from }) => from)).toEqual(["b"]);
    expect(result.xref.relationsTo("b").map(({ from }) => from)).toEqual(["a"]);
  });

  it("reports E032 for a missing 'use:' path in a .md", () => {
    const result = workspace({ [SCHEMA_URI]: RELATIONS_SCHEMA, "x.md": note("x", ['use: ["./nope.flo"]']) }).link();
    expect(codes(result.diagnostics.get("x.md"))).toEqual([["E032", 5, 7]]);
  });
});
```

- [x] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/workspace`
Expected: FAIL (`./knowledge.js` no existe; sin `E035`; `relationsFrom` no existe).

- [x] **Step 3: Implementar**

`packages/core/src/workspace/uri.ts` — agregar al final (y `BlockId` al import de tipos: `import type { BlockId, DocumentUri } from "../ast.js";`):

```ts
/** Identidad de un bloque en el workspace: `uri#nombre` (decisión #25). */
export function blockId(uri: DocumentUri, name: string): BlockId {
  return `${uri}#${name}`;
}
```

`packages/core/src/workspace/xref.ts` — borrar la función `blockId` y su
comentario, y reemplazar por el re-export
`export { blockId } from "./uri.js";` junto con un
`import { blockId } from "./uri.js";` para el uso interno. Imports nuevos:
`Relation` en el `import type` de `../ast.js`, y
`import { relationPath } from "./knowledge.js";`.

Campo nuevo:

```ts
  private readonly incoming = new Map<EntityId, { from: EntityId; relation: Relation }[]>();
```

En el constructor, dentro de `for (const document of [...documents].sort(byUri)) {`, antes de `const seen = new Set<string>();`:

```ts
      // Relaciones de las declaraciones ganadoras; van antes que los bloques
      // porque el frontmatter está al principio del archivo.
      for (const entity of document.entities) {
        if (!entity.knowledge || this.entities.get(entity.id) !== entity) continue;
        for (const relation of entity.knowledge.relations) {
          if (relation.resolved?.kind !== "entity") continue;
          push(this.incoming, relation.resolved.id, { from: entity.id, relation });
          // Solo la forma id escribe el id: es la que cuenta como referencia
          // (y la que renombrar edita, decisión #30).
          if (relationPath(relation.target) === null) {
            push(this.references, relation.resolved.id, { uri: document.uri, range: relation.range });
          }
        }
      }
```

Métodos nuevos, después de `neighbors`:

```ts
  /** Las relaciones que declara el `.md` de la entidad, resueltas o no. */
  relationsFrom(id: EntityId): Relation[] {
    return this.entities.get(id)?.knowledge?.relations ?? [];
  }

  /** Relaciones resueltas que apuntan a la entidad, en orden de documento. */
  relationsTo(id: EntityId): { from: EntityId; relation: Relation }[] {
    return this.incoming.get(id) ?? [];
  }
```

Actualizar el doc-comment de la clase: "Las no resueltas (E030, E035) no entran."

`packages/core/src/workspace/knowledge.ts`:

```ts
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument, Relation } from "../ast.js";
import type { Catalog } from "./resolver.js";
import { blockId, resolveUse } from "./uri.js";

/**
 * Forma ruta de `relations.target` (spec de conocimiento §3.2, decisión
 * #30): lo anterior a `#` contiene `/` o termina en `.md`/`.flo`; lo
 * posterior, si hay, nombra un bloque. null = forma id.
 */
export function relationPath(target: string): { path: string; block: string | null } | null {
  const hash = target.indexOf("#");
  const path = hash === -1 ? target : target.slice(0, hash);
  if (!path.includes("/") && !path.endsWith(".md") && !path.endsWith(".flo")) return null;
  return { path, block: hash === -1 ? null : target.slice(hash + 1) };
}

function relationsOf(document: ParsedDocument): Relation[] {
  return document.entities.flatMap((entity) => entity.knowledge?.relations ?? []);
}

/** Documentos que las rutas de `relations` suman como `use` implícito: los que existen, sin repetir. */
export function relationUses(document: ParsedDocument, exists: (uri: DocumentUri) => boolean): DocumentUri[] {
  const uris: DocumentUri[] = [];
  for (const relation of relationsOf(document)) {
    const path = relationPath(relation.target);
    const uri = path && resolveUse(document.uri, path.path);
    if (uri && exists(uri) && !uris.includes(uri)) uris.push(uri);
  }
  return uris;
}

/** Rellena `Relation.resolved` contra el catálogo alcanzable del documento (E035). */
export function resolveRelations(
  document: ParsedDocument,
  catalog: Catalog,
  documentsByUri: Map<DocumentUri, ParsedDocument>,
  diagnostics: Diagnostic[]
): void {
  for (const relation of relationsOf(document)) {
    relation.resolved = resolveTarget(document.uri, relation.target, catalog, documentsByUri);
    if (relation.resolved === null) {
      diagnostics.push(
        diagnosticAt(
          "E035",
          `la relación '${relation.target}' no resuelve a una entidad, un .md o un bloque del workspace`,
          relation.range
        )
      );
    }
  }
}

function resolveTarget(
  from: DocumentUri,
  target: string,
  catalog: Catalog,
  documentsByUri: Map<DocumentUri, ParsedDocument>
): Relation["resolved"] {
  const path = relationPath(target);
  if (path === null) return catalog.has(target) ? { kind: "entity", id: target } : null;

  const uri = resolveUse(from, path.path);
  const document = uri === null ? undefined : documentsByUri.get(uri);
  if (!document) return null;
  if (path.block !== null) {
    const name = path.block;
    return document.blocks.some((block) => block.name === name) ? { kind: "block", id: blockId(document.uri, name) } : null;
  }
  const entity = document.entities.find((candidate) => candidate.knowledge !== null);
  return entity ? { kind: "entity", id: entity.id } : null;
}
```

`packages/core/src/workspace/resolver.ts`:

- import: `import { relationUses, resolveRelations } from "./knowledge.js";`
- en el loop de `uses`, justo antes de `uses.set(document.uri, targets);`:
  ```ts
    for (const uri of relationUses(document, (candidate) => documentsByUri.has(candidate))) {
      if (!targets.includes(uri)) targets.push(uri);
    }
  ```
- en el loop de catálogos, después de `resolveBlocks(...)`:
  ```ts
    resolveRelations(document, catalog, documentsByUri, diagnostics.get(document.uri)!);
  ```
- en el doc-comment de `linkDocuments`: agregar "las rutas de `relations` cuentan como `use` implícito y cada `relations.target` se resuelve (E035)". En `LinkedDocuments.uses`: "incluye los `use` implícitos de `relations`"; en `diagnostics`: "(E030–E033, E035, E065, E066, E068)".

- [x] **Step 4: Correr la suite del core**

Run: `pnpm --filter @flo/core exec vitest run && pnpm --filter @flo/core typecheck`
Expected: PASS (incluido `xref.test.ts` sin cambios de expectativas: `blockId` sigue exportado desde `xref.ts`).

- [x] **Step 5: GRAMMAR.md y §11**

En `packages/core/GRAMMAR.md`, en la sección de `.md`, agregar:

```markdown
`relations.target` es una ruta si lo anterior a `#` contiene `/` o termina
en `.md`/`.flo`: `x.md` resuelve a la entidad de ese `.md`, `x.flo#nombre`
(o `x.md#nombre`) al bloque. Cualquier otro valor es un id del catálogo
alcanzable. Las rutas que existen cuentan como `use` implícito. Un target
que no resuelve es `E035`.
```

y en la tabla, después de `E034`:

```markdown
| E035 | resolver | `relations.target` no resuelve a una entidad, `.md` o bloque |
```

En la tabla "Decisiones de la Fase K1" de §11:

```markdown
| 30 | 2026-09-28 | **Targets de relación.** Lo anterior a `#` es la ruta si contiene `/` o termina en `.md`/`.flo`; con `#nombre` resuelve al bloque de ese documento (`.flo` o `.md`), sin `#` debe ser un `.md` con entidad (un `.flo` sin bloque es `E035`). Toda ruta que existe es `use` implícito aunque la relación termine en `E035`. En `XRefIndex`, solo las declaraciones ganadoras (#2) aportan relaciones; `relationsTo` y `referencesTo` solo cuentan targets resueltos a entidad, y `referencesTo` solo la forma id, porque es la única cuyo texto es el id (renombrar en F la edita; una ruta a `.md` no cambia al renombrar). `blockId` vive en `workspace/uri.ts`. | resolver, xref (K1), `query` (K2), renombrar (F) |
```

- [x] **Step 6: Commit**

```bash
git add packages/core docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "feat(core): relaciones de .md con use implícito, E035 y relationsFrom/relationsTo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: API pública y ejemplo completo

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `@flo/core` exporta `SCHEMA_URI` y los tipos `BlockId` (ahora desde `ast.ts`, sin cambio para consumidores), `MemoryType`, `CustomTagValue`, `KnowledgeMeta`, `Relation`. `parseMarkdownDocument` **no** se exporta: la entrada es `Workspace.setDocument`.

- [x] **Step 1: Escribir el test que falla**

En `packages/core/src/index.test.ts`, agregar `SCHEMA_URI`, `type KnowledgeMeta`,
`type MemoryType` y `type Relation` al import de `./index.js`, y el test:

```ts
  it("links and renders a complete knowledge workspace through the public API", () => {
    const workspace = new Workspace();
    workspace.setDocument(SCHEMA_URI, "type_tags: [decision]\nrelation_types: [affects, visualized_by]\n");
    workspace.setDocument("catalogo.flo", "entity api [API Gateway]\n");
    workspace.setDocument(
      "decisiones/pkce.md",
      [
        "---",
        "id: pkce",
        'title: "Decisión: PKCE"',
        "memory_type: long_term",
        "type_tags: [decision]",
        'use: ["../catalogo.flo"]',
        "relations:",
        "  - target: api",
        "    type: affects",
        "  - target: ./pkce.md#validacion",
        "    type: visualized_by",
        "---",
        "",
        "```flo",
        'flow validacion "Validación" {',
        "  api -> pkce : code_verifier",
        "}",
        "```",
        "",
      ].join("\n")
    );
    const result = workspace.link();
    for (const list of result.diagnostics.values()) expect(list).toEqual([]);

    const knowledge: KnowledgeMeta = result.entities.get("pkce")!.knowledge!;
    const memory: MemoryType | null = knowledge.memoryType;
    const relations: Relation[] = result.xref.relationsFrom("pkce");
    expect(memory).toBe("long_term");
    expect(relations.map((relation) => relation.resolved)).toEqual([
      { kind: "entity", id: "api" },
      { kind: "block", id: "decisiones/pkce.md#validacion" },
    ]);

    const { document, catalog } = result.documents.get("decisiones/pkce.md")!;
    const svg = renderBlock(document.blocks[0], catalog, document.uri).svg;
    expect(svg).toContain('data-flo-entity="pkce"');
    expect(svg).toContain("Decisión: PKCE");
  });
```

- [x] **Step 2: Verificar que falla**

Run: `pnpm --filter @flo/core exec vitest run src/index.test.ts`
Expected: FAIL (`SCHEMA_URI` no se exporta).

- [x] **Step 3: Exportar**

`packages/core/src/index.ts`:

- después de `export { Workspace } from "./workspace/workspace.js";` agregar
  `export { SCHEMA_URI } from "./workspace/schema.js";`
- en `export type { XRefIndex, BlockId, Location } from "./workspace/xref.js";` dejar `BlockId` (xref lo re-exporta).
- al bloque `export type { ... } from "./ast.js";` agregar `MemoryType`, `CustomTagValue`, `KnowledgeMeta`, `Relation`.

- [x] **Step 4: Verificar que pasa**

Run: `pnpm --filter @flo/core exec vitest run src/index.test.ts`
Expected: PASS.

- [x] **Step 5: Verificación completa (core build + web contra el `dist/` nuevo)**

Run (desde la raíz del repo):
`pnpm --filter @flo/core build && pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: todo PASS (la web empaqueta `yaml` a través de `@flo/core` sin
cambios propios); `git status --short packages/core/src/render/__snapshots__ packages/web`
no lista nada.

- [x] **Step 6: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): API pública de conocimiento (SCHEMA_URI y tipos)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
