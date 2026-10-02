# .flo — Lenguaje MVP (Fase 0 + Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-09-17 (`9fcd07e`..`1607ffa`, fixes de la revisión final en `1607ffa`).

**Goal:** Dejar el monorepo `.flo` funcionando (Fase 0) y el lenguaje `.flo`
parseando correctamente flowchart y secuencia — lexer, parser, AST y
diagnostics con recuperación de errores — con tests en verde (Fase 1). Sin
layout, sin render, sin editor todavía: eso es la siguiente ronda.

**Architecture:** Monorepo pnpm con dos paquetes: `@flo/core` (sin
dependencia de ningún framework de UI — lexer, parser, AST, diagnostics) y
`@flo/web` (vanilla TS + Vite, solo consume `@flo/core`, todavía sin UI de
editor real). El lenguaje tiene una gramática única con un header
(`diagram <tipo>`) y un cuerpo específico por tipo (flowchart | sequence),
ambos compartiendo el mismo lexer.

**Tech Stack:** TypeScript 5 (strict), pnpm workspaces, Vitest, Vite,
GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md`

## Global Constraints

- Sin dependencias de runtime en `@flo/core` durante esta ronda (Fase 2
  agrega `dagre` para layout — no antes).
- `@flo/core` no importa nada de `@flo/web` ni de ningún framework de UI —
  debe poder publicarse a npm de forma independiente (spec §3).
- TypeScript en modo `strict` en ambos paquetes.
- Cada diagnóstico es un objeto estructurado `{ code, message, line, column,
  severity }` — nunca un string suelto (spec §5).
- El parser nunca aborta en el primer error: sigue leyendo y junta todos
  los diagnósticos de la pasada (spec §5).
- Sin compatibilidad con sintaxis Mermaid — no se agrega ningún importador
  ni modo alterno (spec §2, §8).
- Sin backend, sin cuentas — todo lo que se construye en esta ronda corre
  en Node (tests/build) o en el navegador sin red (spec §6, §8).

---

## Fase 0 — Setup del monorepo

### Task 1: Workspace root + CI

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: el workspace root que `packages/core` y `packages/web` (Task 2
  y 3) declaran como miembros vía `pnpm-workspace.yaml`, y el
  `tsconfig.base.json` que ambos extienden con `"extends": "../../tsconfig.base.json"`.

- [x] **Step 1: Crear `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [x] **Step 2: Crear `package.json` raíz**

```json
{
  "name": "flo-monorepo",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [x] **Step 3: Crear `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  }
}
```

- [x] **Step 4: Crear `.gitignore`**

```
node_modules/
dist/
*.log
```

- [x] **Step 5: Crear `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
  pull_request:
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
```

- [x] **Step 6: Instalar y verificar**

Run: `pnpm install`
Expected: termina sin error y crea `pnpm-lock.yaml` (todavía no hay
paquetes bajo `packages/`, así que `pnpm -r ...` no tiene nada que
ejecutar hasta el Task 2 — eso es esperado en este paso).

- [x] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .gitignore .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "chore: setup del workspace pnpm y CI"
```

