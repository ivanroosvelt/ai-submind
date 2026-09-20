# .flo — `Range` en el AST + lexer dirigido por el parser (Fases A y B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar `@flo/core` con (A) rangos de inicio-fin en tokens,
diagnósticos y nodos del AST, y (B) un lexer perezoso cuyos modos los
decide el parser. Ambas cosas son prerrequisito de las entidades
centralizadas y de la navegación, y ninguna cambia la sintaxis de `.flo`:
al terminar este plan, los mismos archivos `.flo` de hoy siguen parseando
y renderizando igual, con la misma tabla de diagnósticos.

**Architecture:** Fase A es un cambio transversal de tipos —
`{ line, column }` suelto pasa a `Range { start, end }` en `Token`,
`Diagnostic` y los nodos del AST, con el lexer como única fuente de los
rangos (es el único que conoce el span real de cada token, incluido el
recorte de los `TEXT`). Fase B invierte el control del lexado: hoy
`tokenize(source)` devuelve un `Token[]` completo y decide a ciegas cuándo
entrar en modo texto (al ver `[`, `(`, `{`, `:` o la palabra `as`); pasa a
ser una clase `Lexer` perezosa con `next()` y `readTextUntil(closer)`,
donde el parser —que sí sabe en qué posición sintáctica está— pide el modo.
Eso elimina la ambigüedad de `{` (hoy imposible de usar como delimitador de
bloque) y vuelve `as` contextual.

**Tech Stack:** TypeScript 5 (strict), Vitest. **Sin dependencias nuevas**,
ni de runtime ni de desarrollo.

**Spec:** `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
(§5 prerrequisito del lexer, §6.1 tipos clave, §10 Fases A y B)

## Global Constraints

- **Sin cambios de sintaxis.** Ningún archivo `.flo` que hoy parsea sin
  diagnostics puede empezar a fallar, y ninguno que hoy falla puede pasar
  a ser válido. Los snapshots de
  `packages/core/src/render/reference-diagrams.test.ts` y de
  `packages/core/src/render/__snapshots__/` **no se regeneran**: si un
  snapshot de SVG cambia, es un bug de la refactorización, no un snapshot
  desactualizado.
- **La tabla de diagnósticos no cambia.** Mismos códigos `E001`–`E027`,
  mismos mensajes, mismas posiciones de _inicio_. Lo único que se agrega es
  el `end`. No se introducen los códigos `E030`+ en este plan.
- No se agrega `entity`, ni bloques nombrados, ni `use`: eso es la Fase C
  en adelante.
- `tsconfig.base.json` usa `"module": "NodeNext"` /
  `"moduleResolution": "NodeNext"` — todo import relativo dentro de
  `packages/core/src/` lleva sufijo `.js` explícito (p.ej.
  `from "../ast.js"`). No es opcional: sin el sufijo, `tsc`/Node fallan al
  resolver el módulo.
- Esta ronda no toca `packages/web/` ni agrega dependencias.
- `pnpm -r typecheck` y `pnpm -r test` en verde al cerrar cada task.
- Commits pequeños, uno por task, mismo estilo que el historial
  (`git log --oneline`): `refactor(core): ...` para los cambios internos,
  `feat(core): ...` donde se agrega superficie nueva.

---

# Fase A — `Position` → `Range`

## Task 1: `Range` en `ast.ts` y `Token.range` producido por el lexer

**Files:**

- Modify: `packages/core/src/ast.ts`
- Modify: `packages/core/src/tokens.ts`
- Modify: `packages/core/src/lexer.ts`
- Modify: `packages/core/src/parser/index.ts`, `parser/flowchart.ts`, `parser/sequence.ts` (adaptación mecánica)
- Test: `packages/core/src/lexer.test.ts`, `packages/core/src/ast.test.ts`

**Interfaces:**

- Produces: `Range` en `ast.ts`; `Token.range` reemplaza `Token.line` /
  `Token.column` — consumido por todos los parsers y por las Tasks 2, 3 y 5.

- [ ] **Step 1: Escribir los tests que fallan**

En `packages/core/src/lexer.test.ts`, agregar casos que verifiquen el span
completo, no solo el inicio:

```typescript
it('gives each token a range covering its full span', () => {
  const { tokens } = tokenize('start -> check\n');
  expect(tokens[0].range).toEqual({
    start: { line: 1, column: 1 },
    end: { line: 1, column: 6 }
  });
  expect(tokens[1].range).toEqual({
    start: { line: 1, column: 7 },
    end: { line: 1, column: 9 }
  });
});

