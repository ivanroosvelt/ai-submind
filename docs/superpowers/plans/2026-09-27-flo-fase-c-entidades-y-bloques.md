# .flo — Entidades y bloques nombrados, documento único (Fase C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-09-27 (`ee024e8`..`f3cb79c`); los pendientes diferidos quedaron en el spec §11.

**Goal:** Reemplazar el lenguaje `diagram <kind>` por un documento con
declaraciones `entity` (el catálogo) y bloques `flow`/`sequence` con nombre
que solo contienen aristas, con resolución estricta de referencias dentro
del documento, y con layout/render que derivan los nodos del catálogo.

**Architecture:** El parser pasa a tener un solo cursor de tokens
compartido (`parser/cursor.ts`) y tres parsers chicos: `document.ts`
(despacho de nivel superior), `entity.ts` y `block.ts` (flow y sequence
comparten gramática; solo difiere si la etiqueta es obligatoria). Una
pasada nueva, `workspace/resolver.ts`, arma el catálogo, rellena
`Ref.target` y emite `E030`/`E031`/`E033`; es el embrión del
`Workspace.link()` de la Fase D. Layout y render dejan de recibir nodos
declarados: derivan los nodos de un bloque de sus aristas + el catálogo
(`layout/nodes.ts`). La API pública pasa de "un archivo = un SVG" a "un
archivo = N bloques = N SVGs".

**Tech Stack:** TypeScript 5 (strict), Vitest, dagre (ya instalado).
**Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
(§3 modelo, §4 sintaxis, §6.1 tipos, §7 diagnósticos, §10 Fase C)

## Global Constraints

- **Ruptura de sintaxis deliberada** (spec §2, "Compatibilidad: Ninguna").
  El header `diagram <kind>`, la declaración de nodos dentro del diagrama y
  `participant ... as ...` desaparecen. No se mantiene nada como legacy.
- **Sin `use`, sin multi-documento, sin `Workspace`**: eso es la Fase D.
  Toda resolución es dentro de un único documento. `use "..."` en esta
  fase es simplemente una línea inválida de nivel superior (`E040`).
- **Sin atributos `data-flo-*`** en el SVG: eso es la Fase E.
- **Los snapshots de SVG de `render/__snapshots__/reference-diagrams.test.ts.snap`
  no se regeneran.** Los diagramas de referencia se reescriben a la
  sintaxis nueva y deben producir **exactamente el mismo SVG** byte a byte.
  Si un snapshot cambia, es un bug. Las únicas ediciones permitidas en el
  `.snap` son: borrar la entrada del caso que deja de existir (nodo sin
  aristas) y renombrar la clave de un test renombrado, sin tocar su valor.
- `tsconfig.base.json` usa `"module": "NodeNext"` — todo import relativo en
  `packages/core/src/` lleva sufijo `.js` (`from "../ast.js"`).
- `@flo/web` consume `@flo/core` por `dist/` (`"main": "dist/index.js"`).
  Por eso las Tasks 1–5 verifican solo core
  (`pnpm --filter @flo/core typecheck && pnpm --filter @flo/core test`) y
  web sigue verde contra el `dist/` viejo; la Task 6 hace
  `pnpm --filter @flo/core build` y adapta web. Desde la Task 6,
  `pnpm -r typecheck && pnpm -r test` en verde.
- Commits pequeños, uno por task, estilo del historial:
  `feat(core): ...`, `refactor(core): ...`, `feat(web): ...`, `docs: ...`.
- Mensajes de diagnóstico en español, como los actuales.

## Decisiones que el spec deja abiertas (tomadas aquí)

Persistidas en el spec §11 (registro de decisiones), que es la fuente de
verdad para las fases siguientes. Esta tabla es el resumen para esta fase.

| Tema | Decisión | Por qué |
|---|---|---|
| Forma de `entity` | Opcional. `entity Cache` ⇒ rectángulo con label `Cache`. | El fix sugerido del spec §4.2 es literalmente "añade `entity Cache`". |
| `entity X {` sin forma | Si tras `{` el resto de la línea está vacío (o es comentario), `{` abre el cuerpo; si hay texto, es un rombo. | Única ambigüedad real; se resuelve mirando la línea cruda (`Lexer.restOfLineIsBlank()`). |
| Valores de `type` / `tags` | Identificadores. `type` exactamente uno; `tags` uno o más. Propiedades separadas por `,`. | "el core los valida sintácticamente" (§4.1). Un `Ident` es la validación más simple que admite todos los ejemplos del spec. Requiere un token `COMMA`. |
| Tipo del bloque en el AST | Un único `DiagramBlock { kind: "flow" \| "sequence" }` con `edges: Edge[]`. | Ambos tienen exactamente la misma forma; dos interfaces idénticas no aportan nada. |
| Orden de nodos / participantes | Entidades resueltas en **orden de declaración del catálogo**; placeholders no resueltos al final, en orden de aparición. | Da control del orden de columnas en `sequence` (antes lo daba `participant`) y reproduce el input de dagre del lenguaje viejo ⇒ snapshots idénticos. |
| `E031` dentro de un documento | Se emite ya en esta fase para duplicados en el mismo documento; la Fase D lo extiende a otros documentos. | Mismo significado ("declarada dos veces"). |
| Documento vacío | Válido: cero bloques, cero diagnósticos. `E003` se retira. | Un catálogo sin bloques es un documento legítimo. |
| Varios bloques en el preview | Se muestran todos apilados con su título; **Exportar SVG/PNG exporta el primero**. | La selección de bloque llega con el explorador (Fase F). |
| Borrador viejo en IndexedDB | Una línea `diagram ...` da un único `E040` con mensaje de migración. | Los drafts guardados antes de este cambio van a abrir con sintaxis vieja. |

## Tabla de diagnósticos al terminar

| Código | Origen | Significado | Estado |
|---|---|---|---|
| E001 | lexer | falta el delimitador de cierre antes de fin de línea | igual |
| E002 | lexer | carácter inesperado, o cadena sin cerrar | igual |
| E010 | parser | se esperaba un identificador | igual |
| E011 | entity | se esperaba el texto de la entidad (forma vacía) | reusado |
| E012 | entity | falta el delimitador de cierre de la forma | reusado |
| E014 | block | se esperaba el id destino | igual |
| E016 | parser | contenido inesperado al final de la línea | igual |
| E024 | block | se esperaba `->` | ahora en flow y sequence |
| E026 | block (sequence) | se esperaba `:` seguido del mensaje | igual |
| E027 | block (sequence) | se esperaba el texto del mensaje | igual |
| E030 | resolver | entidad referenciada pero no declarada | **nuevo** |
| E031 | resolver | entidad declarada dos veces | **nuevo** |
| E033 | resolver | nombre de bloque duplicado | **nuevo** |
| E034 | entity | propiedad de entidad desconocida | **nuevo** |
| E040 | document | se esperaba `entity`, `flow` o `sequence` | **nuevo** |
| E041 | entity | se esperaba el id de la entidad | **nuevo** |
| E042 | entity | se esperaba `:` después de la propiedad | **nuevo** |
| E043 | entity | se esperaba el valor de la propiedad | **nuevo** |
| E044 | entity | propiedad repetida | **nuevo** |
| E045 | entity | falta `}` que cierra el cuerpo de la entidad | **nuevo** |
| E050 | block | se esperaba el nombre del bloque | **nuevo** |
| E051 | block | se esperaba `{` para abrir el bloque | **nuevo** |
| E052 | block | falta `}` que cierra el bloque | **nuevo** |

**Retirados:** E003, E004, E005, E006, E013, E015, E017, E020, E021, E022,
E023, E025. No se reusan con otro significado.

## Review Focus

1. **Un borrador viejo** (`diagram flowchart` + nodos) abierto desde
   IndexedDB ⇒ un solo `E040` con mensaje de migración en la línea 1, no
   un error por línea. Test en Task 3.
2. **Un título con HTML** (`flow x "<img src=x onerror=alert(1)>" {`) ⇒ el
   preview lo muestra escapado, nunca como markup. Test en Task 6.
3. **Un `}` olvidado** al final de un bloque ⇒ `E052` anclado en el `{`
   de apertura, y las aristas ya parseadas siguen en el bloque (se
   renderizan). Test en Task 1.
4. **`entity X {` + cuerpo vs `entity X {Decisión}`**, incluido
   `entity X { // comentario` ⇒ cuerpo, rombo, cuerpo. Test en Task 2.
5. **Arista hacia una entidad no declarada** ⇒ `E030` en el rango del
   nombre, el bloque se renderiza igual con un placeholder punteado
   (`flo-unresolved`) y sin `NaN`. Test en Task 5.

---

## Task 1: tipos nuevos del AST, cursor compartido y parser de bloques

**Files:**

- Modify: `packages/core/src/ast.ts` (agregar tipos; los viejos se quedan hasta la Task 5)
- Create: `packages/core/src/parser/cursor.ts`
- Create: `packages/core/src/parser/block.ts`
- Test: `packages/core/src/parser/block.test.ts`

**Interfaces:**

- Consumes: `Lexer` (`next`, `readTextUntil`, `skipRestOfLine`), `diagnosticAt`.
- Produces:
  - En `ast.ts`: `EntityId`, `DocumentUri`, `EntityDecl`, `Ref`, `Edge`,
    `BlockKind`, `DiagramBlock`, `ParsedDocument` (código abajo).
  - `class TokenCursor` con `lexer`, `current()`, `advance()`,
    `readText(closer)`, `restOfLineIsBlank()`, `atLineEnd()`,
    `skipNewlines()`, `skipToNextLine()`; y `describeToken(token): string`.
  - `parseBlock(cursor: TokenCursor, diagnostics: Diagnostic[]): DiagramBlock | null`
    — precondición: `cursor.current()` es el `IDENT` `flow` o `sequence`.

- [x] **Step 1: Agregar los tipos a `ast.ts`**

Al final de `packages/core/src/ast.ts`, sin tocar lo existente:

```ts
export type EntityId = string;
export type DocumentUri = string;

export interface EntityDecl {
  id: EntityId;
  label: string;
  shape: NodeShape;
  type: string | null;
  tags: string[];
  uri: DocumentUri;
  range: Range; // la declaración completa, desde `entity`
  nameRange: Range; // solo el identificador
}

/** Referencia a una entidad desde una arista. `target` lo rellena el resolver. */
export interface Ref {
  name: string;
  range: Range;
  target: EntityId | null; // null tras resolver ⇒ E030
}

export interface Edge {
  from: Ref;
  to: Ref;
  label: string | null; // en `sequence` el parser garantiza que no es null
  range: Range;
}

export type BlockKind = "flow" | "sequence";

export interface DiagramBlock {
  kind: BlockKind;
  name: string;
  title: string | null;
  edges: Edge[];
  range: Range; // desde la palabra clave hasta el `}`
  nameRange: Range;
}

export interface ParsedDocument {
  uri: DocumentUri;
  entities: EntityDecl[];
  blocks: DiagramBlock[];
}
```

- [x] **Step 2: Crear `parser/cursor.ts`**

Es la lógica que hoy está duplicada como closures en
`parser/flowchart.ts` y `parser/sequence.ts` (`current`, `advance`,
`readText`, `skipNewlines`, `skipToNextLine`), movida a una clase. Esos dos
archivos no se tocan en esta task (se borran en la Task 5).

```ts
import type { Token } from "../tokens.js";
import type { Lexer } from "../lexer.js";

/**
 * Un token de lookahead sobre el Lexer, más la recuperación de errores que
 * comparten todos los parsers. El lexer no tiene lookahead propio en uso
 * (nadie llama a `lexer.peek()`), así que `readText` y `restOfLineIsBlank`
 * son válidos siempre que este cursor no tenga un token en buffer.
 */
export class TokenCursor {
  private buffered: Token | null = null;

  constructor(readonly lexer: Lexer) {}

  current(): Token {
    if (this.buffered === null) this.buffered = this.lexer.next();
    return this.buffered;
  }

  advance(): Token {
    const token = this.current();
    if (token.kind !== "EOF") this.buffered = null;
    return token;
  }

  /** Pide texto al lexer. Requiere que no haya lookahead pendiente. */
  readText(closer: "]" | ")" | "}" | "\n"): Token {
    if (this.buffered !== null) throw new Error("readText con lookahead pendiente");
    return this.lexer.readTextUntil(closer);
  }

  /** Mira la línea cruda que queda. Requiere que no haya lookahead pendiente. */
  restOfLineIsBlank(): boolean {
    if (this.buffered !== null) throw new Error("restOfLineIsBlank con lookahead pendiente");
    return this.lexer.restOfLineIsBlank();
  }

  atLineEnd(): boolean {
    const kind = this.current().kind;
    return kind === "NEWLINE" || kind === "EOF";
  }

  skipNewlines(): void {
    while (this.current().kind === "NEWLINE") this.advance();
  }

  /**
   * Abandona la línea actual sin escanearla como tokens de código: descarta
   * el token en buffer (si hay uno, ya fue leído del lexer) y le pide al
   * lexer que descarte el resto de caracteres crudos hasta el próximo
   * newline. Evita E002 espurios por caracteres que habrían quedado dentro
   * de una región de texto si la línea no hubiera fallado.
   *
   * Si el token en buffer ya es NEWLINE o EOF, el cursor ya está en el
   * límite de línea — no hay nada crudo que descartar, y llamar a
   * skipRestOfLine() ahí saltaría de más la línea siguiente completa.
   */
  skipToNextLine(): void {
    if (this.buffered !== null) {
      const already = this.buffered;
      this.buffered = null;
      if (already.kind === "NEWLINE") return;
      if (already.kind === "EOF") {
        this.buffered = already;
        return;
      }
    }
    this.lexer.skipRestOfLine();
    this.buffered = this.lexer.next(); // será NEWLINE (o EOF)
    if (this.buffered.kind === "NEWLINE") this.buffered = null;
  }
}

/** Cómo mostrar un token inesperado en un mensaje de error. */
export function describeToken(token: Token): string {
  return token.kind === "STRING" ? `"${token.value}"` : token.value || token.kind;
}
```