### Task 2: `@flo/core` — package skeleton

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` del Task 1.
- Produces: `VERSION: string` exportado desde `@flo/core`, consumido por
  `@flo/web` en el Task 3.

- [x] **Step 1: Crear `packages/core/package.json`**

```json
{
  "name": "@flo/core",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [x] **Step 2: Crear `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [x] **Step 3: Escribir el test que falla**

```typescript
// packages/core/src/index.test.ts
import { describe, it, expect } from "vitest";
import { VERSION } from "./index";

describe("index", () => {
  it("exports a version string", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
```

- [x] **Step 4: Instalar dependencias y correr el test — debe fallar**

Run: `pnpm install && pnpm --filter @flo/core test`
Expected: FAIL — `./index` no exporta `VERSION` (el archivo no existe
todavía).

- [x] **Step 5: Implementación mínima**

```typescript
// packages/core/src/index.ts
export const VERSION = "0.0.0";
```

- [x] **Step 6: Correr el test — debe pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add packages/core
git commit -m "chore: scaffold de @flo/core"
```

### Task 3: `@flo/web` — package skeleton

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vitest.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/app.ts`
- Create: `packages/web/src/main.ts`
- Test: `packages/web/src/app.test.ts`

**Interfaces:**
- Consumes: `VERSION` de `@flo/core` (Task 2), vía `workspace:*`.
- Produces: `renderApp(root: HTMLElement, version: string): void` — no lo
  consume nadie todavía en esta ronda, pero es el punto donde la Fase 3
  (editor web) engancha el layout real.

- [x] **Step 1: Crear `packages/web/package.json`**

```json
{
  "name": "@flo/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@flo/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

- [x] **Step 2: Crear `packages/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "types": []
  },
  "include": ["src"]
}
```

- [x] **Step 3: Crear `packages/web/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
```

- [x] **Step 4: Crear `packages/web/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>.flo editor</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [x] **Step 5: Escribir el test que falla**

```typescript
// packages/web/src/app.test.ts
import { describe, it, expect } from "vitest";
import { renderApp } from "./app";

describe("renderApp", () => {
  it("writes the core version into the root element", () => {
    const root = document.createElement("div");
    renderApp(root, "0.0.0");
    expect(root.textContent).toBe(".flo editor — core v0.0.0");
  });
});
```

- [x] **Step 6: Instalar y correr el test — debe fallar**

Run: `pnpm install && pnpm --filter @flo/web test`
Expected: FAIL — `./app` no existe todavía.

- [x] **Step 7: Implementación mínima**

```typescript
// packages/web/src/app.ts
export function renderApp(root: HTMLElement, version: string): void {
  root.textContent = `.flo editor — core v${version}`;
}
```

```typescript
// packages/web/src/main.ts
import { VERSION } from "@flo/core";
import { renderApp } from "./app";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  renderApp(root, VERSION);
}
```

- [x] **Step 8: Correr el test — debe pasar**

Run: `pnpm --filter @flo/web test`
Expected: PASS

- [x] **Step 9: Verificar el build de todo el monorepo**

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: los tres comandos terminan en verde para `@flo/core` y `@flo/web`
— esto es el entregable completo de la Fase 0 (spec §9).

- [x] **Step 10: Commit**

```bash
git add packages/web
git commit -m "chore: scaffold de @flo/web, consume @flo/core"
```

## Fase 1 — Lenguaje: lexer + parser + AST + diagnostics

### Task 4: Gramática formal (EBNF)

**Files:**
- Create: `packages/core/GRAMMAR.md`

**Interfaces:**
- Produces: la referencia que las Tasks 5-10 implementan al pie de la
  letra — todo código de lexer/parser debe corresponder exactamente a
  este documento. Ningún token, código de error o regla se agrega en
  código sin actualizar este archivo primero.

- [x] **Step 1: Escribir `packages/core/GRAMMAR.md`**

```markdown
# Gramática `.flo` (MVP: flowchart + sequence)

    Diagram      ::= Header Newline Body EOF
    Header       ::= "diagram" Kind
    Kind         ::= "flowchart" | "sequence"
    Body         ::= (BlankLine | Statement)*
    BlankLine    ::= Newline
    Statement    ::= (FlowchartStatement | SequenceStatement) Newline

    (* --- flowchart --- *)
    FlowchartStatement ::= NodeDecl | EdgeDecl
    NodeDecl     ::= Ident Shape
    Shape        ::= "[" Text "]" | "(" Text ")" | "{" Text "}"
    EdgeDecl     ::= Ident "->" Ident (":" Text)?

    (* --- sequence --- *)
    SequenceStatement  ::= ParticipantDecl | MessageDecl
    ParticipantDecl ::= "participant" Ident ("as" Text)?
    MessageDecl  ::= Ident "->" Ident ":" Text

    Ident        ::= (letra ASCII | "_") (letra ASCII | dígito | "_")*
    Text         ::= cualquier carácter excepto el delimitador de cierre
                      y el salto de línea; se recorta espacio inicial/final
    Comment      ::= "//" cualquier carácter hasta fin de línea
                      (se descarta antes de tokenizar, no genera token)

## Reglas léxicas especiales

- Después de `[`, `(`, `{` o `:`, el lexer entra en modo texto: todo lo
  que sigue hasta el delimitador de cierre (o hasta fin de línea, para
  `:`) es un único token `TEXT`, sin tokenizar palabra por palabra.
- La palabra `as` es una palabra clave contextual: cuando el lexer emite
  un `IDENT` con valor `as`, el resto de la línea también se lee como un
  único token `TEXT` (igual que después de `:`). Es la única forma en que
  un alias de participante puede tener espacios (`as Base de datos`).
- Un id de nodo/participante no puede reusarse con una forma distinta
  (flowchart) ni declararse dos veces (sequence) — es un error, no una
  redefinición silenciosa.
- En `sequence`, un participante usado en un mensaje sin haber sido
  declarado explícitamente con `participant` se autodeclara con su id
  como label. Declarar explícitamente un participante ya autodeclarado
  por un mensaje previo es un caso no soportado en esta ronda (error
  E023) — se documenta como limitación conocida, no un bug.

## Fuera de esta gramática (futuro, no en este plan)

Subgrafos, loops/alt de secuencia, notas, estilos. El principio de
bloques con `{ }` para anidamiento (spec §4) queda reservado para cuando
se agreguen — no se inventa sintaxis de bloques en esta ronda porque el
spec no la especifica con ejemplos concretos.

## Códigos de diagnóstico

| Código | Origen | Significado |
|---|---|---|
| E001 | lexer | falta el delimitador de cierre antes de fin de línea |
| E002 | lexer | carácter inesperado |
| E003 | parser (header) | archivo vacío |
| E004 | parser (header) | falta la palabra `diagram` al inicio |
| E005 | parser (header) | tipo de diagrama desconocido |
| E006 | parser (header) | contenido inesperado después del tipo |
| E010 | parser (flowchart) | se esperaba un identificador |
| E011 | parser (flowchart) | se esperaba el texto del nodo |
| E012 | parser (flowchart) | falta el delimitador de cierre del nodo |
| E013 | parser (flowchart) | nodo redeclarado con otra forma |
| E014 | parser (flowchart) | se esperaba el id del nodo destino |
| E015 | parser (flowchart) | se esperaba una forma de nodo o `->` |
| E016 | parser (flowchart/sequence) | contenido inesperado al final de la línea |
| E020 | parser (sequence) | se esperaba `participant` o un id |
| E021 | parser (sequence) | se esperaba el id del participante |
| E022 | parser (sequence) | se esperaba el texto del alias después de `as` |
| E023 | parser (sequence) | participante redeclarado |
| E024 | parser (sequence) | se esperaba `->` |
| E025 | parser (sequence) | se esperaba el id del participante destino |
| E026 | parser (sequence) | se esperaba `:` seguido del mensaje |
| E027 | parser (sequence) | se esperaba el texto del mensaje |
```

- [x] **Step 2: Commit**

```bash
git add packages/core/GRAMMAR.md
git commit -m "docs: gramatica formal de .flo (flowchart + sequence)"
```

### Task 5: Diagnostics

**Files:**
- Create: `packages/core/src/diagnostics.ts`
- Test: `packages/core/src/diagnostics.test.ts`

**Interfaces:**
- Produces: `Diagnostic` (interface), `DiagnosticSeverity`,
  `formatDiagnostic(diagnostic: Diagnostic): string` — usados por el
  lexer (Task 7) y ambos parsers (Tasks 8-10).

- [x] **Step 1: Escribir el test que falla**

```typescript
// packages/core/src/diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { formatDiagnostic, type Diagnostic } from "./diagnostics";

describe("formatDiagnostic", () => {
  it("formats an error diagnostic with code, position and message", () => {
    const diagnostic: Diagnostic = {
      code: "E001",
      message: "se esperaba ']' antes de fin de línea",
      line: 3,
      column: 12,
      severity: "error",
    };
    expect(formatDiagnostic(diagnostic)).toBe(
      "E001 error [3:12]: se esperaba ']' antes de fin de línea"
    );
  });

  it("formats a warning diagnostic", () => {
    const diagnostic: Diagnostic = {
      code: "W001",
      message: "nodo declarado pero nunca usado en una arista",
      line: 1,
      column: 1,
      severity: "warning",
    };
    expect(formatDiagnostic(diagnostic)).toBe(
      "W001 warning [1:1]: nodo declarado pero nunca usado en una arista"
    );
  });
});
```

- [x] **Step 2: Correr el test — debe fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./diagnostics` no existe.

- [x] **Step 3: Implementación**

```typescript
// packages/core/src/diagnostics.ts
export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  code: string;
  message: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const label = diagnostic.severity === "error" ? "error" : "warning";
  return `${diagnostic.code} ${label} [${diagnostic.line}:${diagnostic.column}]: ${diagnostic.message}`;
}
```

- [x] **Step 4: Correr el test — debe pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/core/src/diagnostics.ts packages/core/src/diagnostics.test.ts
git commit -m "feat(core): modulo de diagnostics"
```

### Task 6: Tokens + AST

**Files:**
- Create: `packages/core/src/tokens.ts`
- Create: `packages/core/src/ast.ts`
- Test: `packages/core/src/ast.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `TokenKind`, `Token` (Task 7 los usa); `Position`, `NodeShape`,
  `FlowchartNode`, `FlowchartEdge`, `FlowchartDiagram`,
  `SequenceParticipant`, `SequenceMessage`, `SequenceDiagram`, `Diagram`,
  `isFlowchartDiagram`, `isSequenceDiagram` (Tasks 8-10 los usan).

- [x] **Step 1: Crear `packages/core/src/tokens.ts`**

```typescript
export type TokenKind =
  | "IDENT"
  | "TEXT"
  | "ARROW"
  | "COLON"
  | "LBRACKET"
  | "RBRACKET"
  | "LPAREN"
  | "RPAREN"
  | "LBRACE"
  | "RBRACE"
  | "NEWLINE"
  | "EOF";

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  column: number;
}
```

- [x] **Step 2: Escribir el test de AST que falla**

```typescript
// packages/core/src/ast.test.ts
import { describe, it, expect } from "vitest";
import { isFlowchartDiagram, isSequenceDiagram, type Diagram } from "./ast";

describe("diagram type guards", () => {
  const flowchart: Diagram = { kind: "flowchart", nodes: [], edges: [] };
  const sequence: Diagram = { kind: "sequence", participants: [], messages: [] };

  it("isFlowchartDiagram narrows flowchart diagrams", () => {
    expect(isFlowchartDiagram(flowchart)).toBe(true);
    expect(isFlowchartDiagram(sequence)).toBe(false);
  });

  it("isSequenceDiagram narrows sequence diagrams", () => {
    expect(isSequenceDiagram(sequence)).toBe(true);
    expect(isSequenceDiagram(flowchart)).toBe(false);
  });
});
```

- [x] **Step 3: Correr el test — debe fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./ast` no existe.

- [x] **Step 4: Crear `packages/core/src/ast.ts`**

```typescript
export interface Position {
  line: number;
  column: number;
}

export type NodeShape = "rectangle" | "rounded" | "decision";

export interface FlowchartNode {
  id: string;
  shape: NodeShape;
  label: string;
  position: Position;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label: string | null;
  position: Position;
}

export interface FlowchartDiagram {
  kind: "flowchart";
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

export interface SequenceParticipant {
  id: string;
  label: string;
  position: Position;
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  position: Position;
}

export interface SequenceDiagram {
  kind: "sequence";
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
}

export type Diagram = FlowchartDiagram | SequenceDiagram;

export function isFlowchartDiagram(diagram: Diagram): diagram is FlowchartDiagram {
  return diagram.kind === "flowchart";
}

export function isSequenceDiagram(diagram: Diagram): diagram is SequenceDiagram {
  return diagram.kind === "sequence";
}
```

- [x] **Step 5: Correr el test — debe pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/core/src/tokens.ts packages/core/src/ast.ts packages/core/src/ast.test.ts
git commit -m "feat(core): tipos de tokens y AST"
```

### Task 7: Lexer

**Files:**
- Create: `packages/core/src/lexer.ts`
- Test: `packages/core/src/lexer.test.ts`

**Interfaces:**
- Consumes: `Token`, `TokenKind` (Task 6), `Diagnostic` (Task 5).
- Produces: `tokenize(source: string): TokenizeResult` donde
  `TokenizeResult = { tokens: Token[]; diagnostics: Diagnostic[] }` — la
  usan los parsers (Tasks 8-10).

- [x] **Step 1: Escribir los tests que fallan**

```typescript
// packages/core/src/lexer.test.ts
import { describe, it, expect } from "vitest";
import { tokenize } from "./lexer";

function kinds(source: string): string[] {
  return tokenize(source).tokens.map((t) => t.kind);
}

describe("tokenize", () => {
  it("tokenizes an identifier and a bracketed node label", () => {
    const { tokens, diagnostics } = tokenize("start[Inicio]\n");
    expect(diagnostics).toEqual([]);
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ["IDENT", "start"],
      ["LBRACKET", "["],
      ["TEXT", "Inicio"],
      ["RBRACKET", "]"],
      ["NEWLINE", "\n"],
      ["EOF", ""],
    ]);
  });

  it("tokenizes rounded and decision shapes", () => {
    expect(kinds("a(Rounded)\n")).toEqual([
      "IDENT", "LPAREN", "TEXT", "RPAREN", "NEWLINE", "EOF",
    ]);
    expect(kinds("b{Decision}\n")).toEqual([
      "IDENT", "LBRACE", "TEXT", "RBRACE", "NEWLINE", "EOF",
    ]);
  });

  it("tokenizes an arrow and a colon-label running to end of line", () => {
    const { tokens } = tokenize("a -> b : hola mundo\n");
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ["IDENT", "a"],
      ["ARROW", "->"],
      ["IDENT", "b"],
      ["COLON", ":"],
      ["TEXT", "hola mundo"],
      ["NEWLINE", "\n"],
      ["EOF", ""],
    ]);
  });

  it("treats 'as' as a contextual keyword that reads the rest of the line as text", () => {
    const { tokens } = tokenize("participant db as Base de datos\n");
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ["IDENT", "participant"],
      ["IDENT", "db"],
      ["IDENT", "as"],
      ["TEXT", "Base de datos"],
      ["NEWLINE", "\n"],
      ["EOF", ""],
    ]);
  });

  it("strips line comments without emitting a token", () => {
    expect(kinds("a[X] // comentario\n")).toEqual([
      "IDENT", "LBRACKET", "TEXT", "RBRACKET", "NEWLINE", "EOF",
    ]);
  });

  it("reports E001 when a bracket is not closed before the newline", () => {
    const { diagnostics } = tokenize("broken[sin cerrar\n");
    expect(diagnostics).toEqual([
      {
        code: "E001",
        message: "se esperaba ']' antes de fin de línea",
        line: 1,
        column: 7,
        severity: "error",
      },
    ]);
  });

  it("reports E002 for an unexpected character and keeps lexing", () => {
    const { tokens, diagnostics } = tokenize("1bad[X]\n");
    expect(diagnostics).toEqual([
      {
        code: "E002",
        message: "carácter inesperado '1'",
        line: 1,
        column: 1,
        severity: "error",
      },
    ]);
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ["IDENT", "bad"],
      ["LBRACKET", "["],
      ["TEXT", "X"],
      ["RBRACKET", "]"],
      ["NEWLINE", "\n"],
      ["EOF", ""],
    ]);
  });
});
```

- [x] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./lexer` no existe.

- [x] **Step 3: Implementación**

```typescript
// packages/core/src/lexer.ts
import type { Token, TokenKind } from "./tokens";
import type { Diagnostic } from "./diagnostics";

interface BracketMode {
  kind: "bracket";
  closer: string;
  openLine: number;
  openColumn: number;
}

interface ColonMode {
  kind: "colon";
}

type PendingTextMode = BracketMode | ColonMode | null;

export interface TokenizeResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const BRACKET_CLOSERS: Record<string, string> = {
  "[": "]",
  "(": ")",
  "{": "}",
};

export function tokenize(source: string): TokenizeResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let i = 0;
  let line = 1;
  let column = 1;
  let pending: PendingTextMode = null;

  function advance(): string {
    const ch = source[i];
    i += 1;
    if (ch === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return ch;
  }

  function push(kind: TokenKind, value: string, startLine: number, startColumn: number): void {
    tokens.push({ kind, value, line: startLine, column: startColumn });
  }

  while (i < source.length) {
    const startLine = line;
    const startColumn = column;
    const ch = source[i];

    if (pending?.kind === "bracket") {
      let text = "";
      while (i < source.length && source[i] !== pending.closer && source[i] !== "\n") {
        text += advance();
      }
      if (i >= source.length || source[i] === "\n") {
        diagnostics.push({
          code: "E001",
          message: `se esperaba '${pending.closer}' antes de fin de línea`,
          line: pending.openLine,
          column: pending.openColumn,
          severity: "error",
        });
        pending = null;
        continue;
      }
      push("TEXT", text.trim(), startLine, startColumn);
      pending = null;
      continue;
    }

    if (pending?.kind === "colon") {
      let text = "";
      while (i < source.length && source[i] !== "\n") {
        text += advance();
      }
      push("TEXT", text.trim(), startLine, startColumn);
      pending = null;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      advance();
      continue;
    }

    if (ch === "\n") {
      advance();
      push("NEWLINE", "\n", startLine, startColumn);
      continue;
    }

    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") {
        advance();
      }
      continue;
    }

    if (ch === "-" && source[i + 1] === ">") {
      advance();
      advance();
      push("ARROW", "->", startLine, startColumn);
      continue;
    }

    if (ch === ":") {
      advance();
      push("COLON", ":", startLine, startColumn);
      pending = { kind: "colon" };
      continue;
    }

    if (ch === "[" || ch === "(" || ch === "{") {
      advance();
      const kind: TokenKind = ch === "[" ? "LBRACKET" : ch === "(" ? "LPAREN" : "LBRACE";
      push(kind, ch, startLine, startColumn);
      pending = { kind: "bracket", closer: BRACKET_CLOSERS[ch], openLine: startLine, openColumn: startColumn };
      continue;
    }

    if (ch === "]" || ch === ")" || ch === "}") {
      advance();
      const kind: TokenKind = ch === "]" ? "RBRACKET" : ch === ")" ? "RPAREN" : "RBRACE";
      push(kind, ch, startLine, startColumn);
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let value = "";
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        value += advance();
      }
      push("IDENT", value, startLine, startColumn);
      if (value === "as") {
        pending = { kind: "colon" };
      }
      continue;
    }

    diagnostics.push({
      code: "E002",
      message: `carácter inesperado '${ch}'`,
      line: startLine,
      column: startColumn,
      severity: "error",
    });
    advance();
  }

  tokens.push({ kind: "EOF", value: "", line, column });
  return { tokens, diagnostics };
}
```

- [x] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS (los 7 `it` de `lexer.test.ts`)

- [x] **Step 5: Commit**

```bash
git add packages/core/src/lexer.ts packages/core/src/lexer.test.ts
git commit -m "feat(core): lexer de .flo con recuperacion de errores"
```

### Task 8: Parser de flowchart

**Files:**
- Create: `packages/core/src/parser/flowchart.ts`
- Test: `packages/core/src/parser/flowchart.test.ts`

**Interfaces:**
- Consumes: `tokenize` (Task 7), `Token` (Task 6), `Diagnostic` (Task 5),
  `FlowchartDiagram`, `FlowchartNode`, `FlowchartEdge`, `NodeShape` (Task 6).
- Produces: `parseFlowchartBody(tokens: Token[], diagnostics: Diagnostic[]): FlowchartDiagram`
  — recibe los tokens del cuerpo (sin el header) y el array de
  diagnostics donde debe empujar los suyos (mutación, mismo array que ya
  trae los diagnostics del lexer). Lo consume Task 10.

- [x] **Step 1: Escribir los tests que fallan**

```typescript
// packages/core/src/parser/flowchart.test.ts
import { describe, it, expect } from "vitest";
import { tokenize } from "../lexer";
import { parseFlowchartBody } from "./flowchart";
import type { Diagnostic } from "../diagnostics";

function parseBody(source: string) {
  const { tokens, diagnostics: lexDiagnostics } = tokenize(source);
  const diagnostics: Diagnostic[] = [...lexDiagnostics];
  const diagram = parseFlowchartBody(tokens, diagnostics);
  return { diagram, diagnostics };
}

describe("parseFlowchartBody", () => {
  it("parses node declarations with all three shapes", () => {
    const { diagram, diagnostics } = parseBody(
      "start[Inicio]\ncheck{Login valido}\ndone(Fin)\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.nodes).toEqual([
      { id: "start", shape: "rectangle", label: "Inicio", position: { line: 1, column: 1 } },
      { id: "check", shape: "decision", label: "Login valido", position: { line: 2, column: 1 } },
      { id: "done", shape: "rounded", label: "Fin", position: { line: 3, column: 1 } },
    ]);
  });

  it("parses edges with and without labels", () => {
    const { diagram, diagnostics } = parseBody(
      "start[Inicio]\ncheck{Login valido}\nstart -> check\ncheck -> start : reintentar\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.edges).toEqual([
      { from: "start", to: "check", label: null, position: { line: 3, column: 1 } },
      { from: "check", to: "start", label: "reintentar", position: { line: 4, column: 1 } },
    ]);
  });

  it("reports E013 when a node id is redeclared with a different shape", () => {
    const { diagnostics } = parseBody("start[Inicio]\nstart(Otra forma)\n");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("E013");
  });

  it("recovers after an unterminated node shape and keeps parsing the next line", () => {
    const { diagram, diagnostics } = parseBody("broken[sin cerrar\nok[Bien]\n");
    expect(diagnostics.some((d) => d.code === "E001")).toBe(true);
    expect(diagram.nodes.map((n) => n.id)).toEqual(["ok"]);
  });

  it("reports E014 when an edge is missing its target id", () => {
    const { diagnostics } = parseBody("start[Inicio]\nstart ->\n");
    expect(diagnostics.some((d) => d.code === "E014")).toBe(true);
  });
});
```

- [x] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./flowchart` no existe.