it('ranges a TEXT token over the source span, not the trimmed value', () => {
  const { tokens } = tokenize('start[  Inicio  ]\n');
  const text = tokens.find((t) => t.kind === 'TEXT')!;
  expect(text.value).toBe('Inicio');
  expect(text.range).toEqual({
    start: { line: 1, column: 7 },
    end: { line: 1, column: 17 }
  });
});
```

Nota sobre la convención: `end` es **exclusivo** (apunta a la columna
siguiente al último carácter del token), igual que LSP. El span de un
token de un solo carácter es `end.column === start.column + 1`. El `end`
de un `TEXT` cubre el texto **sin recortar** — el `value` va trimeado pero
el rango refleja lo que hay en el archivo.

- [ ] **Step 2: Definir `Range` en `ast.ts`**

```typescript
export interface Position {
  line: number;
  column: number;
}

/** `end` es exclusivo: apunta a la posición siguiente al último carácter. */
export interface Range {
  start: Position;
  end: Position;
}
```

`Position` se mantiene exportado: sigue siendo el tipo de los extremos.

- [ ] **Step 3: Cambiar `Token` en `tokens.ts`**

```typescript
import type { Range } from "./ast.js";

export type TokenKind = /* sin cambios */;

export interface Token {
  kind: TokenKind;
  value: string;
  range: Range;
}
```

- [ ] **Step 4: Producir los rangos en `lexer.ts`**

En `push()`, capturar la posición actual como `end` en lugar de recibir
solo el inicio:

```typescript
function push(kind: TokenKind, value: string, start: Position): void {
  tokens.push({ kind, value, range: { start, end: { line, column } } });
}
```

Como `advance()` ya mantiene `line`/`column` actualizados, en el momento de
llamar a `push()` el cursor está justo después del token y `{ line, column }`
es el `end` correcto — incluye gratis el caso del `TEXT` recortado.

Reemplazar los `startLine`/`startColumn` sueltos por un único
`const start: Position = { line, column }` al tope del bucle. El token
`EOF` final queda con `range` vacío (`start === end` en la posición final).

- [ ] **Step 5: Adaptar los parsers (mecánico)**

En `parser/index.ts`, `parser/flowchart.ts` y `parser/sequence.ts`,
reemplazar cada `token.line` por `token.range.start.line` y cada
`token.column` por `token.range.start.column`. **No cambiar nada más en
esta task** — los diagnósticos siguen teniendo `line`/`column` planos hasta
la Task 2.

- [ ] **Step 6: Verificar**

Run: `pnpm --filter @flo/core test && pnpm --filter @flo/core typecheck`
Expected: todo en verde, snapshots de SVG **sin cambios**.

- [ ] **Step 7: Commit**

`refactor(core): dar a cada token un Range de inicio-fin`

---

## Task 2: `Diagnostic.range`

**Files:**

- Modify: `packages/core/src/diagnostics.ts`
- Modify: `packages/core/src/lexer.ts`, `parser/index.ts`, `parser/flowchart.ts`, `parser/sequence.ts`
- Test: `packages/core/src/diagnostics.test.ts` y los tests de parser existentes

**Interfaces:**

- Produces: `Diagnostic` con `range: Range` en lugar de `line` / `column`;
  `diagnosticAt(code, message, range, severity?)` como factory.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
// packages/core/src/diagnostics.test.ts
it('formats a diagnostic from the start of its range', () => {
  expect(
    formatDiagnostic({
      code: 'E017',
      message: "el nodo 'db' no fue declarado",
      range: { start: { line: 3, column: 1 }, end: { line: 3, column: 3 } },
      severity: 'error'
    })
  ).toBe("E017 error [3:1]: el nodo 'db' no fue declarado");
});
```