`restOfLineIsBlank()` todavía no existe en `Lexer`: se agrega en la Task 2.
Para que esta task compile, **agregarlo ya aquí** en `lexer.ts` (el test
propio del método va en la Task 2), justo antes de `skipRestOfLine()`:

```ts
  /**
   * Mira, sin consumir nada, si lo que queda de la línea actual es solo
   * espacio en blanco o un comentario `//`. Lo usa el parser para decidir
   * si un `{` abre un cuerpo o una forma `{decisión}`.
   */
  restOfLineIsBlank(): boolean {
    if (this.buffered) {
      throw new Error("Lexer.restOfLineIsBlank: hay un token en el buffer de peek()");
    }
    let j = this.i;
    while (j < this.source.length && (this.source[j] === " " || this.source[j] === "\t" || this.source[j] === "\r")) {
      j += 1;
    }
    return j >= this.source.length || this.source[j] === "\n" || (this.source[j] === "/" && this.source[j + 1] === "/");
  }
```

- [x] **Step 3: Escribir los tests que fallan**

`packages/core/src/parser/block.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Lexer } from "../lexer.js";
import { TokenCursor } from "./cursor.js";
import { parseBlock } from "./block.js";
import type { Diagnostic } from "../diagnostics.js";

function parseBlockSource(source: string) {
  const lexer = new Lexer(source);
  const cursor = new TokenCursor(lexer);
  const diagnostics: Diagnostic[] = [];
  const block = parseBlock(cursor, diagnostics);
  diagnostics.push(...lexer.diagnostics);
  return { block, diagnostics };
}

describe("parseBlock", () => {
  it("parses a titled flow block with exact ranges", () => {
    const { block, diagnostics } = parseBlockSource(
      'flow login "Inicio de sesión" {\n  User -> Api : POST /login\n}\n'
    );
    expect(diagnostics).toEqual([]);
    expect(block).toEqual({
      kind: "flow",
      name: "login",
      title: "Inicio de sesión",
      nameRange: { start: { line: 1, column: 6 }, end: { line: 1, column: 11 } },
      range: { start: { line: 1, column: 1 }, end: { line: 3, column: 2 } },
      edges: [
        {
          from: { name: "User", target: null, range: { start: { line: 2, column: 3 }, end: { line: 2, column: 7 } } },
          to: { name: "Api", target: null, range: { start: { line: 2, column: 11 }, end: { line: 2, column: 14 } } },
          label: "POST /login",
          range: { start: { line: 2, column: 3 }, end: { line: 2, column: 28 } },
        },
      ],
    });
  });

  it("parses an untitled block, blank lines and comments inside the body", () => {
    const { block, diagnostics } = parseBlockSource("sequence s {\n\n  // nota\n  a -> b : hola\n}\n");
    expect(diagnostics).toEqual([]);
    expect(block?.kind).toBe("sequence");
    expect(block?.title).toBeNull();
    expect(block?.edges.map((e) => [e.from.name, e.to.name, e.label])).toEqual([["a", "b", "hola"]]);
  });

  it("treats a flow edge with a colon and no text as label: null, with no diagnostic", () => {
    const { block, diagnostics } = parseBlockSource("flow f {\n  a -> b :\n}\n");
    expect(diagnostics).toEqual([]);
    expect(block?.edges[0].label).toBeNull();
  });

  it("requires a message label in sequence blocks (E026 without ':', E027 with an empty one)", () => {
    const { block, diagnostics } = parseBlockSource("sequence s {\n  a -> b\n  a -> b :\n  a -> b : ok\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E026", "E027"]);
    expect(block?.edges).toHaveLength(1);
  });

  it("reports E052 at the opening brace when the block is never closed, keeping the parsed edges", () => {
    const { block, diagnostics } = parseBlockSource("flow f {\n  a -> b\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E052"]);
    expect(diagnostics[0].range.start).toEqual({ line: 1, column: 8 });
    expect(block?.edges).toHaveLength(1);
  });

  it("reports E050 for a missing block name and E051 for a missing '{'", () => {
    expect(parseBlockSource("flow {\n}\n").diagnostics.map((d) => d.code)).toEqual(["E050"]);
    expect(parseBlockSource("flow f\n").diagnostics.map((d) => d.code)).toEqual(["E051"]);
    expect(parseBlockSource('flow f "t" x {\n}\n').diagnostics.map((d) => d.code)).toEqual(["E051"]);
  });

  it("reports E010, E024 and E014 for malformed edge lines and keeps parsing the next ones", () => {
    const { block, diagnostics } = parseBlockSource('flow f {\n  "x" -> b\n  a b\n  a ->\n  a -> c\n}\n');
    expect(diagnostics.map((d) => d.code)).toEqual(["E010", "E024", "E014"]);
    expect(diagnostics[0].message).toContain('"x"');
    expect(block?.edges.map((e) => e.to.name)).toEqual(["c"]);
  });

  it("reports E016 for trailing content after an edge, after '{' and after '}'", () => {
    const { diagnostics } = parseBlockSource("flow f { x\n  a -> b c\n} y\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E016", "E016", "E016"]);
  });

  it("does not report spurious E002s for raw characters skipped during line recovery", () => {
    const { diagnostics } = parseBlockSource("flow f {\n  a b[¿Qué?]\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E024"]);
  });

  it("treats 'flow', 'sequence' and 'entity' as plain identifiers inside a body", () => {
    const { block, diagnostics } = parseBlockSource("flow f {\n  flow -> entity\n}\n");
    expect(diagnostics).toEqual([]);
    expect(block?.edges[0].from.name).toBe("flow");
  });
});
```

- [x] **Step 4: Correr los tests y ver que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/parser/block.test.ts`
Expected: FAIL — `Cannot find module './block.js'`.

- [x] **Step 5: Implementar `parser/block.ts`**

```ts
import type { Token } from "../tokens.js";
import { describeToken, type TokenCursor } from "./cursor.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { BlockKind, DiagramBlock, Edge, Ref } from "../ast.js";

function refOf(token: Token): Ref {
  return { name: token.value, range: token.range, target: null };
}

function reportTrailing(cursor: TokenCursor, diagnostics: Diagnostic[]): void {
  if (cursor.atLineEnd()) return;
  diagnostics.push(diagnosticAt("E016", "contenido inesperado al final de la línea", cursor.current().range));
  cursor.skipToNextLine();
}

/**
 * `Edge ::= Ident "->" Ident (":" Text)?`, con el texto obligatorio en
 * `sequence`. Devuelve null si la línea no parsea (ya descartada).
 */
function parseEdgeLine(cursor: TokenCursor, kind: BlockKind, diagnostics: Diagnostic[]): Edge | null {
  const fromToken = cursor.current();
  if (fromToken.kind !== "IDENT") {
    diagnostics.push(
      diagnosticAt("E010", `se esperaba un identificador, se encontró '${describeToken(fromToken)}'`, fromToken.range)
    );
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  if (cursor.current().kind !== "ARROW") {
    diagnostics.push(diagnosticAt("E024", "se esperaba '->'", cursor.current().range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  const toToken = cursor.current();
  if (toToken.kind !== "IDENT") {
    diagnostics.push(diagnosticAt("E014", "se esperaba el id destino", toToken.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  let label: string | null = null;
  let end = toToken.range.end;
  if (cursor.current().kind === "COLON") {
    cursor.advance();
    const labelToken = cursor.readText("\n");
    if (!labelToken.value && kind === "sequence") {
      diagnostics.push(diagnosticAt("E027", "se esperaba el texto del mensaje", labelToken.range));
      cursor.skipToNextLine();
      return null;
    }
    label = labelToken.value || null;
    end = labelToken.range.end;
  } else if (kind === "sequence") {
    diagnostics.push(diagnosticAt("E026", "se esperaba ':' seguido del mensaje", cursor.current().range));
    cursor.skipToNextLine();
    return null;
  }

  reportTrailing(cursor, diagnostics);
  return {
    from: refOf(fromToken),
    to: refOf(toToken),
    label,
    range: { start: fromToken.range.start, end },
  };
}

/**
 * `Block ::= ("flow" | "sequence") Ident String? "{" Newline Edge* "}"`.
 * Precondición: el token actual es la palabra clave. Devuelve null si el
 * header no parsea (la línea ya fue descartada). Un `}` que falta no
 * descarta el bloque: se reporta E052 y se devuelve lo parseado.
 */
export function parseBlock(cursor: TokenCursor, diagnostics: Diagnostic[]): DiagramBlock | null {
  const keyword = cursor.advance();
  const kind = keyword.value as BlockKind;

  const nameToken = cursor.current();
  if (nameToken.kind !== "IDENT") {
    diagnostics.push(diagnosticAt("E050", `se esperaba el nombre del bloque '${kind}'`, nameToken.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  let title: string | null = null;
  if (cursor.current().kind === "STRING") title = cursor.advance().value;

  const open = cursor.current();
  if (open.kind !== "LBRACE") {
    diagnostics.push(diagnosticAt("E051", "se esperaba '{' para abrir el bloque", open.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();
  reportTrailing(cursor, diagnostics);
  cursor.skipNewlines();

  const edges: Edge[] = [];
  let end = open.range.end;
  for (;;) {
    const token = cursor.current();
    if (token.kind === "EOF") {
      diagnostics.push(diagnosticAt("E052", `falta '}' que cierra el bloque '${nameToken.value}'`, open.range));
      end = token.range.end;
      break;
    }
    if (token.kind === "RBRACE") {
      end = cursor.advance().range.end;
      reportTrailing(cursor, diagnostics);
      break;
    }
    const edge = parseEdgeLine(cursor, kind, diagnostics);
    if (edge) edges.push(edge);
    cursor.skipNewlines();
  }

  return {
    kind,
    name: nameToken.value,
    title,
    edges,
    range: { start: keyword.range.start, end },
    nameRange: nameToken.range,
  };
}
```

- [x] **Step 6: Verificar**

Run: `pnpm --filter @flo/core typecheck && pnpm --filter @flo/core test`
Expected: todo verde (los tests viejos siguen pasando; el lenguaje viejo
no se tocó).

- [x] **Step 7: Commit**

```bash
git add packages/core/src/ast.ts packages/core/src/lexer.ts packages/core/src/parser/cursor.ts packages/core/src/parser/block.ts packages/core/src/parser/block.test.ts
git commit -m "feat(core): parser de bloques flow/sequence con nombre y cursor compartido"
```

---

## Task 2: token `COMMA` y parser de `entity`

**Files:**

- Modify: `packages/core/src/tokens.ts`, `packages/core/src/lexer.ts`
- Create: `packages/core/src/parser/entity.ts`
- Test: `packages/core/src/lexer.test.ts` (agregar casos), `packages/core/src/parser/entity.test.ts`

**Interfaces:**

- Consumes: `TokenCursor`, `describeToken` (Task 1), `EntityDecl`, `NodeShape`, `DocumentUri`.
- Produces:
  - `TokenKind` gana `"COMMA"`.
  - `parseEntity(cursor: TokenCursor, uri: DocumentUri, diagnostics: Diagnostic[]): EntityDecl | null`
    — precondición: `cursor.current()` es el `IDENT` `entity`. Devuelve
    `null` solo si falta el id (`E041`); cualquier otro error devuelve la
    entidad con lo que se pudo parsear, para no causar `E030` en cascada.

Gramática que implementa:

```
EntityDecl ::= "entity" Ident Shape? PropList? Body? Newline
Shape      ::= "[" Text "]" | "(" Text ")" | "{" Text "}"
PropList   ::= Prop ("," Prop)*
Prop       ::= "type" ":" Ident | "tags" ":" Ident+
Body       ::= "{" Newline (PropList? Newline)* "}"
```

- [x] **Step 1: Escribir los tests que fallan**

En `packages/core/src/lexer.test.ts`, dentro del `describe("Lexer")`:

```ts
  it("tokenizes a comma as COMMA", () => {
    const lexer = new Lexer("a, b\n");
    expect(lexer.next()).toMatchObject({ kind: "IDENT", value: "a" });
    expect(lexer.next()).toMatchObject({
      kind: "COMMA",
      value: ",",
      range: { start: { line: 1, column: 2 }, end: { line: 1, column: 3 } },
    });
    expect(lexer.next()).toMatchObject({ kind: "IDENT", value: "b" });
    expect(lexer.diagnostics).toEqual([]);
  });

  it("restOfLineIsBlank looks at the raw rest of the line without consuming it", () => {
    const blank = new Lexer("{   // nota\nx");
    blank.next(); // {
    expect(blank.restOfLineIsBlank()).toBe(true);
    expect(blank.next().kind).toBe("NEWLINE");

    const text = new Lexer("{ Decisión }\n");
    text.next(); // {
    expect(text.restOfLineIsBlank()).toBe(false);
    expect(text.readTextUntil("}").value).toBe("Decisión");

    const eof = new Lexer("{");
    eof.next();
    expect(eof.restOfLineIsBlank()).toBe(true);
  });
```

`packages/core/src/parser/entity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Lexer } from "../lexer.js";
import { TokenCursor } from "./cursor.js";
import { parseEntity } from "./entity.js";
import type { Diagnostic } from "../diagnostics.js";

function parseEntitySource(source: string) {
  const lexer = new Lexer(source);
  const cursor = new TokenCursor(lexer);
  const diagnostics: Diagnostic[] = [];
  const entity = parseEntity(cursor, "catalog.flo", diagnostics);
  diagnostics.push(...lexer.diagnostics);
  return { entity, diagnostics, next: cursor.current() };
}

describe("parseEntity", () => {
  it("parses the short form with shape and properties, with exact ranges", () => {
    const { entity, diagnostics } = parseEntitySource(
      "entity Api [API Gateway] type: service, tags: http internal\n"
    );
    expect(diagnostics).toEqual([]);
    expect(entity).toEqual({
      id: "Api",
      label: "API Gateway",
      shape: "rectangle",
      type: "service",
      tags: ["http", "internal"],
      uri: "catalog.flo",
      range: { start: { line: 1, column: 1 }, end: { line: 1, column: 60 } },
      nameRange: { start: { line: 1, column: 8 }, end: { line: 1, column: 11 } },
    });
  });

  it("maps the three delimiters to the three shapes", () => {
    expect(parseEntitySource("entity a [A]\n").entity?.shape).toBe("rectangle");
    expect(parseEntitySource("entity a (A)\n").entity?.shape).toBe("rounded");
    expect(parseEntitySource("entity a {A}\n").entity?.shape).toBe("decision");
  });

  it("defaults to a rectangle labelled with its id when there is no shape", () => {
    const { entity, diagnostics } = parseEntitySource("entity Cache\n");
    expect(diagnostics).toEqual([]);
    expect(entity).toMatchObject({ id: "Cache", label: "Cache", shape: "rectangle", type: null, tags: [] });
  });

  it("parses the body form after a shape", () => {
    const { entity, diagnostics, next } = parseEntitySource(
      "entity Worker [Job Runner] {\n  type: service\n\n  tags: async internal\n}\nentity Next\n"
    );
    expect(diagnostics).toEqual([]);
    expect(entity).toMatchObject({ label: "Job Runner", type: "service", tags: ["async", "internal"] });
    expect(entity?.range.end).toEqual({ line: 5, column: 2 });
    expect(next).toMatchObject({ kind: "NEWLINE" });
  });

  it("reads '{' as a body (not a decision) when the rest of the line is blank or a comment", () => {
    const body = parseEntitySource("entity Worker {\n  type: service\n}\n");
    expect(body.diagnostics).toEqual([]);
    expect(body.entity).toMatchObject({ shape: "rectangle", label: "Worker", type: "service" });

    const commented = parseEntitySource("entity Worker { // metadatos\n  type: service\n}\n");
    expect(commented.diagnostics).toEqual([]);
    expect(commented.entity?.type).toBe("service");

    const decision = parseEntitySource("entity Ok {¿Válido?}\n");
    expect(decision.diagnostics).toEqual([]);
    expect(decision.entity).toMatchObject({ shape: "decision", label: "¿Válido?" });
  });

  it("reports E034 for an unknown property and still returns the entity", () => {
    const { entity, diagnostics } = parseEntitySource("entity a [A] owner: team, type: store\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E034"]);
    expect(diagnostics[0].range.start).toEqual({ line: 1, column: 14 });
    expect(entity?.type).toBe("store");
  });

  it("reports E044 for a repeated property, keeping the first value", () => {
    const { entity, diagnostics } = parseEntitySource("entity a [A] type: x {\n  type: y\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E044"]);
    expect(entity?.type).toBe("x");
  });

  it("reports E042 for a missing ':' and E043 for a missing value", () => {
    expect(parseEntitySource("entity a type service\n").diagnostics.map((d) => d.code)).toEqual(["E042"]);
    expect(parseEntitySource("entity a type:\n").diagnostics.map((d) => d.code)).toEqual(["E043"]);
  });

  it("accepts exactly one identifier for type (a second one is trailing content)", () => {
    const { diagnostics } = parseEntitySource("entity a type: x y\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
  });

  it("reports E041 and returns null when the id is missing", () => {
    const { entity, diagnostics } = parseEntitySource("entity [A]\n");
    expect(entity).toBeNull();
    expect(diagnostics.map((d) => d.code)).toEqual(["E041"]);
  });

  it("reports E011 for an empty shape and E045 for an unclosed body, returning the entity in both cases", () => {
    const empty = parseEntitySource("entity a []\n");
    expect(empty.diagnostics.map((d) => d.code)).toEqual(["E011"]);
    expect(empty.entity?.id).toBe("a");

    const unclosed = parseEntitySource("entity a {\n  type: x\n");
    expect(unclosed.diagnostics.map((d) => d.code)).toEqual(["E045"]);
    expect(unclosed.diagnostics[0].range.start).toEqual({ line: 1, column: 10 });
    expect(unclosed.entity?.type).toBe("x");
  });
});
```

- [x] **Step 2: Correr los tests y ver que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/lexer.test.ts src/parser/entity.test.ts`
Expected: FAIL — `COMMA` sale como `E002 carácter inesperado ','` y
`./entity.js` no existe. (El test de `restOfLineIsBlank` ya pasa: el
método se agregó en la Task 1.)

- [x] **Step 3: Agregar `COMMA`**

En `tokens.ts`, agregar `| "COMMA"` a `TokenKind` (después de `"COLON"`).
En `lexer.ts`, dentro de `scanCodeToken()`, justo después del bloque de
`":"`:

```ts
      if (ch === ",") {
        this.advance();
        return this.makeToken("COMMA", ",", start);
      }
```

- [x] **Step 4: Implementar `parser/entity.ts`**

```ts
import type { Token, TokenKind } from "../tokens.js";
import { describeToken, type TokenCursor } from "./cursor.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, EntityDecl, NodeShape } from "../ast.js";

type OpenKind = "LBRACKET" | "LPAREN" | "LBRACE";

const SHAPE_BY_OPEN: Record<OpenKind, NodeShape> = {
  LBRACKET: "rectangle",
  LPAREN: "rounded",
  LBRACE: "decision",
};
const CLOSE_BY_OPEN: Record<OpenKind, TokenKind> = {
  LBRACKET: "RBRACKET",
  LPAREN: "RPAREN",
  LBRACE: "RBRACE",
};
const CLOSE_CHAR: Record<OpenKind, "]" | ")" | "}"> = {
  LBRACKET: "]",
  LPAREN: ")",
  LBRACE: "}",
};

function isOpen(kind: TokenKind): kind is OpenKind {
  return kind === "LBRACKET" || kind === "LPAREN" || kind === "LBRACE";
}

function reportTrailing(cursor: TokenCursor, diagnostics: Diagnostic[]): void {
  if (cursor.atLineEnd()) return;
  diagnostics.push(diagnosticAt("E016", "contenido inesperado al final de la línea", cursor.current().range));
  cursor.skipToNextLine();
}

/**
 * `PropList ::= Prop ("," Prop)*`. Devuelve false si tuvo que descartar la
 * línea (el caller no debe seguir leyéndola).
 */
function parseProps(cursor: TokenCursor, entity: EntityDecl, diagnostics: Diagnostic[]): boolean {
  for (;;) {
    const key = cursor.current();
    if (key.kind !== "IDENT") {
      diagnostics.push(
        diagnosticAt("E010", `se esperaba un identificador, se encontró '${describeToken(key)}'`, key.range)
      );
      cursor.skipToNextLine();
      return false;
    }
    cursor.advance();

    if (cursor.current().kind !== "COLON") {
      diagnostics.push(diagnosticAt("E042", `se esperaba ':' después de '${key.value}'`, cursor.current().range));
      cursor.skipToNextLine();
      return false;
    }
    cursor.advance();

    const values: Token[] = [];
    while (cursor.current().kind === "IDENT" && (key.value !== "type" || values.length === 0)) {
      values.push(cursor.advance());
    }
    if (values.length === 0) {
      diagnostics.push(diagnosticAt("E043", `se esperaba el valor de '${key.value}'`, cursor.current().range));
      cursor.skipToNextLine();
      return false;
    }

    if (key.value !== "type" && key.value !== "tags") {
      diagnostics.push(
        diagnosticAt("E034", `propiedad desconocida '${key.value}'; se esperaba 'type' o 'tags'`, key.range)
      );
    } else if (key.value === "type" ? entity.type !== null : entity.tags.length > 0) {
      diagnostics.push(diagnosticAt("E044", `la propiedad '${key.value}' ya fue definida`, key.range));
    } else if (key.value === "type") {
      entity.type = values[0].value;
    } else {
      entity.tags = values.map((value) => value.value);
    }
    entity.range.end = values[values.length - 1].range.end;

    if (cursor.current().kind !== "COMMA") return true;
    cursor.advance();
  }
}

/** `Body ::= "{" Newline (PropList? Newline)* "}"`. `open` ya fue consumido. */
function parseBody(cursor: TokenCursor, entity: EntityDecl, open: Token, diagnostics: Diagnostic[]): void {
  reportTrailing(cursor, diagnostics);
  cursor.skipNewlines();
  for (;;) {
    const token = cursor.current();
    if (token.kind === "EOF") {
      diagnostics.push(
        diagnosticAt("E045", `falta '}' que cierra el cuerpo de la entidad '${entity.id}'`, open.range)
      );
      entity.range.end = token.range.end;
      return;
    }
    if (token.kind === "RBRACE") {
      entity.range.end = cursor.advance().range.end;
      reportTrailing(cursor, diagnostics);
      return;
    }
    if (parseProps(cursor, entity, diagnostics)) reportTrailing(cursor, diagnostics);
    cursor.skipNewlines();
  }
}

/**
 * Precondición: el token actual es `entity`. Devuelve null solo si falta el
 * id (E041); con cualquier otro error devuelve la entidad parcial, para que
 * sus referencias no disparen E030 en cascada.
 */