- [x] **Step 3: Implementación**

```typescript
// packages/core/src/parser/flowchart.ts
import type { Token } from "../tokens";
import type { Diagnostic } from "../diagnostics";
import type { FlowchartDiagram, FlowchartNode, FlowchartEdge, NodeShape } from "../ast";

const SHAPE_BY_OPEN: Record<string, NodeShape> = {
  LBRACKET: "rectangle",
  LPAREN: "rounded",
  LBRACE: "decision",
};

const CLOSE_BY_OPEN: Record<string, string> = {
  LBRACKET: "RBRACKET",
  LPAREN: "RPAREN",
  LBRACE: "RBRACE",
};

const CLOSE_CHAR: Record<string, string> = {
  RBRACKET: "]",
  RPAREN: ")",
  RBRACE: "}",
};

export function parseFlowchartBody(
  tokens: Token[],
  diagnostics: Diagnostic[]
): FlowchartDiagram {
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  let pos = 0;

  function current(): Token {
    return tokens[pos];
  }

  function advance(): Token {
    const token = tokens[pos];
    if (token.kind !== "EOF") pos += 1;
    return token;
  }

  function skipNewlines(): void {
    while (current().kind === "NEWLINE") advance();
  }

  function skipToNextLine(): void {
    while (current().kind !== "NEWLINE" && current().kind !== "EOF") advance();
    if (current().kind === "NEWLINE") advance();
  }

  skipNewlines();
  while (current().kind !== "EOF") {
    const startToken = current();

    if (startToken.kind !== "IDENT") {
      diagnostics.push({
        code: "E010",
        message: `se esperaba un identificador, se encontró '${startToken.value || startToken.kind}'`,
        line: startToken.line,
        column: startToken.column,
        severity: "error",
      });
      skipToNextLine();
      skipNewlines();
      continue;
    }

    const id = advance();
    const next = current();

    if (next.kind === "LBRACKET" || next.kind === "LPAREN" || next.kind === "LBRACE") {
      const openKind = next.kind;
      advance();
      const textToken = current();
      if (textToken.kind !== "TEXT") {
        diagnostics.push({
          code: "E011",
          message: "se esperaba el texto del nodo",
          line: textToken.line,
          column: textToken.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const closeKind = CLOSE_BY_OPEN[openKind];
      if (current().kind !== closeKind) {
        diagnostics.push({
          code: "E012",
          message: `se esperaba '${CLOSE_CHAR[closeKind]}'`,
          line: current().line,
          column: current().column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const existing = nodes.find((node) => node.id === id.value);
      const shape = SHAPE_BY_OPEN[openKind];
      if (existing && existing.shape !== shape) {
        diagnostics.push({
          code: "E013",
          message: `el nodo '${id.value}' ya fue declarado con otra forma`,
          line: id.line,
          column: id.column,
          severity: "error",
        });
      } else if (!existing) {
        nodes.push({ id: id.value, shape, label: textToken.value, position: { line: id.line, column: id.column } });
      }
    } else if (next.kind === "ARROW") {
      advance();
      const toToken = current();
      if (toToken.kind !== "IDENT") {
        diagnostics.push({
          code: "E014",
          message: "se esperaba el id del nodo destino",
          line: toToken.line,
          column: toToken.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      let label: string | null = null;
      if (current().kind === "COLON") {
        advance();
        const labelToken = current();
        if (labelToken.kind === "TEXT") {
          label = labelToken.value;
          advance();
        }
      }
      edges.push({ from: id.value, to: toToken.value, label, position: { line: id.line, column: id.column } });
    } else {
      diagnostics.push({
        code: "E015",
        message: "se esperaba una forma de nodo ('[', '(' o '{') o '->'",
        line: next.line,
        column: next.column,
        severity: "error",
      });
      skipToNextLine();
      skipNewlines();
      continue;
    }

    if (current().kind !== "EOF" && current().kind !== "NEWLINE") {
      diagnostics.push({
        code: "E016",
        message: "contenido inesperado al final de la línea",
        line: current().line,
        column: current().column,
        severity: "error",
      });
      skipToNextLine();
    }
    skipNewlines();
  }

  return { kind: "flowchart", nodes, edges };
}
```