El formato de salida de `formatDiagnostic` **no cambia** — sigue mostrando
solo el inicio. El `end` es para el editor, no para el texto.

Y en los tests de parser, un caso que fije que el subrayado cubre el token
culpable y no la línea entera:

```typescript
it('ranges E017 over the offending identifier', () => {
  const { diagnostics } = parse(
    'diagram flowchart\nstart[Inicio]\nstart -> db\n'
  );
  const e017 = diagnostics.find((d) => d.code === 'E017')!;
  expect(e017.range).toEqual({
    start: { line: 3, column: 10 },
    end: { line: 3, column: 12 }
  });
});
```

⚠️ Esto es un cambio de comportamiento intencional: hoy `E017` se reporta
en la posición del nodo **origen** de la arista (`edge.position`), no en el
id que falta. Con rangos, apuntar al identificador culpable es lo correcto
y es lo que hace útil el subrayado. Requiere que `FlowchartEdge` guarde los
rangos de sus dos extremos — se resuelve en la Task 3, así que **esta
aserción se escribe en la Task 3, no aquí**. En la Task 2 basta con
verificar que `E017` conserva su posición de inicio actual.

- [ ] **Step 2: Cambiar `Diagnostic` y agregar la factory**

```typescript
import type { Range } from './ast.js';

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  code: string;
  message: string;
  range: Range;
  severity: DiagnosticSeverity;
}

export function diagnosticAt(
  code: string,
  message: string,
  range: Range,
  severity: DiagnosticSeverity = 'error'
): Diagnostic {
  return { code, message, range, severity };
}

export function formatDiagnostic(d: Diagnostic): string {
  return `${d.code} ${d.severity} [${d.range.start.line}:${d.range.start.column}]: ${d.message}`;
}
```

- [ ] **Step 3: Migrar todos los sitios de construcción**

Hoy cada diagnóstico se arma como objeto literal inline (hay ~20 sitios
entre lexer y parsers). Reemplazar todos por `diagnosticAt(...)` pasando
`token.range`. Esto centraliza la forma y hace que el próximo cambio de
`Diagnostic` sea un solo sitio.

Dos casos especiales a no romper:

- `E001` (bracket sin cerrar) se reporta en la posición del **abre**, no
  del cursor: el rango va del `[` al final de la línea.
- `E017` conserva por ahora `edge.position`, convertido a un rango
  degenerado (`start === end`). La Task 3 lo arregla.

- [ ] **Step 4: Actualizar `sortDiagnosticsByPosition` en `parser/index.ts`**

Ordena por `d.range.start.line` y luego `d.range.start.column`.

- [ ] **Step 5: Verificar**

Run: `pnpm --filter @flo/core test && pnpm --filter @flo/core typecheck`
Expected: verde. Todos los tests de diagnósticos existentes necesitan
adaptar su forma esperada (`line`/`column` → `range`); los **códigos,
mensajes y posiciones de inicio no cambian**.

- [ ] **Step 6: Commit**

`refactor(core): reemplazar line/column por Range en Diagnostic`

---

## Task 3: `range` y `nameRange` en los nodos del AST

**Files:**

- Modify: `packages/core/src/ast.ts`
- Modify: `packages/core/src/parser/flowchart.ts`, `parser/sequence.ts`
- Modify: `packages/core/src/layout/flowchart.ts`, `layout/sequence.ts` (solo si leen `position`)
- Test: `packages/core/src/ast.test.ts`, `parser/flowchart.test.ts`, `parser/sequence.test.ts`

**Interfaces:**