export function parseEntity(cursor: TokenCursor, uri: DocumentUri, diagnostics: Diagnostic[]): EntityDecl | null {
  const keyword = cursor.advance();
  const idToken = cursor.current();
  if (idToken.kind !== "IDENT") {
    diagnostics.push(diagnosticAt("E041", "se esperaba el id de la entidad", idToken.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  const entity: EntityDecl = {
    id: idToken.value,
    label: idToken.value,
    shape: "rectangle",
    type: null,
    tags: [],
    uri,
    range: { start: keyword.range.start, end: idToken.range.end },
    nameRange: idToken.range,
  };

  const open = cursor.current();
  if (isOpen(open.kind)) {
    const openKind = open.kind;
    cursor.advance();
    // `entity X {` sin nada más en la línea: el `{` abre el cuerpo, no un rombo.
    if (openKind === "LBRACE" && cursor.restOfLineIsBlank()) {
      parseBody(cursor, entity, open, diagnostics);
      return entity;
    }
    const text = cursor.readText(CLOSE_CHAR[openKind]);
    if (!text.value) {
      diagnostics.push(diagnosticAt("E011", "se esperaba el texto de la entidad", text.range));
      cursor.skipToNextLine();
      return entity;
    }
    const close = cursor.current();
    if (close.kind !== CLOSE_BY_OPEN[openKind]) {
      diagnostics.push(diagnosticAt("E012", `se esperaba '${CLOSE_CHAR[openKind]}'`, close.range));
      cursor.skipToNextLine();
      return entity;
    }
    cursor.advance();
    entity.shape = SHAPE_BY_OPEN[openKind];
    entity.label = text.value;
    entity.range.end = close.range.end;
  }

  if (cursor.current().kind === "IDENT" && !parseProps(cursor, entity, diagnostics)) return entity;

  if (cursor.current().kind === "LBRACE") {
    parseBody(cursor, entity, cursor.advance(), diagnostics);
    return entity;
  }

  reportTrailing(cursor, diagnostics);
  return entity;
}
```

Nota sobre el test de E045: en `entity a {\n  type: x\n` el `{` está en
la columna 10, por eso el ancla esperada es `{ line: 1, column: 10 }`.

- [x] **Step 5: Verificar**

Run: `pnpm --filter @flo/core typecheck && pnpm --filter @flo/core test`
Expected: todo verde. Ningún test viejo depende de que `,` sea `E002`
(verificado: el único test de E002 usa `1`).

- [x] **Step 6: Commit**

```bash
git add packages/core/src/tokens.ts packages/core/src/lexer.ts packages/core/src/lexer.test.ts packages/core/src/parser/entity.ts packages/core/src/parser/entity.test.ts
git commit -m "feat(core): declaraciones entity con forma, propiedades y cuerpo"
```

---

## Task 3: `parseDocument` — nivel superior del documento

**Files:**

- Create: `packages/core/src/parser/document.ts`
- Test: `packages/core/src/parser/document.test.ts`

**Interfaces:**

- Consumes: `Lexer`, `TokenCursor`, `describeToken`, `parseEntity` (Task 2), `parseBlock` (Task 1).
- Produces: `parseDocument(source: string, uri: DocumentUri): { document: ParsedDocument; diagnostics: Diagnostic[] }`
  — diagnósticos del parser + del lexer, **sin ordenar** (ordena `parse()` en la Task 5).

Gramática: `Document ::= (BlankLine | EntityDecl | Block)* EOF`.

- [x] **Step 1: Escribir los tests que fallan**

`packages/core/src/parser/document.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseDocument } from "./document.js";

describe("parseDocument", () => {
  it("collects entities and blocks in source order, mixed in one file", () => {
    const source = [
      "// catálogo",
      "entity User (Usuario) type: actor",
      "",
      'flow login "Inicio de sesión" {',
      "  User -> Api : POST /login",
      "}",
      "entity Api [API Gateway]",
      "sequence detalle {",
      "  User -> Api : POST /login",
      "}",
      "",
    ].join("\n");
    const { document, diagnostics } = parseDocument(source, "login.flo");
    expect(diagnostics).toEqual([]);
    expect(document.uri).toBe("login.flo");
    expect(document.entities.map((e) => e.id)).toEqual(["User", "Api"]);
    expect(document.entities[0].uri).toBe("login.flo");
    expect(document.blocks.map((b) => [b.kind, b.name, b.title])).toEqual([
      ["flow", "login", "Inicio de sesión"],
      ["sequence", "detalle", null],
    ]);
  });

  it("accepts an empty document and a catalog-only document with no diagnostics", () => {
    expect(parseDocument("", "a.flo")).toEqual({ document: { uri: "a.flo", entities: [], blocks: [] }, diagnostics: [] });
    expect(parseDocument("\n// solo comentarios\n\n", "a.flo").diagnostics).toEqual([]);
    expect(parseDocument("entity a\nentity b\n", "a.flo").document.entities).toHaveLength(2);
  });

  it("reports E040 for an unknown top-level line and resumes at the next statement", () => {
    const { document, diagnostics } = parseDocument('use "./catalog.flo"\nentity a\n', "a.flo");
    expect(diagnostics.map((d) => d.code)).toEqual(["E040"]);
    expect(diagnostics[0].message).toBe("se esperaba 'entity', 'flow' o 'sequence', se encontró 'use'");
    expect(document.entities).toHaveLength(1);
  });

  it("reports a single E040 with a migration hint for an old 'diagram <kind>' file", () => {
    const old = ["diagram flowchart", "", "start[Inicio]", "end[Fin]", "start -> end : ok", ""].join("\n");
    const { document, diagnostics } = parseDocument(old, "viejo.flo");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: "E040", range: { start: { line: 1, column: 1 } } });
    expect(diagnostics[0].message).toContain("'diagram <tipo>' ya no existe");
    expect(document.blocks).toEqual([]);
  });

  it("does not add an E040 per orphaned body line after a block header fails", () => {
    const { diagnostics } = parseDocument("flow {\n  a -> b\n  b -> c\n}\nentity a\n", "a.flo");
    expect(diagnostics.map((d) => d.code)).toEqual(["E050"]);
  });

  it("reports a new E040 run after a valid statement ends the previous one", () => {
    const { diagnostics } = parseDocument("x\ny\nentity a\nz\n", "a.flo");
    expect(diagnostics.map((d) => [d.code, d.range.start.line])).toEqual([
      ["E040", 1],
      ["E040", 4],
    ]);
  });

  it("includes lexer diagnostics", () => {
    const { diagnostics } = parseDocument('flow f "sin cerrar {\n}\n', "a.flo");
    expect(diagnostics.map((d) => d.code)).toContain("E002");
  });
});
```

Nota sobre el test de "orphaned body": `flow {` da `E050`; como el header
falló, `inErrorRun` queda en `true` y las líneas `a -> b`, `b -> c` y `}`
no suman `E040`. `entity a` es válida y cierra la racha.

- [x] **Step 2: Correr los tests y ver que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/parser/document.test.ts`
Expected: FAIL — `Cannot find module './document.js'`.

- [x] **Step 3: Implementar `parser/document.ts`**

```ts
import { Lexer } from "../lexer.js";
import type { Token } from "../tokens.js";
import { TokenCursor, describeToken } from "./cursor.js";
import { parseEntity } from "./entity.js";
import { parseBlock } from "./block.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";

function topLevelMessage(token: Token): string {
  if (token.kind === "IDENT" && token.value === "diagram") {
    return "el header 'diagram <tipo>' ya no existe: declara entidades con 'entity' y diagramas con 'flow <nombre> { ... }' o 'sequence <nombre> { ... }'";
  }
  return `se esperaba 'entity', 'flow' o 'sequence', se encontró '${describeToken(token)}'`;
}

/**
 * `Document ::= (BlankLine | EntityDecl | Block)* EOF`. Las palabras clave
 * solo son especiales aquí, al inicio de una línea de nivel superior.
 *
 * Una racha de líneas inválidas consecutivas produce un solo E040 (en la
 * primera): así un archivo en la sintaxis vieja o el cuerpo huérfano de un
 * bloque cuyo header falló no generan un error por línea. La racha la corta
 * el siguiente statement válido.
 */
export function parseDocument(
  source: string,
  uri: DocumentUri
): { document: ParsedDocument; diagnostics: Diagnostic[] } {
  const lexer = new Lexer(source);
  const cursor = new TokenCursor(lexer);
  const diagnostics: Diagnostic[] = [];
  const document: ParsedDocument = { uri, entities: [], blocks: [] };
  let inErrorRun = false;

  cursor.skipNewlines();
  while (cursor.current().kind !== "EOF") {
    const token = cursor.current();
    const keyword = token.kind === "IDENT" ? token.value : null;

    if (keyword === "entity") {
      const entity = parseEntity(cursor, uri, diagnostics);
      if (entity) document.entities.push(entity);
      inErrorRun = entity === null;
    } else if (keyword === "flow" || keyword === "sequence") {
      const block = parseBlock(cursor, diagnostics);
      if (block) document.blocks.push(block);
      inErrorRun = block === null;
    } else {
      if (!inErrorRun) diagnostics.push(diagnosticAt("E040", topLevelMessage(token), token.range));
      inErrorRun = true;
      cursor.skipToNextLine();
    }
    cursor.skipNewlines();
  }

  diagnostics.push(...lexer.diagnostics);
  return { document, diagnostics };
}
```

- [x] **Step 4: Verificar**

Run: `pnpm --filter @flo/core typecheck && pnpm --filter @flo/core test`
Expected: todo verde.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/parser/document.ts packages/core/src/parser/document.test.ts
git commit -m "feat(core): parseDocument con entity y bloques al nivel superior"
```

---

## Task 4: resolver — catálogo y referencias dentro del documento

**Files:**

- Create: `packages/core/src/workspace/resolver.ts`
- Test: `packages/core/src/workspace/resolver.test.ts`

**Interfaces:**

- Consumes: `ParsedDocument`, `EntityDecl`, `parseDocument` (solo en los tests).
- Produces:
  - `type Catalog = Map<EntityId, EntityDecl>` — iterar `catalog.values()`
    da las entidades en orden de declaración (orden de inserción del `Map`).
  - `resolveDocument(document: ParsedDocument): { catalog: Catalog; diagnostics: Diagnostic[] }`
    — **muta** cada `Ref.target` de los bloques del documento.

- [x] **Step 1: Escribir los tests que fallan**

`packages/core/src/workspace/resolver.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseDocument } from "../parser/document.js";
import { resolveDocument } from "./resolver.js";

function resolve(source: string) {
  const { document } = parseDocument(source, "a.flo");
  return { document, ...resolveDocument(document) };
}

describe("resolveDocument", () => {
  it("resolves references to entities declared anywhere in the document (order-independent)", () => {
    const { document, catalog, diagnostics } = resolve("flow f {\n  a -> b\n}\nentity a\nentity b\n");
    expect(diagnostics).toEqual([]);
    expect([...catalog.keys()]).toEqual(["a", "b"]);
    const edge = document.blocks[0].edges[0];
    expect(edge.from.target).toBe("a");
    expect(edge.to.target).toBe("b");
  });

  it("reports E030 at each unresolved reference, with the fix in the message", () => {
    const { document, diagnostics } = resolve("entity a\nflow f {\n  a -> Cache\n}\n");
    expect(diagnostics).toEqual([
      {
        code: "E030",
        message: "la entidad 'Cache' no está declarada; añade 'entity Cache'",
        range: { start: { line: 3, column: 8 }, end: { line: 3, column: 13 } },
        severity: "error",
      },
    ]);
    expect(document.blocks[0].edges[0].to.target).toBeNull();
  });

  it("keeps the first declaration of a duplicated entity and reports E031 at the second one's name", () => {
    const { catalog, diagnostics } = resolve("entity a [Primera]\nentity a [Segunda]\n");
    expect(catalog.get("a")?.label).toBe("Primera");
    expect(diagnostics.map((d) => [d.code, d.range.start])).toEqual([["E031", { line: 2, column: 8 }]]);
  });

  it("reports E033 at the name of a duplicated block, across flow and sequence", () => {
    const { diagnostics } = resolve("entity a\nflow x {\n  a -> a\n}\nsequence x {\n  a -> a : y\n}\n");
    expect(diagnostics.map((d) => [d.code, d.range.start])).toEqual([["E033", { line: 5, column: 10 }]]);
  });
});
```

- [x] **Step 2: Correr los tests y ver que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/resolver.test.ts`
Expected: FAIL — `Cannot find module './resolver.js'`.

- [x] **Step 3: Implementar `workspace/resolver.ts`**

```ts
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { EntityDecl, EntityId, ParsedDocument } from "../ast.js";

export type Catalog = Map<EntityId, EntityDecl>;

/**
 * Resolución estricta dentro de un único documento: arma el catálogo (la
 * primera declaración de cada id gana), rellena `Ref.target` y reporta
 * E030/E031/E033. La Fase D lo generaliza a varios documentos vía `use`.
 */
export function resolveDocument(document: ParsedDocument): { catalog: Catalog; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const catalog: Catalog = new Map();

  for (const entity of document.entities) {
    if (catalog.has(entity.id)) {
      diagnostics.push(diagnosticAt("E031", `la entidad '${entity.id}' ya fue declarada`, entity.nameRange));
    } else {
      catalog.set(entity.id, entity);
    }
  }

  const blockNames = new Set<string>();
  for (const block of document.blocks) {
    if (blockNames.has(block.name)) {
      diagnostics.push(diagnosticAt("E033", `el bloque '${block.name}' ya fue declarado`, block.nameRange));
    }
    blockNames.add(block.name);

    for (const edge of block.edges) {
      for (const ref of [edge.from, edge.to]) {
        ref.target = catalog.has(ref.name) ? ref.name : null;
        if (ref.target === null) {
          diagnostics.push(
            diagnosticAt("E030", `la entidad '${ref.name}' no está declarada; añade 'entity ${ref.name}'`, ref.range)
          );
        }
      }
    }
  }

  return { catalog, diagnostics };
}
```

- [x] **Step 4: Verificar**

Run: `pnpm --filter @flo/core typecheck && pnpm --filter @flo/core test`
Expected: todo verde.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/workspace/resolver.ts packages/core/src/workspace/resolver.test.ts
git commit -m "feat(core): resolver de entidades y bloques dentro del documento (E030, E031, E033)"
```

---

## Task 5: layout y render sobre el catálogo; cambiar la API pública

Esta es la task del corte: `parse()`/`render()` pasan al lenguaje nuevo y
se borra el viejo. Es grande pero no divisible — layout, render,
`parse()` e `index.ts` cambian de tipos juntos.

**Files:**

- Create: `packages/core/src/layout/nodes.ts`
- Modify: `packages/core/src/layout/flowchart.ts`, `packages/core/src/layout/sequence.ts`
- Modify: `packages/core/src/render/flowchart.ts`, `packages/core/src/render/sequence.ts`, `packages/core/src/render/index.ts`
- Modify: `packages/core/src/parser/index.ts`, `packages/core/src/index.ts`, `packages/core/src/ast.ts`
- Delete: `packages/core/src/parser/flowchart.ts`, `packages/core/src/parser/flowchart.test.ts`, `packages/core/src/parser/sequence.ts`, `packages/core/src/parser/sequence.test.ts`, `packages/core/src/ast.test.ts`
- Rewrite tests: `packages/core/src/layout/flowchart.test.ts`, `packages/core/src/layout/sequence.test.ts`, `packages/core/src/render/flowchart.test.ts`, `packages/core/src/render/sequence.test.ts`, `packages/core/src/render/index.test.ts`, `packages/core/src/parser/index.test.ts`, `packages/core/src/index.test.ts`
- Modify: `packages/core/src/render/reference-diagrams.test.ts` + `render/__snapshots__/reference-diagrams.test.ts.snap` (solo borrar una entrada y renombrar una clave)

**Interfaces:**

- Consumes: `parseDocument` (Task 3), `resolveDocument`, `Catalog` (Task 4), tipos de la Task 1.
- Produces (API pública de `@flo/core` al terminar):
  - `parse(source: string, uri?: DocumentUri): ParseResult` con
    `ParseResult = { document: ParsedDocument; catalog: Catalog; diagnostics: Diagnostic[] }`,
    diagnósticos ordenados por `(line, column)`.
  - `render(source: string, uri?: DocumentUri): RenderResult` con
    `RenderResult = { diagrams: RenderedDiagram[]; diagnostics: Diagnostic[] }` y
    `RenderedDiagram = { name: string; title: string | null; kind: BlockKind; svg: string }`,
    un `RenderedDiagram` por bloque, en orden de aparición.
  - `escapeXml(value: string): string` re-exportado (lo usa web en la Task 6).
  - Internos: `blockNodes(block, catalog): BlockNode[]`,
    `layoutFlowchart(block, catalog)`, `layoutSequence(block, catalog)`,
    `renderFlowchartToSvg(layout)`, `renderSequenceToSvg(layout)`.

- [x] **Step 1: Reescribir los tests de referencia (sin tocar el valor de los snapshots)**

`packages/core/src/render/reference-diagrams.test.ts` completo:

```ts
import { describe, it, expect } from "vitest";
import { render } from "./index.js";

// Los SVG de estos snapshots son los del lenguaje anterior (`diagram <kind>`)
// y NO se regeneraron: el lenguaje nuevo tiene que producirlos byte a byte.
describe("reference diagrams (visual snapshot)", () => {
  it("renders the login flowchart from the spec (branching decision)", () => {
    const source = [
      "entity start [Inicio]",
      "entity check {Login valido}",
      "entity home [Mostrar home]",
      "entity error [Mostrar error]",
      "",
      "flow login {",
      "  start -> check",
      "  check -> home : si",
      "  check -> error : no",
      "}",
      "",
    ].join("\n");

    const { diagrams, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(diagrams[0].svg).toMatchSnapshot();
  });

  it("renders the login sequence diagram from the spec (three participants)", () => {
    const source = [
      "entity user [Usuario]",
      "entity api [API]",
      "entity db [Base de datos]",
      "",
      "sequence login {",
      "  user -> api : POST /login",
      "  api -> db : SELECT usuario",
      "  db -> api : fila",
      "  api -> user : 200 OK",
      "}",
      "",
    ].join("\n");

    const { diagrams, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(diagrams[0].svg).toMatchSnapshot();
  });

  it("renders a sequence diagram whose entities have no shape (label = id)", () => {
    const source = ["entity a", "entity b", "", "sequence s {", "  a -> b : hola", "  b -> a : chau", "}", ""].join("\n");

    const { diagrams, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(diagrams[0].svg).toMatchSnapshot();
  });
});
```

En `render/__snapshots__/reference-diagrams.test.ts.snap`, **editar a mano**:

1. Borrar la entrada completa
   `exports[\`reference diagrams (visual snapshot) > renders a flowchart with a single node and no edges 1\`] = ...;`
   (un bloque sin aristas ya no tiene nodos: el caso dejó de existir).
2. En la clave
   `reference diagrams (visual snapshot) > renders a sequence diagram with auto-declared participants (no explicit 'participant' lines) 1`
   reemplazar solo el nombre del test por
   `renders a sequence diagram whose entities have no shape (label = id)`.
   El valor (el SVG) no se toca.

**Nunca** correr vitest con `-u` en esta task.

- [x] **Step 2: Reescribir el resto de los tests**

Todos usan `parse()` para construir bloque + catálogo en vez de armar el
AST a mano:

```ts
function firstBlock(source: string) {
  const { document, catalog } = parse(source);
  return { block: document.blocks[0], catalog };
}
```

(`import { parse } from "../parser/index.js";`)

`layout/flowchart.test.ts` — conservar el `describe("measureFlowchartNode")`
tal cual; reemplazar `describe("layoutFlowchart")` por:

```ts
describe("layoutFlowchart", () => {
  it("lays out a linear chain top-to-bottom with dagre, sizing each shape correctly", () => {
    const { block, catalog } = firstBlock(
      "entity start [Inicio]\nentity check {Login valido}\nentity end (Fin)\nflow f {\n  start -> check\n  check -> end\n}\n"
    );

    expect(layoutFlowchart(block, catalog)).toEqual({
      width: 272,
      height: 340,
      nodes: [
        { id: "start", label: "Inicio", shape: "rectangle", resolved: true, x: 136, y: 45, width: 88, height: 50 },
        { id: "check", label: "Login valido", shape: "decision", resolved: true, x: 136, y: 170, width: 232, height: 80 },
        { id: "end", label: "Fin", shape: "rounded", resolved: true, x: 136, y: 295, width: 80, height: 50 },
      ],
      edges: [
        { from: "start", to: "check", label: null, points: [{ x: 136, y: 70 }, { x: 136, y: 100 }, { x: 136, y: 130 }] },
        { from: "check", to: "end", label: null, points: [{ x: 136, y: 210 }, { x: 136, y: 240 }, { x: 136, y: 270 }] },
      ],
    });
  });

  it("orders nodes by catalog declaration, not by first use in the edges", () => {
    const { block, catalog } = firstBlock("entity b\nentity a\nflow f {\n  a -> b\n}\n");
    expect(layoutFlowchart(block, catalog).nodes.map((n) => n.id)).toEqual(["b", "a"]);
  });

  it("includes only the entities the block references", () => {
    const { block, catalog } = firstBlock("entity a\nentity b\nentity unused\nflow f {\n  a -> b\n}\n");
    expect(layoutFlowchart(block, catalog).nodes.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("adds a visible, finite placeholder for an unresolved reference, after the resolved nodes", () => {
    const { block, catalog } = firstBlock("entity a [A]\nflow f {\n  ghost -> a\n}\n");
    const layout = layoutFlowchart(block, catalog);
    expect(layout.nodes.map((n) => [n.id, n.label, n.shape, n.resolved])).toEqual([
      ["a", "A", "rectangle", true],
      ["ghost", "ghost", "rectangle", false],
    ]);
    expect(layout.nodes[1].width).toBeGreaterThan(1);
    expect(layout.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(Number.isFinite(layout.width) && Number.isFinite(layout.height)).toBe(true);
  });

  it("lays out an empty block with finite dimensions", () => {
    const { block, catalog } = firstBlock("flow f {\n}\n");
    const layout = layoutFlowchart(block, catalog);
    expect(layout.nodes).toEqual([]);
    expect(Number.isFinite(layout.width) && Number.isFinite(layout.height)).toBe(true);
  });
});
```

Imports del archivo: `import { measureFlowchartNode, layoutFlowchart } from "./flowchart.js";`
y `import { parse } from "../parser/index.js";` (se borran los imports de
`FlowchartDiagram` y la constante `RANGE`).

`layout/sequence.test.ts` completo:

```ts
import { describe, it, expect } from "vitest";
import { layoutSequence } from "./sequence.js";
import { parse } from "../parser/index.js";

function firstBlock(source: string) {
  const { document, catalog } = parse(source);
  return { block: document.blocks[0], catalog };
}

describe("layoutSequence", () => {
  it("places participants in columns and a message on the first row", () => {
    const { block, catalog } = firstBlock("entity a [Alice]\nentity b [Bob]\nsequence s {\n  a -> b : hola\n}\n");

    expect(layoutSequence(block, catalog)).toEqual({
      width: 320,
      height: 190,
      lifelineTop: 50,
      lifelineBottom: 170,
      participants: [
        { id: "a", label: "Alice", resolved: true, x: 80 },
        { id: "b", label: "Bob", resolved: true, x: 240 },
      ],
      messages: [{ from: "a", to: "b", label: "hola", y: 120 }],
    });
  });

  it("increments the row for each successive message, in source order", () => {
    const { block, catalog } = firstBlock("entity a\nentity b\nsequence s {\n  a -> b : uno\n  b -> a : dos\n}\n");
    expect(layoutSequence(block, catalog).messages.map((m) => [m.label, m.y])).toEqual([
      ["uno", 120],
      ["dos", 170],
    ]);
  });

  it("orders columns by catalog declaration, with unresolved participants last", () => {
    const { block, catalog } = firstBlock("entity b\nentity a\nsequence s {\n  ghost -> a : x\n  a -> b : y\n}\n");
    expect(layoutSequence(block, catalog).participants.map((p) => [p.id, p.resolved])).toEqual([
      ["b", true],
      ["a", true],
      ["ghost", false],
    ]);
  });

  it("lays out an empty block with no columns", () => {
    const { block, catalog } = firstBlock("sequence s {\n}\n");
    const layout = layoutSequence(block, catalog);
    expect(layout.participants).toEqual([]);
    expect(layout.width).toBe(0);
  });
});
```

`render/flowchart.test.ts` completo:

```ts
import { describe, it, expect } from "vitest";
import { renderFlowchartToSvg } from "./flowchart.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import { parse } from "../parser/index.js";

function renderFirst(source: string): string {
  const { document, catalog } = parse(source);
  return renderFlowchartToSvg(layoutFlowchart(document.blocks[0], catalog));
}

describe("renderFlowchartToSvg", () => {
  it("renders a rectangle, a rounded node and a labeled edge between them", () => {
    const svg = renderFirst("entity start [Inicio]\nentity end (Fin)\nflow f {\n  start -> end : ok\n}\n");

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="200" viewBox="0 0 128 200">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g><rect x="20" y="20" width="88" height="50" rx="0" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="64" y="45" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Inicio</text></g>' +
        '<g><rect x="24" y="130" width="80" height="50" rx="12" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="64" y="155" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Fin</text></g>' +
        '<polyline points="64,70 64,100 64,130" fill="none" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" /><rect x="53" y="84" width="22" height="16" fill="#ffffff" /><text x="64" y="92" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">ok</text>' +
        "</svg>"
    );
  });

  it("renders a decision node as a polygon", () => {
    const svg = renderFirst("entity a [A]\nentity check {OK?}\nflow f {\n  a -> check\n}\n");
    expect(svg).toContain("<polygon points=");
  });

  it("renders an unresolved reference as a dashed, marked placeholder labelled with its name", () => {
    const svg = renderFirst("entity a [A]\nflow f {\n  a -> ghost\n}\n");
    expect(svg).toContain('<g class="flo-unresolved"><rect');
    expect(svg).toContain('stroke-dasharray="4 4"');
    expect(svg).toContain(">ghost<");
    expect(svg).not.toContain("NaN");
  });
});
```

(El primer caso reusa el SVG esperado exacto del test viejo: mismo input
para dagre ⇒ mismo SVG.)

`render/sequence.test.ts` completo (el primer caso conserva el SVG esperado
exacto del test viejo):

```ts
import { describe, it, expect } from "vitest";
import { renderSequenceToSvg } from "./sequence.js";
import { layoutSequence } from "../layout/sequence.js";
import { parse } from "../parser/index.js";

function renderFirst(source: string): string {
  const { document, catalog } = parse(source);
  return renderSequenceToSvg(layoutSequence(document.blocks[0], catalog));
}

describe("renderSequenceToSvg", () => {
  it("renders participant boxes, lifelines and one message with its label", () => {
    const svg = renderFirst("entity a [Alice]\nentity b [Bob]\nsequence s {\n  a -> b : hola\n}\n");

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g><g class="flo-seq-header-box"><rect x="10" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="80" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Alice</text></g><line x1="80" y1="50" x2="80" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<g><g class="flo-seq-header-box"><rect x="170" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="240" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Bob</text></g><line x1="240" y1="50" x2="240" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<line x1="80" y1="120" x2="240" y2="120" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" /><rect x="142" y="104" width="36" height="16" fill="#ffffff" /><text x="160" y="112" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">hola</text>' +
        "</svg>"
    );
  });

  it("renders an unresolved participant with a dashed box, keeping the sticky-header class", () => {
    const svg = renderFirst("entity a\nsequence s {\n  a -> ghost : x\n}\n");
    expect(svg).toContain('<g class="flo-unresolved"><g class="flo-seq-header-box">');
    expect(svg).toContain('stroke-width="2" stroke-dasharray="4 4" />');
    expect(svg).toContain(">ghost<");
  });
});
```

`render/index.test.ts` completo:

```ts
import { describe, it, expect } from "vitest";
import { render } from "./index.js";

describe("render", () => {
  it("returns no diagrams and no diagnostics for an empty file", () => {
    expect(render("")).toEqual({ diagrams: [], diagnostics: [] });
  });

  it("renders one diagram per block, in source order, with name, title and kind", () => {
    const source = [
      "entity a [A]",
      "entity b [B]",
      'flow uno "Primero" {',
      "  a -> b",
      "}",
      "sequence dos {",
      "  a -> b : hola",
      "}",
      "",
    ].join("\n");

    const { diagrams, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(diagrams.map((d) => [d.name, d.title, d.kind])).toEqual([
      ["uno", "Primero", "flow"],
      ["dos", null, "sequence"],
    ]);
    expect(diagrams[0].svg).toContain(">A<");
    expect(diagrams[1].svg).toContain('class="flo-seq-header-box"');
  });

  it("renders an entity the same way in every block that uses it", () => {
    const { diagrams } = render("entity db {Base}\nentity a\nflow x {\n  a -> db\n}\nflow y {\n  db -> a\n}\n");
    for (const diagram of diagrams) {
      expect(diagram.svg).toContain("<polygon");
      expect(diagram.svg).toContain(">Base<");
    }
  });

  it("still renders the block when an edge line has a recoverable error", () => {
    const { diagrams, diagnostics } = render("entity start [Inicio]\nentity b\nflow f {\n  start -> b\n  start ->\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E014"]);
    expect(diagrams[0].svg).toContain(">Inicio<");
  });

  it("renders a block with an unresolved reference (E030) with finite coordinates", () => {
    const { diagrams, diagnostics } = render("entity start [Inicio]\nflow f {\n  start -> ghost\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E030"]);
    expect(diagrams[0].svg).toContain('class="flo-unresolved"');
    expect(diagrams[0].svg).not.toContain("NaN");
  });

  it("computes finite dimensions for an empty block", () => {
    const { diagrams, diagnostics } = render("flow f {\n}\n");
    expect(diagnostics).toEqual([]);
    expect(diagrams[0].svg).not.toContain("Infinity");
    expect(diagrams[0].svg).not.toContain("NaN");
  });

  it("keeps both labels when two edges share the same from/to pair", () => {
    const { diagrams, diagnostics } = render("entity a\nentity b\nflow f {\n  a -> b : si\n  a -> b : no\n}\n");
    expect(diagnostics).toEqual([]);
    expect(diagrams[0].svg).toContain(">si<");
    expect(diagrams[0].svg).toContain(">no<");
  });
});
```

`parser/index.test.ts` completo:

```ts
import { describe, it, expect } from "vitest";
import { parse } from "./index.js";

describe("parse", () => {
  it("parses and resolves a document, returning the catalog", () => {
    const { document, catalog, diagnostics } = parse("entity a\nentity b\nflow f {\n  a -> b\n}\n", "f.flo");
    expect(diagnostics).toEqual([]);
    expect(document.uri).toBe("f.flo");
    expect([...catalog.keys()]).toEqual(["a", "b"]);
    expect(document.blocks[0].edges[0].from.target).toBe("a");
  });

  it("defaults the uri to an empty string", () => {
    expect(parse("entity a\n").document.entities[0].uri).toBe("");
  });

  it("collects parser, lexer and resolver diagnostics sorted by (line, column)", () => {
    const source = ["flow f {", "  a -> ghost", "  start ->", "}", "@", "entity a", ""].join("\n");
    const { diagnostics } = parse(source);
    // Sin ordenar saldrían agrupados por origen: parser (E014), luego lexer
    // (E002), luego resolver (E030).
    expect(diagnostics.map((d) => [d.code, d.range.start.line])).toEqual([
      ["E030", 2],
      ["E014", 3],
      ["E002", 5],
    ]);
  });
});
```

Nota: la línea 5 (`@`) no produce `E040`: el lexer emite `E002` al
escanear `@` y sigue hasta el `NEWLINE`, así que el parser de nivel
superior solo ve una línea en blanco.

`index.test.ts` completo:

```ts
import { describe, it, expect } from "vitest";
import { parse, render, formatDiagnostic, escapeXml } from "./index.js";

describe("index", () => {
  it("exposes parse, render, formatDiagnostic and escapeXml", () => {
    expect(parse("entity a\n").document.entities).toHaveLength(1);
    expect(render("entity a\nflow f {\n  a -> a\n}\n").diagrams).toHaveLength(1);
    expect(escapeXml("<a>")).toBe("&lt;a&gt;");
    expect(
      formatDiagnostic({
        code: "E999",
        message: "prueba",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
        severity: "error",
      })
    ).toBe("E999 error [1:1]: prueba");
  });

  it("records the declaration range and the name range of an entity separately", () => {
    const entity = parse("entity start [Inicio]\n").document.entities[0];
    expect(entity.nameRange).toEqual({ start: { line: 1, column: 8 }, end: { line: 1, column: 13 } });
    expect(entity.range).toEqual({ start: { line: 1, column: 1 }, end: { line: 1, column: 22 } });
  });
});
```

- [x] **Step 3: Correr los tests y ver que fallan**

Run: `pnpm --filter @flo/core test`
Expected: FAIL masivo (tipos y firmas nuevas todavía no existen). Es el
punto de partida esperado.

- [x] **Step 4: Crear `layout/nodes.ts`**

```ts
import type { DiagramBlock, NodeShape } from "../ast.js";
import type { Catalog } from "../workspace/resolver.js";

export interface BlockNode {
  id: string;
  label: string;
  shape: NodeShape;
  resolved: boolean;
}

/**
 * Nodos de un bloque, derivados de sus aristas (el bloque no declara nodos).
 * Las entidades resueltas van en orden de declaración del catálogo, así el
 * orden no depende de qué arista las nombra primero; las no resueltas
 * (E030) van al final, en orden de aparición, como placeholder con su
 * nombre como label.
 */
export function blockNodes(block: DiagramBlock, catalog: Catalog): BlockNode[] {
  const referenced = new Set<string>();
  const unresolved: string[] = [];
  for (const edge of block.edges) {
    for (const ref of [edge.from, edge.to]) {
      if (ref.target !== null) referenced.add(ref.target);
      else if (!unresolved.includes(ref.name)) unresolved.push(ref.name);
    }
  }

  const nodes: BlockNode[] = [];
  for (const entity of catalog.values()) {
    if (referenced.has(entity.id)) {
      nodes.push({ id: entity.id, label: entity.label, shape: entity.shape, resolved: true });
    }
  }
  for (const name of unresolved) {
    nodes.push({ id: name, label: name, shape: "rectangle", resolved: false });
  }
  return nodes;
}
```

- [x] **Step 5: Adaptar `layout/flowchart.ts`**

Cambiar los tipos y `layoutFlowchart`; `measureFlowchartNode`,
`GRAPH_OPTIONS`, `CHAR_WIDTH`, `LayoutPoint` y `finiteOrZero` quedan igual.

```ts
import dagre from "dagre";
import type { DiagramBlock, NodeShape } from "../ast.js";
import type { Catalog } from "../workspace/resolver.js";
import { blockNodes, type BlockNode } from "./nodes.js";

// ... GRAPH_OPTIONS, CHAR_WIDTH, LayoutPoint sin cambios ...

export interface FlowchartNodeLayout extends BlockNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowchartEdgeLayout {
  from: string;
  to: string;
  label: string | null;
  points: LayoutPoint[];
}

// ... FlowchartLayout, measureFlowchartNode, finiteOrZero sin cambios ...

export function layoutFlowchart(block: DiagramBlock, catalog: Catalog): FlowchartLayout {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ ...GRAPH_OPTIONS });
  graph.setDefaultEdgeLabel(() => ({}));

  // Primero todos los nodos y después todas las aristas, en ese orden: es
  // el mismo input que recibía dagre con el lenguaje anterior, y del orden
  // de inserción depende la posición final.
  const nodes = blockNodes(block, catalog);
  for (const node of nodes) {
    graph.setNode(node.id, measureFlowchartNode(node.shape, node.label));
  }
  for (const edge of block.edges) {
    graph.setEdge(edge.from.name, edge.to.name);
  }

  dagre.layout(graph);

  const graphSize = graph.graph();
  return {
    width: finiteOrZero(graphSize.width),
    height: finiteOrZero(graphSize.height),
    nodes: nodes.map((node) => {
      const laidOut = graph.node(node.id);
      return { ...node, x: laidOut.x, y: laidOut.y, width: laidOut.width, height: laidOut.height };
    }),
    edges: block.edges.map((edge) => ({
      from: edge.from.name,
      to: edge.to.name,
      label: edge.label,
      points: graph.edge(edge.from.name, edge.to.name).points,
    })),
  };
}
```

El placeholder de 1×1 del lenguaje viejo desaparece: un nodo no resuelto
ahora se mide como un rectángulo con su nombre, así que siempre tiene
ancho > 0 (el problema del `NaN` en `intersectRect` no puede volver).

- [x] **Step 6: Adaptar `layout/sequence.ts`**

```ts
import type { DiagramBlock } from "../ast.js";
import type { Catalog } from "../workspace/resolver.js";
import { blockNodes } from "./nodes.js";

// ... constantes sin cambios ...

export interface SequenceParticipantLayout {
  id: string;
  label: string;
  resolved: boolean;
  x: number;
}

// ... SequenceMessageLayout, SequenceLayout sin cambios ...

export function layoutSequence(block: DiagramBlock, catalog: Catalog): SequenceLayout {
  const participants: SequenceParticipantLayout[] = blockNodes(block, catalog).map((node, index) => ({
    id: node.id,
    label: node.label,
    resolved: node.resolved,
    x: COLUMN_WIDTH / 2 + index * COLUMN_WIDTH,
  }));

  const messages: SequenceMessageLayout[] = block.edges.map((edge, index) => ({
    from: edge.from.name,
    to: edge.to.name,
    label: edge.label ?? "", // el parser garantiza la etiqueta en `sequence`
    y: HEADER_HEIGHT + TOP_MARGIN + (index + 1) * ROW_HEIGHT,
  }));

  // ... resto sin cambios (lifelineTop, lifelineBottom, return) ...
}
```

- [x] **Step 7: Adaptar los renderers**

`render/flowchart.ts` — el render ya no recibe el AST, solo el layout:

```ts
import type { FlowchartLayout, FlowchartNodeLayout } from "../layout/flowchart.js";
import { ARROW_MARKER_ID, FILL_COLOR, STROKE_COLOR, arrowMarkerDefs, svgLabel, svgText } from "./svg.js";

// Un nodo sin resolver (E030) se dibuja igual pero punteado, para que el
// flujo se siga leyendo y el hueco del catálogo salte a la vista.
const UNRESOLVED_DASH = ' stroke-dasharray="4 4"';

function shapeElement(node: FlowchartNodeLayout): string {
  const { x, y, width, height } = node;
  const left = x - width / 2;
  const top = y - height / 2;
  const dash = node.resolved ? "" : UNRESOLVED_DASH;

  if (node.shape === "decision") {
    const points = [
      `${x},${top}`,
      `${x + width / 2},${y}`,
      `${x},${top + height}`,
      `${x - width / 2},${y}`,
    ].join(" ");
    return `<polygon points="${points}" fill="${FILL_COLOR}" stroke="${STROKE_COLOR}" stroke-width="2"${dash} />`;
  }

  const rx = node.shape === "rounded" ? 12 : 0;
  return `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${rx}" fill="${FILL_COLOR}" stroke="${STROKE_COLOR}" stroke-width="2"${dash} />`;
}

export function renderFlowchartToSvg(layout: FlowchartLayout): string {
  const nodeElements = layout.nodes.map(
    (node) =>
      `<g${node.resolved ? "" : ' class="flo-unresolved"'}>${shapeElement(node)}${svgText(node.x, node.y, node.label)}</g>`
  );

  const edgeElements = layout.edges.map((edge) => {
    const points = edge.points.map((point) => `${point.x},${point.y}`).join(" ");
    const line = `<polyline points="${points}" fill="none" stroke="${STROKE_COLOR}" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})" />`;
    if (!edge.label) {
      return line;
    }
    const mid = edge.points[Math.floor(edge.points.length / 2)];
    return `${line}${svgLabel(mid.x, mid.y - 8, edge.label)}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${arrowMarkerDefs()}${nodeElements.join("")}${edgeElements.join("")}</svg>`;
}
```

`render/sequence.ts` — quitar el parámetro `diagram` (ya no se usaba) y
marcar los no resueltos:

```ts
export function renderSequenceToSvg(layout: SequenceLayout): string {
  const xById = new Map(layout.participants.map((participant) => [participant.id, participant.x]));

  const participantElements = layout.participants.map((participant) => {
    const left = participant.x - COLUMN_WIDTH / 2 + 10;
    const boxWidth = COLUMN_WIDTH - 20;
    const dash = participant.resolved ? "" : ' stroke-dasharray="4 4"';
    const box = `<rect x="${left}" y="0" width="${boxWidth}" height="${HEADER_HEIGHT}" fill="${FILL_COLOR}" stroke="${STROKE_COLOR}" stroke-width="2"${dash} />`;
    const label = svgText(participant.x, HEADER_HEIGHT / 2, participant.label);
    const lifeline = `<line x1="${participant.x}" y1="${layout.lifelineTop}" x2="${participant.x}" y2="${layout.lifelineBottom}" stroke="${LIFELINE_COLOR}" stroke-width="1" stroke-dasharray="4 4" />`;
    const group = participant.resolved ? "<g>" : '<g class="flo-unresolved">';
    return `${group}<g class="flo-seq-header-box">${box}${label}</g>${lifeline}</g>`;
  });

  // ... messageElements y return sin cambios ...
}
```

Borrar el import de `SequenceDiagram` de `render/sequence.ts`.

- [x] **Step 8: `parse()` y `render()` públicos**

`parser/index.ts` completo:

```ts
import { parseDocument } from "./document.js";
import { resolveDocument, type Catalog } from "../workspace/resolver.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";
import type { Diagnostic } from "../diagnostics.js";

export interface ParseResult {
  document: ParsedDocument;
  catalog: Catalog;
  diagnostics: Diagnostic[];
}

function sortDiagnosticsByPosition(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column
  );
}

export function parse(source: string, uri: DocumentUri = ""): ParseResult {
  const parsed = parseDocument(source, uri);
  const resolved = resolveDocument(parsed.document);
  return {
    document: parsed.document,
    catalog: resolved.catalog,
    diagnostics: sortDiagnosticsByPosition([...parsed.diagnostics, ...resolved.diagnostics]),
  };
}
```

`render/index.ts` completo:

```ts
import { parse } from "../parser/index.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import { layoutSequence } from "../layout/sequence.js";
import { renderFlowchartToSvg } from "./flowchart.js";
import { renderSequenceToSvg } from "./sequence.js";
import type { BlockKind, DocumentUri } from "../ast.js";
import type { Diagnostic } from "../diagnostics.js";

export interface RenderedDiagram {
  name: string;
  title: string | null;
  kind: BlockKind;
  svg: string;
}

export interface RenderResult {
  diagrams: RenderedDiagram[];
  diagnostics: Diagnostic[];
}

export function render(source: string, uri: DocumentUri = ""): RenderResult {
  const { document, catalog, diagnostics } = parse(source, uri);
  const diagrams = document.blocks.map((block) => ({
    name: block.name,
    title: block.title,
    kind: block.kind,
    svg:
      block.kind === "flow"
        ? renderFlowchartToSvg(layoutFlowchart(block, catalog))
        : renderSequenceToSvg(layoutSequence(block, catalog)),
  }));
  return { diagrams, diagnostics };
}
```

`index.ts` completo:

```ts
export { Lexer } from "./lexer.js";
export type { Token, TokenKind } from "./tokens.js";
export { parse } from "./parser/index.js";
export type { ParseResult } from "./parser/index.js";
export type { Catalog } from "./workspace/resolver.js";
export { render } from "./render/index.js";
export type { RenderResult, RenderedDiagram } from "./render/index.js";
export type {
  Position,
  Range,
  NodeShape,
  EntityId,
  DocumentUri,
  EntityDecl,
  Ref,
  Edge,
  BlockKind,
  DiagramBlock,
  ParsedDocument,
} from "./ast.js";
export { formatDiagnostic } from "./diagnostics.js";
export type { Diagnostic, DiagnosticSeverity } from "./diagnostics.js";
export { escapeXml } from "./render/svg.js";
```

- [x] **Step 9: Borrar el lenguaje viejo**

```bash
git rm packages/core/src/parser/flowchart.ts packages/core/src/parser/flowchart.test.ts \
       packages/core/src/parser/sequence.ts packages/core/src/parser/sequence.test.ts \
       packages/core/src/ast.test.ts
```

En `ast.ts`, borrar `FlowchartNode`, `FlowchartEdge`, `FlowchartDiagram`,
`SequenceParticipant`, `SequenceMessage`, `SequenceDiagram`, `Diagram`,
`isFlowchartDiagram` e `isSequenceDiagram`. Quedan `Position`, `Range`,
`NodeShape` y los tipos de la Task 1.

Comprobar que no queda nada colgando:

Run: `grep -rn "FlowchartDiagram\|SequenceDiagram\|parseFlowchartBody\|parseSequenceBody\|isFlowchartDiagram\|isSequenceDiagram\|FlowchartNode\b\|SequenceMessage" packages/core/src`
Expected: sin resultados. (`lexer.test.ts` y `diagnostics.test.ts` mencionan
`participant`/`E017` como strings de prueba del lexer y del formateo: son
válidos tal cual y no se tocan.)

- [x] **Step 10: Verificar**

Run: `pnpm --filter @flo/core typecheck && pnpm --filter @flo/core test`
Expected: todo verde, **3 snapshots pasados, 0 escritos, 0 obsoletos**
(el resumen de vitest lo dice explícito). Si vitest reporta
"1 snapshot written" o "1 obsolete", el Step 1 quedó mal: revisar las
claves del `.snap`, no regenerar.

- [x] **Step 11: Commit**

```bash
git add -A packages/core/src
git commit -m "feat(core)!: layout y render desde el catálogo; parse/render sobre documentos con bloques

BREAKING CHANGE: se elimina el header 'diagram <kind>', la declaración de
nodos y 'participant'. render() devuelve un SVG por bloque."
```

---

## Task 6: adaptar `@flo/web` y los ejemplos

**Files:**

- Modify: `packages/web/src/preview.ts`, `packages/web/src/preview.test.ts`
- Modify: `packages/web/src/main.ts`
- Modify: `packages/web/src/sequence-view.ts`
- Modify: `packages/web/src/flo-highlight.ts`, `packages/web/src/flo-highlight.test.ts`
- Modify: `packages/web/src/editor.test.ts`
- Modify: `packages/web/src/examples.ts`, `examples/01-flowchart.flo`, `examples/02-sequence.flo`
- Modify: `packages/web/index.html` (estilo del título de bloque)

**Interfaces:**

- Consumes: `render`, `RenderResult`, `RenderedDiagram`, `escapeXml` de `@flo/core` (Task 5).
- Produces: `PreviewState = { lastDiagrams: RenderedDiagram[] }`.

- [x] **Step 1: Reconstruir core**

Run: `pnpm --filter @flo/core build`
Expected: OK. Desde ahora `pnpm --filter @flo/web typecheck` falla hasta
terminar esta task — es el punto de partida.

- [x] **Step 2: Escribir los tests que fallan**

`packages/web/src/preview.test.ts` completo:

```ts
import { describe, it, expect } from "vitest";
import type { Diagnostic, RenderResult, RenderedDiagram } from "@flo/core";
import { nextPreviewState, previewHtml, type PreviewState } from "./preview.js";

const ERROR: Diagnostic = {
  code: "E040",
  message: "x",
  range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
  severity: "error",
};

function diagram(name: string, svg: string, title: string | null = null): RenderedDiagram {
  return { name, title, kind: "flow", svg };
}

describe("nextPreviewState", () => {
  it("keeps the last diagrams when the new render has none and has errors", () => {
    const state: PreviewState = { lastDiagrams: [diagram("a", "<svg>OLD</svg>")] };
    const result: RenderResult = { diagrams: [], diagnostics: [ERROR] };
    expect(nextPreviewState(state, result)).toBe(state);
  });

  it("replaces the last diagrams when the new render has some", () => {
    const state: PreviewState = { lastDiagrams: [diagram("a", "<svg>OLD</svg>")] };
    const result: RenderResult = { diagrams: [diagram("b", "<svg>NEW</svg>")], diagnostics: [] };
    expect(nextPreviewState(state, result).lastDiagrams).toEqual(result.diagrams);
  });

  it("clears the diagrams for a valid document with no blocks", () => {
    const state: PreviewState = { lastDiagrams: [diagram("a", "<svg>OLD</svg>")] };
    expect(nextPreviewState(state, { diagrams: [], diagnostics: [] }).lastDiagrams).toEqual([]);
  });
});

describe("previewHtml", () => {
  it("renders each diagram in its own section, titled with its title or its name", () => {
    const result: RenderResult = {
      diagrams: [diagram("login", "<svg>1</svg>", "Inicio de sesión"), diagram("detalle", "<svg>2</svg>")],
      diagnostics: [],
    };
    expect(previewHtml({ lastDiagrams: [] }, result)).toBe(
      '<section class="flo-block"><h2 class="flo-block-title">Inicio de sesión</h2><svg>1</svg></section>' +
        '<section class="flo-block"><h2 class="flo-block-title">detalle</h2><svg>2</svg></section>'
    );
  });

  it("escapes the block title (it comes from user source)", () => {
    const result: RenderResult = {
      diagrams: [diagram("x", "<svg></svg>", '<img src=x onerror="alert(1)">')],
      diagnostics: [],
    };
    const html = previewHtml({ lastDiagrams: [] }, result);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("prefixes an error banner over the last valid diagrams when the current render has none", () => {
    const state: PreviewState = { lastDiagrams: [diagram("a", "<svg>OLD</svg>")] };
    const html = previewHtml(state, { diagrams: [], diagnostics: [ERROR, ERROR] });
    expect(html).toBe(
      '<div class="flo-banner">2 errores</div><section class="flo-block"><h2 class="flo-block-title">a</h2><svg>OLD</svg></section>'
    );
  });

  it("shows the empty-state placeholder when there is nothing to show", () => {
    expect(previewHtml({ lastDiagrams: [] }, { diagrams: [], diagnostics: [ERROR] })).toBe(
      '<div class="flo-banner">1 error</div><div class="flo-empty">Escribí un diagrama .flo para ver el preview</div>'
    );
  });
});
```

En `packages/web/src/editor.test.ts`, en los dos primeros casos:

- fuente inicial `"diagram flowchart\n\nstart[Inicio]\n"` →
  `"entity start [Inicio]\nentity check [Otro]\n\nflow f {\n  start -> check\n}\n"`;
- el `insert` del primer caso →
  `"flow g {\n  check -> start\n}\n"`;
- `results[0].svg` / `results[1].svg` → `results[0].diagrams[0].svg` /
  `results[1].diagrams[0].svg` (siguen esperando `">Inicio<"`).

El caso de `setEditorSource(view, "diagram sequence\n")` compara strings
opacos: no cambia. Los tests de `storage.test.ts` y `file-io.test.ts` usan
`"diagram flowchart\n"` como contenido opaco de archivo: **no se tocan**.

En `packages/web/src/flo-highlight.test.ts`, borrar el caso
`"classifies the alias after 'as' as text"` y agregar:

```ts
  it("does not treat 'as' as a text trigger anymore", () => {
    const source = "entity as [Alias]\n";
    const doc = Text.of(source.split("\n"));
    const idents = buildHighlightRanges(doc)
      .filter((r) => r.className === "flo-tok-ident")
      .map((r) => source.slice(r.from, r.to));
    expect(idents).toEqual(["entity", "as"]);
  });
```

- [x] **Step 3: Correr los tests y ver que fallan**

Run: `pnpm --filter @flo/web test`
Expected: FAIL en `preview.test.ts`, `editor.test.ts` y el test nuevo de
`flo-highlight`.

- [x] **Step 4: Implementar**

`packages/web/src/preview.ts` completo:

```ts
import { escapeXml, type RenderResult, type RenderedDiagram } from "@flo/core";

export interface PreviewState {
  lastDiagrams: RenderedDiagram[];
}

// Sin bloques y con errores = el documento no se pudo usar (p. ej. mientras
// se escribe un header); se mantiene el último preview válido. Un documento
// válido sin bloques (solo catálogo) sí vacía el preview.
export function nextPreviewState(state: PreviewState, result: RenderResult): PreviewState {
  if (result.diagrams.length === 0 && result.diagnostics.length > 0) return state;
  return { lastDiagrams: result.diagrams };
}

export function previewHtml(state: PreviewState, result: RenderResult): string {
  const diagrams = nextPreviewState(state, result).lastDiagrams;
  const count = result.diagnostics.length;
  const banner = count > 0 ? `<div class="flo-banner">${count} error${count === 1 ? "" : "es"}</div>` : "";
  const body =
    diagrams.length > 0
      ? diagrams
          .map(
            (diagram) =>
              `<section class="flo-block"><h2 class="flo-block-title">${escapeXml(diagram.title ?? diagram.name)}</h2>${diagram.svg}</section>`
          )
          .join("")
      : '<div class="flo-empty">Escribí un diagrama .flo para ver el preview</div>';
  return `${banner}${body}`;
}
```

`packages/web/src/main.ts`:

```ts
const NEW_SOURCE: Record<DiagramKind, string> = {
  flowchart: ["flow nuevo {", "", "}", ""].join("\n"),
  sequence: ["sequence nuevo {", "", "}", ""].join("\n"),
};
```

- `let previewState: PreviewState = { lastSvg: null };` →
  `let previewState: PreviewState = { lastDiagrams: [] };`
- en `onExportSvg` y `onExportPng`, reemplazar `previewState.lastSvg` por
  una constante local:

```ts
    onExportSvg() {
      try {
        // ponytail: exporta el primer bloque; elegir cuál llega con el explorador (Fase F).
        const svg = previewState.lastDiagrams[0]?.svg;
        if (svg) exportSvg(svg);
      } catch (error) {
        reportActionError("Exportar SVG", error);
      }
    },
    async onExportPng() {
      try {
        const svg = previewState.lastDiagrams[0]?.svg;
        if (svg) await exportPng(svg);
      } catch (error) {
        reportActionError("Exportar PNG", error);
      }
    },
```

`packages/web/src/sequence-view.ts` — procesar cada SVG del preview, no
solo el primero. Envolver el cuerpo actual en una función por SVG:

```ts
// Envuelve los headers de los participantes de cada sequence diagram en un
// <svg> aparte, pegado con position:sticky, para que queden visibles al
// hacer scroll. Cada diagrama vive en su propia <section>, que es el
// contenedor del sticky: el header de un bloque no se monta sobre el
// siguiente. Los SVG sin headers (flowcharts) no se tocan.
export function enhanceSequencePreview(container: HTMLElement): void {
  // querySelectorAll es una lista estática: los <svg> de header que se
  // insertan en el loop no se vuelven a procesar.
  container.querySelectorAll("svg").forEach((svg) => enhanceOne(container, svg));
}

function enhanceOne(container: HTMLElement, svg: SVGSVGElement): void {
  const headerBoxes = svg.querySelectorAll(`.${HEADER_BOX_CLASS}`);
  if (headerBoxes.length === 0) return;
  // ... resto del cuerpo actual sin cambios, desde `const width = ...`
  //     hasta `svg.before(sticky);` ...
}
```

`packages/web/src/flo-highlight.ts` — quitar el disparador de `as`:

```ts
    } else if (token.kind === "COLON") {
      pushToken(lexer.readTextUntil("\n"));
    }
```

y actualizar el comentario de arriba de `TEXT_CLOSER_BY_OPEN`: _"replica
aquí, sin condición alguna, los disparadores de modo texto: abrir
'['/'('/'{' y ':'"_. Agregar al final de ese comentario:
`// ponytail: tras "type:" colorea el resto de la línea como texto; resaltar propiedades de entity requiere un highlighter con gramática.`

`packages/web/index.html`, dentro del `<style>` junto a `.flo-banner`:

```css
      .flo-block + .flo-block {
        margin-top: 32px;
      }
      .flo-block-title {
        margin: 0 0 8px;
        font: 600 14px sans-serif;
        color: #374151;
      }
```

- [x] **Step 5: Reescribir los ejemplos**

`examples/01-flowchart.flo`:

```flo
// Flujo de compra completo: carrito -> stock -> pasarela de pago -> orden.
// Las entidades se declaran una vez (id, forma y label) y el flujo solo
// las conecta. Usa las tres formas y aristas con y sin etiqueta.
entity inicio (Cliente en el carrito)
entity checkout [Confirmar compra]
entity stock {¿Hay stock?}
entity sinstock [Mostrar "sin stock"]
entity reservar [Reservar inventario]
entity crearorden [Crear orden pendiente]
entity pago [Redirigir a pasarela de pago]
entity resultado {¿Pago aprobado?}
entity reintentar {¿Reintentar pago?}
entity confirmar [Confirmar orden]
entity email [Enviar email de confirmación]
entity liberar [Liberar inventario reservado]
entity exito (Compra exitosa)
entity cancelada (Orden cancelada)

flow compra "Flujo de compra" {
  inicio -> checkout
  checkout -> stock
  stock -> sinstock : no
  stock -> reservar : sí
  sinstock -> inicio : volver al carrito

  // Las entidades pueden declararse en cualquier parte del archivo;
  // el orden no importa.
  reservar -> crearorden
  crearorden -> pago
  pago -> resultado

  resultado -> confirmar : aprobado
  resultado -> reintentar : rechazado
  reintentar -> pago : sí
  reintentar -> liberar : no
  liberar -> cancelada

  confirmar -> email
  email -> exito
}
```

`examples/02-sequence.flo`:

```flo
// El mismo flujo de compra que 01-flowchart.flo, pero como secuencia:
// frontend, backend, pasarela de pago y el webhook async de confirmación.
// El orden de las columnas es el orden en que se declaran las entidades.
entity cliente [Cliente]       type: actor
entity web     [Web]           type: frontend
entity api     [Backend]       type: service, tags: http
entity gw      [Pasarela de pago] {
  type: external
  tags: http pagos
}
entity db      [Base de datos] type: store
entity mail

sequence checkout "Checkout" {
  cliente -> web : Click "Comprar"
  web -> api : POST /checkout
  api -> db : SELECT stock
  db -> api : stock disponible
  api -> db : INSERT orden (pendiente)
  api -> gw : POST /charges
  gw -> api : 201 Created (redirect_url)
  api -> web : 200 OK (redirect_url)
  web -> cliente : Redirige a la pasarela
  cliente -> gw : Completa datos de la tarjeta
}

// El webhook llega en su propia request, fuera del flujo síncrono: va en
// su propio bloque, sobre las mismas entidades.
sequence webhook "Webhook de pago" {
  gw -> api : POST /webhook/pago-aprobado
  api -> db : UPDATE orden SET estado = pagada
  api -> gw : 200 OK
  api -> mail : Enviar email de confirmación
  mail -> cliente : "Tu compra fue exitosa"
}
```

En `packages/web/src/examples.ts`, reemplazar el `source` de cada ejemplo
por el contenido exacto del `.flo` correspondiente (el comentario del
archivo dice que son el mismo contenido). Agregar un test que lo garantice
en `packages/web/src/examples.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { render } from "@flo/core";
import { EXAMPLES } from "./examples.js";

describe("EXAMPLES", () => {
  it.each(EXAMPLES)("$id renders with no diagnostics", (example) => {
    const { diagrams, diagnostics } = render(example.source);
    expect(diagnostics).toEqual([]);
    expect(diagrams.length).toBeGreaterThan(0);
  });
});
```

- [x] **Step 6: Verificar**

Run: `pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: todo verde.

Comprobar que los ejemplos del repo y los del visor son idénticos:

Run: `node -e "const s=require('fs').readFileSync('packages/web/src/examples.ts','utf8');for(const f of ['examples/01-flowchart.flo','examples/02-sequence.flo']){const c=require('fs').readFileSync(f,'utf8');console.log(f,s.includes(c.trimEnd()))}"`
Expected: `true` para los dos. (Si `examples.ts` escapa algún carácter del
template literal, p. ej. un backtick, ajustar la comprobación a mano.)

Prueba manual en el navegador (`pnpm --filter @flo/web dev`): cargar el
ejemplo de secuencia ⇒ dos bloques con título, cada uno con su header
sticky al hacer scroll; borrar `entity mail` ⇒ banner de 2 errores y
`mail` punteado en el bloque `webhook`.

- [x] **Step 7: Commit**

```bash
git add packages/web examples
git commit -m "feat(web): preview de varios bloques con título y ejemplos en la sintaxis de entidades"
```

---

## Task 7: documentación

**Files:**

- Modify: `packages/core/GRAMMAR.md` (reescrito)
- Modify: `docs/SYNTAX.md` (reescrito)
- Modify: `README.md` (secciones de sintaxis y API)
- Modify: `examples/README.md`

**Interfaces:** ninguna (solo docs).

- [x] **Step 1: Reescribir `packages/core/GRAMMAR.md`**

Estructura y contenido obligatorio:

1. EBNF completa:

```
Document     ::= (BlankLine | EntityDecl | Block)* EOF
BlankLine    ::= Newline

EntityDecl   ::= "entity" Ident Shape? PropList? EntityBody? Newline
Shape        ::= "[" Text "]" | "(" Text ")" | "{" Text "}"
PropList     ::= Prop ("," Prop)*
Prop         ::= "type" ":" Ident | "tags" ":" Ident+
EntityBody   ::= "{" Newline (PropList? Newline)* "}"

Block        ::= ("flow" | "sequence") Ident String? "{" Newline BlockLine* "}" Newline
BlockLine    ::= (Edge)? Newline
Edge         ::= Ident "->" Ident (":" Text)?     (* en sequence ":" Text es obligatorio *)

Ident        ::= (letra ASCII | "_") (letra ASCII | dígito | "_")*
Text         ::= cualquier carácter excepto el delimitador de cierre
                  y el salto de línea; se recorta espacio inicial/final
String       ::= '"' (carácter excepto '"' y newline)* '"'
Comment      ::= "//" cualquier carácter hasta fin de línea
```

2. Reglas léxicas y de parseo (reemplazan la sección actual):
   - El lexer es pasivo; el texto lo pide el parser (`readTextUntil`) tras
     el delimitador de `Shape` y tras `:` en `Edge`. (Conservar el párrafo
     actual adaptado; quitar toda mención de `as` y `participant`.)
   - `entity`, `flow` y `sequence` son palabras clave **solo al inicio de
     una línea de nivel superior**; dentro de un bloque son identificadores
     comunes (`flow -> entity` es una arista válida).
   - `{` tras el id de una entidad: si el resto de la línea está vacío o es
     un comentario, abre el cuerpo; si no, es la forma `{decisión}`.
   - Sin forma, una entidad es un rectángulo con su id como label.
   - `type` admite un identificador; `tags`, uno o más. Otras propiedades
     son `E034`.
   - El `}` de un bloque o de un cuerpo de entidad va en su propia línea.
   - Un bloque solo contiene aristas; sus nodos se derivan de las entidades
     que referencia. Toda referencia debe resolver a una `entity` del mismo
     documento, declarada antes o después (`E030` si no). La primera
     declaración de un id gana (`E031` para las siguientes). Los nombres de
     bloque son únicos (`E033`).
   - Orden de nodos/columnas: orden de declaración de las entidades; las
     referencias sin resolver, al final, dibujadas punteadas.
   - Recuperación: una línea que no parsea se descarta sin escanear el resto
     (sin `E002` espurios). Una racha de líneas inválidas de nivel superior
     da un solo `E040`. Si falta el `}` de un bloque, `E052` y el bloque se
     conserva con lo parseado; un bloque sin cerrar se traga lo que sigue
     (las palabras clave no se reconocen dentro de un cuerpo) — limitación
     conocida.

3. "Fuera de esta gramática": `use` y multi-documento (Fase D);
   subgrafos, `alt`/`loop`, notas, estilos.

4. La tabla de diagnósticos: **copiar la "Tabla de diagnósticos al
   terminar" de este plan** (columnas Código / Origen / Significado, sin la
   columna Estado) y debajo la línea de códigos retirados.

- [x] **Step 2: Reescribir `docs/SYNTAX.md`**

Guía para quien escribe diagramas (no la gramática), mismo tono que la
actual. Secciones: (1) un documento tiene entidades y bloques — ejemplo
corto del spec §4.1 + §4.2 sin `use`; (2) `entity`: las tres formas, sin
forma, `type`/`tags` en línea y en cuerpo; (3) `flow`: aristas con y sin
etiqueta, título opcional; (4) `sequence`: etiqueta obligatoria, columnas
en orden de declaración; (5) errores más comunes: `E030` con su fix,
`E040` al abrir un archivo con `diagram <tipo>` (cómo migrarlo: cada nodo
pasa a `entity`, las aristas van dentro de `flow nombre { ... }`,
`participant x as Y` pasa a `entity x [Y]`); (6) uso desde código:

```ts
import { render } from "@flo/core";

const { diagrams, diagnostics } = render(source);
// un elemento por bloque: { name, title, kind: "flow" | "sequence", svg }
```

- [x] **Step 3: Actualizar `README.md` y `examples/README.md`**

- `README.md`: reemplazar los dos ejemplos de sintaxis (líneas ~20–40) por
  un único documento con entidades + un `flow` + un `sequence`, y la
  sección de API (líneas ~56–80) por la forma nueva de `parse()`
  (`{ document, catalog, diagnostics }`) y `render()` (`{ diagrams,
  diagnostics }`). Quitar las frases sobre `diagram` nulo y header inválido.
- `examples/README.md`: actualizar la columna "Qué muestra" (01: entidades
  con las tres formas, un bloque `flow` con título; 02: entidades con
  `type`/`tags` en línea y en cuerpo, entidad sin forma, dos bloques
  `sequence` sobre las mismas entidades) y el snippet final a
  `const { diagrams, diagnostics } = render(source);`.

Comprobar que no queda sintaxis vieja en la documentación viva:

Run: `grep -rn "diagram flowchart\|diagram sequence\|participant " README.md docs/SYNTAX.md examples packages/core/GRAMMAR.md`
Expected: solo menciones dentro de la sección de migración de `docs/SYNTAX.md`.

- [x] **Step 4: Verificación final**

Run: `pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: todo verde; snapshots de referencia: 3 pasados, 0 escritos, 0 obsoletos.

- [x] **Step 5: Commit**

```bash
git add packages/core/GRAMMAR.md docs/SYNTAX.md README.md examples/README.md
git commit -m "docs: gramática y guía de sintaxis de entidades y bloques nombrados"
```

---

## Al terminar

`.flo` es un lenguaje de catálogo + vistas dentro de un documento:

- Una entidad se declara una vez y se ve igual en todos los bloques que la
  usan; renombrarla o cambiar su forma es editar una línea.
- Un archivo puede tener varios `flow`/`sequence` con nombre y título, y el
  editor los muestra todos.
- Toda referencia se resuelve estrictamente; el hueco se reporta (`E030`)
  y se dibuja, sin romper el resto del diagrama.
- `workspace/resolver.ts` es el punto donde la Fase D enchufa `use` y
  varios documentos: pasa de "un `ParsedDocument`" a "los documentos
  alcanzables", sin tocar parser, layout ni render.