- [x] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/core/src/parser/flowchart.ts packages/core/src/parser/flowchart.test.ts
git commit -m "feat(core): parser de flowchart con recuperacion de errores"
```

### Task 9: Parser de sequence

**Files:**
- Create: `packages/core/src/parser/sequence.ts`
- Test: `packages/core/src/parser/sequence.test.ts`

**Interfaces:**
- Consumes: `tokenize` (Task 7), `Token` (Task 6), `Diagnostic` (Task 5),
  `SequenceDiagram`, `SequenceParticipant`, `SequenceMessage` (Task 6).
- Produces: `parseSequenceBody(tokens: Token[], diagnostics: Diagnostic[]): SequenceDiagram`
  — misma forma de interfaz que `parseFlowchartBody` (Task 8). Lo consume
  Task 10.

- [x] **Step 1: Escribir los tests que fallan**

```typescript
// packages/core/src/parser/sequence.test.ts
import { describe, it, expect } from "vitest";
import { tokenize } from "../lexer";
import { parseSequenceBody } from "./sequence";
import type { Diagnostic } from "../diagnostics";

function parseBody(source: string) {
  const { tokens, diagnostics: lexDiagnostics } = tokenize(source);
  const diagnostics: Diagnostic[] = [...lexDiagnostics];
  const diagram = parseSequenceBody(tokens, diagnostics);
  return { diagram, diagnostics };
}