- Produces: nodos del AST con `range` (declaración completa) y `nameRange`
  (solo el identificador); `FlowchartEdge` / `SequenceMessage` con
  `fromRange` / `toRange`. Consumido por las Fases C–E (navegación,
  `data-flo-*`, rename).

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
it('records the full declaration range and the name range separately', () => {
  const { diagram } = parse('diagram flowchart\nstart[Inicio]\n');
  const node = (diagram as FlowchartDiagram).nodes[0];
  expect(node.nameRange).toEqual({
    start: { line: 2, column: 1 },
    end: { line: 2, column: 6 }
  });
  expect(node.range).toEqual({
    start: { line: 2, column: 1 },
    end: { line: 2, column: 14 }
  });
});

it('records the range of each edge endpoint', () => {
  const { diagram } = parse('diagram flowchart\na[A]\nb[B]\na -> b : ok\n');
  const edge = (diagram as FlowchartDiagram).edges[0];
  expect(edge.fromRange.start).toEqual({ line: 4, column: 1 });
  expect(edge.toRange.start).toEqual({ line: 4, column: 6 });
});
```

Más la aserción de `E017` sobre el identificador culpable que quedó
diferida en la Task 2.

- [ ] **Step 2: Cambiar el AST**

```typescript
export interface FlowchartNode {
  id: string;
  shape: NodeShape;
  label: string;
  range: Range; // toda la declaración: `start[Inicio]`
  nameRange: Range; // solo `start`
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label: string | null;
  range: Range; // toda la arista
  fromRange: Range; // solo el id origen
  toRange: Range; // solo el id destino
}

export interface SequenceParticipant {
  id: string;
  label: string;
  range: Range;
  nameRange: Range;
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  range: Range;
  fromRange: Range;
  toRange: Range;
}
```

El campo `position: Position` desaparece de los cuatro tipos.

Por qué dos rangos: `nameRange` es el destino del "ir a definición" y lo
que se sustituye al renombrar; `range` es para plegado, hit-test del cursor
y el panel de detalle.

- [ ] **Step 3: Poblarlos en los parsers**

En `parser/flowchart.ts`, el `nameRange` es `id.range` y el `range` va de
`id.range.start` al `end` del token de cierre (`]`, `)`, `}`) o del último
token consumido de la arista. Mismo criterio en `parser/sequence.ts`.

Para el participante autodeclarado por `ensureParticipant()`, `range` y
`nameRange` son ambos el rango del token del mensaje que lo creó.

- [ ] **Step 4: Corregir `E017`**

La pasada final deja de reportar sobre `edge.position` y pasa a reportar
sobre `edge.fromRange` o `edge.toRange` según cuál de los dos extremos no
resolvió. El mismo ajuste aplica a `E027` en `parser/sequence.ts` si
reporta sobre la posición del mensaje.

- [ ] **Step 5: Verificar**

Run: `pnpm -r test && pnpm -r typecheck`
Expected: verde. Los snapshots de SVG **no cambian** — el layout no lee
`position`, y si algún test de layout construye diagramas a mano hay que
actualizar los fixtures a la forma nueva.

- [ ] **Step 6: Commit**

`feat(core): rangos de declaracion y de nombre en los nodos del AST`

---

# Fase B — Lexer dirigido por el parser

## Task 4: clase `Lexer` perezosa con modos

**Files:**

- Modify: `packages/core/src/lexer.ts`
- Test: `packages/core/src/lexer.test.ts`

**Interfaces:**

- Produces: `class Lexer` con `next()`, `readTextUntil(closer)`, `peek()`.
  Consumido por la Task 5.
- `tokenize()` **se mantiene intacta y exportada** durante esta task: el
  `Lexer` se construye al lado, con sus propios tests, sin tocar los
  parsers. Así la suite queda verde en cada paso y la Task 5 es un
  reemplazo, no una reescritura simultánea.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
describe('Lexer', () => {
  it("does not enter text mode on '{' by itself", () => {
    const lexer = new Lexer('flow login {');
    expect(lexer.next().kind).toBe('IDENT'); // flow
    expect(lexer.next().kind).toBe('IDENT'); // login
    expect(lexer.next().kind).toBe('LBRACE');
    expect(lexer.next().kind).toBe('EOF'); // el cuerpo NO fue tragado
  });

  it("treats 'as' as an ordinary identifier", () => {
    const lexer = new Lexer('participant user as Usuario');
    expect(lexer.next().value).toBe('participant');
    expect(lexer.next().value).toBe('user');
    expect(lexer.next().value).toBe('as');
    expect(lexer.next().kind).toBe('IDENT'); // Usuario, no TEXT
  });

  it('reads text on demand until the requested closer', () => {
    const lexer = new Lexer('start[  Inicio  ]');
    lexer.next(); // start
    lexer.next(); // [
    const text = lexer.readTextUntil(']');
    expect(text.value).toBe('Inicio');
    expect(lexer.next().kind).toBe('RBRACKET');
  });

  it('reports E001 when the closer is missing before end of line', () => {
    const lexer = new Lexer('start[Inicio\n');
    lexer.next();
    lexer.next();
    lexer.readTextUntil(']');
    expect(lexer.diagnostics[0].code).toBe('E001');
  });

  it('throws if text mode is requested while a token is buffered', () => {
    const lexer = new Lexer('start[Inicio]');
    lexer.next();
    lexer.next();
    lexer.peek(); // buffer ocupado
    expect(() => lexer.readTextUntil(']')).toThrow();
  });
});
```