describe("parseSequenceBody", () => {
  it("parses participants with and without alias", () => {
    const { diagram, diagnostics } = parseBody(
      "participant user as Usuario\nparticipant api\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.participants).toEqual([
      { id: "user", label: "Usuario", position: { line: 1, column: 13 } },
      { id: "api", label: "api", position: { line: 2, column: 13 } },
    ]);
  });

  it("parses messages between declared participants", () => {
    const { diagram, diagnostics } = parseBody(
      "participant user as Usuario\nparticipant api as API\nuser -> api : POST /login\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.messages).toEqual([
      { from: "user", to: "api", label: "POST /login", position: { line: 3, column: 1 } },
    ]);
  });

  it("auto-declares a participant used in a message before any explicit declaration", () => {
    const { diagram, diagnostics } = parseBody("a -> b : hola\n");
    expect(diagnostics).toEqual([]);
    expect(diagram.participants).toEqual([
      { id: "a", label: "a", position: { line: 1, column: 1 } },
      { id: "b", label: "b", position: { line: 1, column: 6 } },
    ]);
  });

  it("reports E023 when a participant id is declared twice", () => {
    const { diagnostics } = parseBody("participant a\nparticipant a\n");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("E023");
  });

  it("reports E027 when a message is missing its text", () => {
    const { diagnostics } = parseBody("participant a\nparticipant b\na -> b :\n");
    expect(diagnostics.some((d) => d.code === "E027")).toBe(true);
  });
});
```

- [x] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./sequence` no existe.