- [ ] **Step 2: Implementar la clase**

```typescript
export class Lexer {
  readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly source: string) {}

  /** Siguiente token en modo código. Nunca produce TEXT. */
  next(): Token {
    /* ... */
  }

  /** Lookahead de exactamente un token, en modo código. */
  peek(): Token {
    /* ... */
  }

  /**
   * Consume texto crudo hasta `closer` (o hasta fin de línea si es "\n").
   * El closer NO se consume. Emite E001 si falta antes del newline.
   */
  readTextUntil(closer: ']' | ')' | '}' | '\n'): Token {
    /* ... */
  }
}
```

El cuerpo del escáner en modo código es el bucle actual de `tokenize()`
**menos** las tres ramas que arman `pending`: el `:` ya no deja
`{ kind: "colon" }`, los abre-paréntesis ya no dejan `{ kind: "bracket" }`,
y la palabra `as` ya no dispara nada. Todo eso lo pide ahora el parser.

**Invariante crítico:** `readTextUntil()` lanza si hay un token en el
buffer de `peek()`. El motivo es que el buffer se llenó leyendo en modo
código, o sea que el escáner ya cruzó el punto donde empieza el texto y
devolverlo sería incorrecto. El parser debe pedir el texto _inmediatamente_
después de consumir el token de apertura, sin peek intermedio. Que sea un
`throw` y no un diagnóstico es deliberado: es un bug del parser, no un
error del usuario.

- [ ] **Step 3: Verificar**

Run: `pnpm --filter @flo/core test`
Expected: verde. Los tests viejos de `tokenize()` siguen pasando sin
cambios porque `tokenize()` no se tocó.

- [ ] **Step 4: Commit**

`feat(core): lexer perezoso con modos pedidos por el consumidor`

---

## Task 5: migrar los parsers al `Lexer` y eliminar `tokenize()`

**Files:**

- Modify: `packages/core/src/parser/index.ts`, `parser/flowchart.ts`, `parser/sequence.ts`
- Modify: `packages/core/src/lexer.ts` (borrar `tokenize`, `TokenizeResult`, `PendingTextMode`, `BRACKET_CLOSERS`)
- Test: `packages/core/src/lexer.test.ts`, tests de parser

**Interfaces:**

- Consumes: `Lexer` de la Task 4.
- `parseFlowchartBody` / `parseSequenceBody` cambian de firma:
  `(tokens: Token[], diagnostics: Diagnostic[])` → `(lexer: Lexer, diagnostics: Diagnostic[])`.

- [ ] **Step 1: Adaptar los tests de parser existentes**