- [x] **Step 3: Implementación**

```typescript
// packages/core/src/parser/sequence.ts
import type { Token } from "../tokens";
import type { Diagnostic } from "../diagnostics";
import type { SequenceDiagram, SequenceParticipant, SequenceMessage } from "../ast";

export function parseSequenceBody(
  tokens: Token[],
  diagnostics: Diagnostic[]
): SequenceDiagram {
  const participants: SequenceParticipant[] = [];
  const messages: SequenceMessage[] = [];
  let pos = 0;

  function current(): Token {
    return tokens[pos];
  }

  function advance(): Token {
    const token = tokens[pos];
    if (token.kind !== "EOF") pos += 1;
    return token;
  }

  function skipNewlines(): void {
    while (current().kind === "NEWLINE") advance();
  }

  function skipToNextLine(): void {
    while (current().kind !== "NEWLINE" && current().kind !== "EOF") advance();
    if (current().kind === "NEWLINE") advance();
  }

  function ensureParticipant(id: string, line: number, column: number): void {
    if (!participants.some((participant) => participant.id === id)) {
      participants.push({ id, label: id, position: { line, column } });
    }
  }

  skipNewlines();
  while (current().kind !== "EOF") {
    const startToken = current();

    if (startToken.kind !== "IDENT") {
      diagnostics.push({
        code: "E020",
        message: `se esperaba 'participant' o el id de un participante, se encontró '${startToken.value || startToken.kind}'`,
        line: startToken.line,
        column: startToken.column,
        severity: "error",
      });
      skipToNextLine();
      skipNewlines();
      continue;
    }

    if (startToken.value === "participant") {
      advance();
      const idToken = current();
      if (idToken.kind !== "IDENT") {
        diagnostics.push({
          code: "E021",
          message: "se esperaba el id del participante",
          line: idToken.line,
          column: idToken.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      let label = idToken.value;
      if (current().kind === "IDENT" && current().value === "as") {
        advance();
        const labelToken = current();
        if (labelToken.kind === "TEXT") {
          label = labelToken.value;
          advance();
        } else {
          diagnostics.push({
            code: "E022",
            message: "se esperaba el texto del alias después de 'as'",
            line: labelToken.line,
            column: labelToken.column,
            severity: "error",
          });
          skipToNextLine();
          skipNewlines();
          continue;
        }
      }
      const existing = participants.find((participant) => participant.id === idToken.value);
      if (existing) {
        diagnostics.push({
          code: "E023",
          message: `el participante '${idToken.value}' ya fue declarado`,
          line: idToken.line,
          column: idToken.column,
          severity: "error",
        });
      } else {
        participants.push({ id: idToken.value, label, position: { line: idToken.line, column: idToken.column } });
      }
    } else {
      const fromToken = startToken;
      advance();
      if (current().kind !== "ARROW") {
        diagnostics.push({
          code: "E024",
          message: "se esperaba '->'",
          line: current().line,
          column: current().column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const toToken = current();
      if (toToken.kind !== "IDENT") {
        diagnostics.push({
          code: "E025",
          message: "se esperaba el id del participante destino",
          line: toToken.line,
          column: toToken.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      if (current().kind !== "COLON") {
        diagnostics.push({
          code: "E026",
          message: "se esperaba ':' seguido del mensaje",
          line: current().line,
          column: current().column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const labelToken = current();
      if (labelToken.kind !== "TEXT") {
        diagnostics.push({
          code: "E027",
          message: "se esperaba el texto del mensaje",
          line: labelToken.line,
          column: labelToken.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      ensureParticipant(fromToken.value, fromToken.line, fromToken.column);
      ensureParticipant(toToken.value, toToken.line, toToken.column);
      messages.push({ from: fromToken.value, to: toToken.value, label: labelToken.value, position: { line: fromToken.line, column: fromToken.column } });
    }

    if (current().kind !== "EOF" && current().kind !== "NEWLINE") {
      diagnostics.push({
        code: "E016",
        message: "contenido inesperado al final de la línea",
        line: current().line,
        column: current().column,
        severity: "error",
      });
      skipToNextLine();
    }
    skipNewlines();
  }

  return { kind: "sequence", participants, messages };
}
```

- [x] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/core/src/parser/sequence.ts packages/core/src/parser/sequence.test.ts
git commit -m "feat(core): parser de sequence con recuperacion de errores"
```

### Task 10: `parse()` — integración end-to-end

**Files:**
- Create: `packages/core/src/parser/index.ts`
- Test: `packages/core/src/parser/index.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `tokenize` (Task 7), `parseFlowchartBody` (Task 8),
  `parseSequenceBody` (Task 9), `Diagram` (Task 6), `Diagnostic` (Task 5).
- Produces: `parse(source: string): ParseResult` donde
  `ParseResult = { diagram: Diagram | null; diagnostics: Diagnostic[] }`
  — es la API pública de `@flo/core` para esta ronda (spec §3: `parse()` +
  `render()`; `render()` llega en la Fase 2).

- [x] **Step 1: Escribir los tests que fallan**

```typescript
// packages/core/src/parser/index.test.ts
import { describe, it, expect } from "vitest";
import { parse } from "./index";

describe("parse", () => {
  it("reports E003 for an empty file", () => {
    const { diagram, diagnostics } = parse("");
    expect(diagram).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("E003");
  });

  it("reports E004 when the file does not start with 'diagram'", () => {
    const { diagram, diagnostics } = parse("start[Inicio]\n");
    expect(diagram).toBeNull();
    expect(diagnostics[0].code).toBe("E004");
  });

  it("reports E005 for an unknown diagram kind", () => {
    const { diagram, diagnostics } = parse("diagram pie\n");
    expect(diagram).toBeNull();
    expect(diagnostics[0].code).toBe("E005");
  });

  it("parses a full valid flowchart end to end", () => {
    const source = [
      "diagram flowchart",
      "",
      "start[Inicio]",
      "check{Login valido}",
      "home[Mostrar home]",
      "",
      "start -> check",
      "check -> home : si",
      "",
    ].join("\n");
    const { diagram, diagnostics } = parse(source);
    expect(diagnostics).toEqual([]);
    expect(diagram).toEqual({
      kind: "flowchart",
      nodes: [
        { id: "start", shape: "rectangle", label: "Inicio", position: { line: 3, column: 1 } },
        { id: "check", shape: "decision", label: "Login valido", position: { line: 4, column: 1 } },
        { id: "home", shape: "rectangle", label: "Mostrar home", position: { line: 5, column: 1 } },
      ],
      edges: [
        { from: "start", to: "check", label: null, position: { line: 7, column: 1 } },
        { from: "check", to: "home", label: "si", position: { line: 8, column: 1 } },
      ],
    });
  });

  it("parses a full valid sequence diagram end to end", () => {
    const source = [
      "diagram sequence",
      "",
      "participant user as Usuario",
      "participant api as API",
      "",
      "user -> api : POST /login",
      "api -> user : 200 OK",
      "",
    ].join("\n");
    const { diagram, diagnostics } = parse(source);
    expect(diagnostics).toEqual([]);
    expect(diagram).toEqual({
      kind: "sequence",
      participants: [
        { id: "user", label: "Usuario", position: { line: 3, column: 13 } },
        { id: "api", label: "API", position: { line: 4, column: 13 } },
      ],
      messages: [
        { from: "user", to: "api", label: "POST /login", position: { line: 6, column: 1 } },
        { from: "api", to: "user", label: "200 OK", position: { line: 7, column: 1 } },
      ],
    });
  });

  it("collects diagnostics from multiple invalid lines instead of stopping at the first", () => {
    const source = [
      "diagram flowchart",
      "",
      "1bad[No puede empezar con numero]",
      "start[Inicio]",
      "start ->",
      "",
    ].join("\n");
    const { diagnostics } = parse(source);
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain("E002");
    expect(codes).toContain("E014");
  });
});
```