Los tests de parser van contra `parse(source)`, así que **no deberían
cambiar**. Los que sí cambian son los de `tokenize()` en
`lexer.test.ts`: se reescriben contra `Lexer`. Tres casos actuales
cambian de comportamiento y hay que reescribirlos explícitamente:

- `as` dentro de un `flowchart` ya no traga el resto de la línea; ahora es
  un `IDENT` normal y la línea falla con `E015`/`E016` en vez de con el
  error que daba antes. Fijar el nuevo comportamiento en un test.
- `{` sin cierre ya no produce `E001` por sí solo en contextos donde el
  parser no pide texto.
- Un `:` al final de línea sin texto detrás produce ahora un `TEXT` vacío
  pedido explícitamente por el parser, no uno implícito.

- [ ] **Step 2: Introducir un cursor de un token en los parsers**

Los tres parsers usan hoy `tokens[pos]` con `current()` / `advance()`. El
reemplazo mantiene exactamente esa forma sobre el `Lexer`:

```typescript
let buffered: Token | null = null;

function current(): Token {
  if (buffered === null) buffered = lexer.next();
  return buffered;
}

function advance(): Token {
  const token = current();
  if (token.kind !== 'EOF') buffered = null;
  return token;
}

/** Pide texto al lexer. Requiere que no haya lookahead pendiente. */
function readText(closer: ']' | ')' | '}' | '\n'): Token {
  if (buffered !== null) throw new Error('readText con lookahead pendiente');
  return lexer.readTextUntil(closer);
}
```

`skipNewlines()` y `skipToNextLine()` no cambian de lógica.

- [ ] **Step 3: Pedir el texto donde corresponde**

Tres sitios, uno por cada punto donde hoy el lexer adivinaba:

1. `parser/flowchart.ts`, tras consumir `LBRACKET` / `LPAREN` / `LBRACE`
   en posición de forma: `readText(CLOSE_CHAR[openKind])`.
2. `parser/flowchart.ts` y `parser/sequence.ts`, tras consumir `COLON` en
   una arista/mensaje: `readText("\n")`.
3. `parser/sequence.ts`, tras consumir el `IDENT` `as` en un
   `ParticipantDecl`: `readText("\n")`. Aquí `as` pasa a ser una palabra
   clave **contextual**, reconocida por el parser comparando
   `token.value === "as"` en esa posición y en ninguna otra.

- [ ] **Step 4: Actualizar `parser/index.ts`**

`parse()` construye `const lexer = new Lexer(source)`, valida el header
consumiendo del lexer, y delega pasándole el mismo `lexer`. Desaparece el
`tokens.slice(pos)` que hoy corta el array — el lexer ya está posicionado
donde toca, que es una ventaja directa del modelo perezoso.

Los diagnósticos del lexer ya no se copian al inicio: se acumulan en
`lexer.diagnostics` durante todo el parseo y se concatenan **al final**,
antes de `sortDiagnosticsByPosition()`. El orden final es idéntico porque
ese sort los reordena por posición de todos modos.

- [ ] **Step 5: Borrar el código muerto**

Eliminar de `lexer.ts`: `tokenize()`, `TokenizeResult`, `BracketMode`,
`ColonMode`, `PendingTextMode`, `BRACKET_CLOSERS`. Verificar con
`grep -rn "tokenize" packages/` que no queda ninguna referencia.
`tokenize` nunca estuvo en la API pública (`packages/core/src/index.ts` no
lo exporta), así que no hay ruptura externa.

- [ ] **Step 6: Verificar**

Run: `pnpm -r test && pnpm -r typecheck && pnpm -r build`
Expected: verde. **Los snapshots de SVG de
`render/reference-diagrams.test.ts` deben quedar byte-idénticos** — es la
verificación más fuerte de que la refactorización no cambió el lenguaje. Si
alguno cambia, investigar antes de regenerar.

- [ ] **Step 7: Commit**

`refactor(core): dirigir el modo del lexer desde el parser`

---

## Task 6: token `STRING`

**Files:**

- Modify: `packages/core/src/tokens.ts`, `packages/core/src/lexer.ts`
- Test: `packages/core/src/lexer.test.ts`