- [x] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./index` (dentro de `parser/`) no existe.

- [x] **Step 3: Implementación**

```typescript
// packages/core/src/parser/index.ts
import { tokenize } from "../lexer";
import { parseFlowchartBody } from "./flowchart";
import { parseSequenceBody } from "./sequence";
import type { Diagram } from "../ast";
import type { Diagnostic } from "../diagnostics";

export interface ParseResult {
  diagram: Diagram | null;
  diagnostics: Diagnostic[];
}

export function parse(source: string): ParseResult {
  const { tokens, diagnostics: lexDiagnostics } = tokenize(source);
  const diagnostics: Diagnostic[] = [...lexDiagnostics];

  let pos = 0;
  function current() {
    return tokens[pos];
  }
  function advance() {
    const token = tokens[pos];
    if (token.kind !== "EOF") pos += 1;
    return token;
  }

  if (current().kind === "EOF") {
    diagnostics.push({
      code: "E003",
      message: "el archivo está vacío, se esperaba 'diagram <tipo>'",
      line: 1,
      column: 1,
      severity: "error",
    });
    return { diagram: null, diagnostics };
  }

  const keywordToken = current();
  if (keywordToken.kind !== "IDENT" || keywordToken.value !== "diagram") {
    diagnostics.push({
      code: "E004",
      message: "se esperaba 'diagram' al inicio del archivo",
      line: keywordToken.line,
      column: keywordToken.column,
      severity: "error",
    });
    return { diagram: null, diagnostics };
  }
  advance();

  const kindToken = current();
  if (kindToken.kind !== "IDENT" || (kindToken.value !== "flowchart" && kindToken.value !== "sequence")) {
    diagnostics.push({
      code: "E005",
      message: "se esperaba 'flowchart' o 'sequence' después de 'diagram'",
      line: kindToken.line,
      column: kindToken.column,
      severity: "error",
    });
    return { diagram: null, diagnostics };
  }
  advance();

  if (current().kind !== "NEWLINE" && current().kind !== "EOF") {
    diagnostics.push({
      code: "E006",
      message: "contenido inesperado después del tipo de diagrama",
      line: current().line,
      column: current().column,
      severity: "error",
    });
    return { diagram: null, diagnostics };
  }
  if (current().kind === "NEWLINE") advance();

  const bodyTokens = tokens.slice(pos);
  const diagram =
    kindToken.value === "flowchart"
      ? parseFlowchartBody(bodyTokens, diagnostics)
      : parseSequenceBody(bodyTokens, diagnostics);
  return { diagram, diagnostics };
}
```

- [x] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS

- [x] **Step 5: Exponer `parse` desde el paquete**

```typescript
// packages/core/src/index.ts
export const VERSION = "0.0.0";
export { parse } from "./parser/index";
export type { ParseResult } from "./parser/index";
export type { Diagram, FlowchartDiagram, SequenceDiagram } from "./ast";
export type { Diagnostic } from "./diagnostics";
```

- [x] **Step 6: Correr toda la suite del monorepo**

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: verde en `@flo/core` y `@flo/web` — este es el entregable
completo de la Fase 1 (spec §9): `.flo` parsea flowchart y secuencia con
recuperación de errores, con tests.

- [x] **Step 7: Commit**

```bash
git add packages/core/src/parser/index.ts packages/core/src/parser/index.test.ts packages/core/src/index.ts
git commit -m "feat(core): parse() end-to-end para flowchart y sequence"
```

---

## Auto-revisión (self-review)

- **Cobertura del spec:** arquitectura (§3, Tasks 1-3), sintaxis y
  gramática (§4, Task 4), diagnostics (§5, Task 5), tests (§7, todos los
  tasks incluyen su suite) — cubiertos. Render (§6 parcial), editor web
  (§6), persistencia (§6) y publicación (§9 Fases 2-5) quedan
  explícitamente fuera de esta ronda, tal como se pidió.
- **Placeholders:** ninguno — cada paso trae código completo, sin TODO
  ni "similar a la Task N".
- **Consistencia de tipos:** `Token`/`TokenKind` (Task 6) se usan
  idénticos en Tasks 7-10; `Diagnostic` (Task 5) tiene la misma forma en
  los 10 tasks; `parseFlowchartBody`/`parseSequenceBody` comparten la
  firma `(tokens, diagnostics) => Diagram` para que Task 10 los use de
  forma intercambiable.