**Interfaces:**

- Produces: `TokenKind` incluye `"STRING"`; el lexer reconoce `"..."`.
  Consumido por la Fase C (`use "./catalog.flo"`, títulos de bloque).

Esta task agrega el token pero **ninguna regla gramatical lo usa todavía**:
un `"` en un `.flo` de hoy sigue siendo un error, solo que ahora es `E002`
sobre el string completo en vez de sobre el primer carácter. Se hace acá y
no en la Fase C porque es puramente léxico.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
it('lexes a double-quoted string', () => {
  const lexer = new Lexer('use "./catalog.flo"');
  lexer.next();
  const str = lexer.next();
  expect(str.kind).toBe('STRING');
  expect(str.value).toBe('./catalog.flo'); // sin las comillas
  expect(str.range).toEqual({
    start: { line: 1, column: 5 },
    end: { line: 1, column: 20 } // el range SÍ las incluye
  });
});

it('reports E002 for a string not closed before end of line', () => {
  const lexer = new Lexer('use "./catalog.flo\n');
  lexer.next();
  lexer.next();
  expect(lexer.diagnostics[0].code).toBe('E002');
});
```

- [ ] **Step 2: Implementar**

Agregar `"STRING"` a `TokenKind` y una rama en el escáner de modo código:
al ver `"`, consumir hasta el `"` de cierre o el fin de línea. El `value`
va sin comillas; el `range` las incluye. **Sin secuencias de escape** en
esta ronda: un `"` dentro de un string no se soporta, y no hace falta para
rutas ni títulos. Si más adelante se necesita, se agrega `\"` como cambio
aislado.

- [ ] **Step 3: Verificar y commit**

Run: `pnpm --filter @flo/core test`
`feat(core): token de string entre comillas dobles`

---

## Task 7: documentar y cerrar

**Files:**

- Modify: `packages/core/GRAMMAR.md`

- [ ] **Step 1: Actualizar `GRAMMAR.md`**

La sección de reglas léxicas especiales describe hoy comportamientos que
dejaron de existir. Reescribir:

- Quitar _"`as` es palabra reservada global del lexer"_ → pasa a ser
  contextual, reconocida solo en `ParticipantDecl`.
- Quitar la descripción del modo texto automático tras `[`, `(`, `{`, `:`
  → el texto lo pide el parser en las posiciones que la gramática define.
- Agregar `String ::= '"' (carácter excepto '"' y newline)* '"'` a la
  gramática léxica, notando que ninguna regla la usa todavía.
- Nota de que `{` ya no es ambiguo y queda disponible como delimitador de
  bloque para la Fase C.

La EBNF de flowchart y sequence **no cambia**: ese es el punto de todo el
plan.

- [ ] **Step 2: Verificación final**

Run: `pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: todo verde, snapshots de SVG sin cambios respecto al inicio del
plan.

Comprobación manual de que `{` quedó desbloqueado para la Fase C:

```typescript
const lexer = new Lexer('flow login {\n  a -> b\n}\n');
// debe emitir IDENT IDENT LBRACE NEWLINE IDENT ARROW IDENT NEWLINE RBRACE NEWLINE EOF
```

- [ ] **Step 3: Commit**

`docs(core): actualizar GRAMMAR.md tras el cambio de lexado`

---

## Al terminar

`@flo/core` queda con la misma API pública, el mismo lenguaje y los mismos
diagramas de salida, pero con dos capacidades nuevas que no tenía:

- Todo elemento —token, diagnóstico, nodo, arista— sabe **dónde empieza y
  dónde termina**, y los identificadores tienen su rango propio separado
  del de la declaración.
- El parser controla el lexado, así que `{` puede usarse como delimitador
  de bloque y `as` dejó de ser una palabra reservada global.

Con eso, la Fase C (entidades + bloques nombrados) es implementable sin
pelearse con el lexer, y las Fases E–F (atributos `data-flo-*`, ir a
definición, renombrar cross-document) tienen los rangos que necesitan.
