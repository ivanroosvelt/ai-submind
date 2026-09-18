# .flo — Layout + Render a SVG (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar `@flo/core` con `parse()` + `render()` end-to-end: layout
determinista (`dagre` para flowchart, columnas propias para sequence) y
render a SVG para ambos tipos de diagrama, con tests — incluyendo
snapshots visuales sobre un set de diagramas de referencia — en verde.
Sin editor web, sin persistencia, sin exportación: eso es la Fase 3 en
adelante.

**Architecture:** Dos módulos nuevos dentro de `@flo/core`, sin tocar
`@flo/web`: `layout/` (a partir del `Diagram` de la Fase 1, calcula
posiciones y tamaños — `dagre` para flowchart, aritmética simple de
columnas para sequence, sin librería externa) y `render/` (`Diagram` +
layout → string SVG, con un builder mínimo de XML propio, sin librería de
templating). `render/index.ts` compone `parse()` (Fase 1) + el layout y
render que corresponda según `diagram.kind`, y se expone junto a `parse()`
desde `packages/core/src/index.ts` como la API pública de `@flo/core`
(spec §3).

**Tech Stack:** TypeScript 5 (strict), `dagre` 0.8.5 + `@types/dagre`
(única dependencia de runtime nueva, solo en `@flo/core`), Vitest
(incluye snapshot testing vía `toMatchSnapshot()`).

**Spec:** `docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md`
(§3 arquitectura, §6 render/preview, §7 testing, §9 Fase 2)

## Global Constraints

- `@flo/core` agrega `dagre` como única dependencia de runtime nueva en
  esta ronda — es la excepción explícita que abre la Fase 2 (spec §9);
  ninguna otra dependencia de runtime se agrega.
- `@flo/core` sigue sin importar nada de `@flo/web` ni de ningún
  framework de UI (spec §3) — esta ronda no toca `packages/web/`.
- TypeScript en modo `strict` (ya configurado en `tsconfig.base.json`,
  sin cambios).
- `tsconfig.base.json` usa `"module": "NodeNext"` /
  `"moduleResolution": "NodeNext"` — todo import relativo dentro de
  `packages/core/src/` lleva sufijo `.js` explícito (p.ej.
  `from "../ast.js"`), igual que el código ya existente. No es opcional:
  sin el sufijo, `tsc`/Node fallan al resolver el módulo.
- El AST de la Fase 1 (`packages/core/src/ast.ts`) no se modifica en esta
  ronda — layout y render se construyen exclusivamente a partir de lo que
  ya expone (`FlowchartDiagram`, `SequenceDiagram`, etc.).
- Cada `.flo` de referencia usado en tests debe ser sintaxis válida según
  `packages/core/GRAMMAR.md` (Fase 1) — si un fixture no parsea sin
  diagnostics, es un error del fixture, no algo a "arreglar" relajando el
  parser.
- Sin editor web, sin persistencia (File System Access API/IndexedDB),
  sin exportación PNG — fuera de alcance de esta ronda (spec §9, Fases
  3-4).
- Commits pequeños, uno por task, mismo estilo de mensajes que el
  historial existente (`git log --oneline`): `feat(core): ...`.

---

## Task 1: `@flo/core` — instalar `dagre` + layout de flowchart

**Files:**
- Modify: `packages/core/package.json`
- Create: `packages/core/src/layout/flowchart.ts`
- Test: `packages/core/src/layout/flowchart.test.ts`

**Interfaces:**
- Consumes: `FlowchartDiagram`, `NodeShape` de `packages/core/src/ast.ts`.
- Produces: `LayoutPoint`, `FlowchartNodeLayout`, `FlowchartEdgeLayout`,
  `FlowchartLayout`, `measureFlowchartNode(shape, label)`,
  `layoutFlowchart(diagram: FlowchartDiagram): FlowchartLayout` —
  consumidos por Task 4 (`render/flowchart.ts`).

- [ ] **Step 1: Agregar `dagre` a `packages/core/package.json`**

Editar `packages/core/package.json` para que quede así:

```json
{
  "name": "@flo/core",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "dagre": "^0.8.5"
  },
  "devDependencies": {
    "@types/dagre": "^0.7.52",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Instalar**

Run: `pnpm install`
Expected: termina sin error, `pnpm-lock.yaml` queda actualizado con
`dagre` y `@types/dagre`.

- [ ] **Step 3: Escribir los tests que fallan**

```typescript
// packages/core/src/layout/flowchart.test.ts
import { describe, it, expect } from "vitest";
import { layoutFlowchart, measureFlowchartNode } from "./flowchart.js";
import type { FlowchartDiagram } from "../ast.js";

describe("measureFlowchartNode", () => {
  it("sizes a rectangle from its label length", () => {
    expect(measureFlowchartNode("rectangle", "Inicio")).toEqual({ width: 88, height: 50 });
  });

  it("sizes a decision (diamond) wider than a rectangle with the same label", () => {
    expect(measureFlowchartNode("decision", "Login valido")).toEqual({ width: 232, height: 80 });
  });

  it("sizes a rounded node with a short label at the minimum width", () => {
    expect(measureFlowchartNode("rounded", "Fin")).toEqual({ width: 80, height: 50 });
  });
});

describe("layoutFlowchart", () => {
  it("lays out a linear chain top-to-bottom with dagre, sizing each shape correctly", () => {
    const diagram: FlowchartDiagram = {
      kind: "flowchart",
      nodes: [
        { id: "start", shape: "rectangle", label: "Inicio", position: { line: 1, column: 1 } },
        { id: "check", shape: "decision", label: "Login valido", position: { line: 2, column: 1 } },
        { id: "end", shape: "rounded", label: "Fin", position: { line: 3, column: 1 } },
      ],
      edges: [
        { from: "start", to: "check", label: null, position: { line: 4, column: 1 } },
        { from: "check", to: "end", label: null, position: { line: 5, column: 1 } },
      ],
    };

    const layout = layoutFlowchart(diagram);

    expect(layout).toEqual({
      width: 272,
      height: 340,
      nodes: [
        { id: "start", x: 136, y: 45, width: 88, height: 50 },
        { id: "check", x: 136, y: 170, width: 232, height: 80 },
        { id: "end", x: 136, y: 295, width: 80, height: 50 },
      ],
      edges: [
        {
          from: "start",
          to: "check",
          points: [
            { x: 136, y: 70 },
            { x: 136, y: 100 },
            { x: 136, y: 130 },
          ],
        },
        {
          from: "check",
          to: "end",
          points: [
            { x: 136, y: 210 },
            { x: 136, y: 240 },
            { x: 136, y: 270 },
          ],
        },
      ],
    });
  });

  it("lays out a single node with no edges", () => {
    const diagram: FlowchartDiagram = {
      kind: "flowchart",
      nodes: [{ id: "solo", shape: "rectangle", label: "Solo", position: { line: 1, column: 1 } }],
      edges: [],
    };

    const layout = layoutFlowchart(diagram);

    expect(layout).toEqual({
      width: 120,
      height: 90,
      nodes: [{ id: "solo", x: 60, y: 45, width: 80, height: 50 }],
      edges: [],
    });
  });
});
```

- [ ] **Step 4: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./flowchart.js` (dentro de `layout/`) no existe.

- [ ] **Step 5: Implementación**

```typescript
// packages/core/src/layout/flowchart.ts
import dagre from "dagre";
import type { FlowchartDiagram, NodeShape } from "../ast.js";

const GRAPH_OPTIONS = { rankdir: "TB", nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 };
const CHAR_WIDTH = 8;

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface FlowchartNodeLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowchartEdgeLayout {
  from: string;
  to: string;
  points: LayoutPoint[];
}

export interface FlowchartLayout {
  width: number;
  height: number;
  nodes: FlowchartNodeLayout[];
  edges: FlowchartEdgeLayout[];
}

export function measureFlowchartNode(shape: NodeShape, label: string): { width: number; height: number } {
  const textWidth = label.length * CHAR_WIDTH;
  if (shape === "decision") {
    return { width: Math.max(textWidth * 2 + 40, 120), height: 80 };
  }
  return { width: Math.max(textWidth + 40, 80), height: 50 };
}

export function layoutFlowchart(diagram: FlowchartDiagram): FlowchartLayout {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ ...GRAPH_OPTIONS });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of diagram.nodes) {
    graph.setNode(node.id, measureFlowchartNode(node.shape, node.label));
  }
  for (const edge of diagram.edges) {
    graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);

  const graphSize = graph.graph();
  const nodes: FlowchartNodeLayout[] = diagram.nodes.map((node) => {
    const laidOut = graph.node(node.id);
    return { id: node.id, x: laidOut.x, y: laidOut.y, width: laidOut.width, height: laidOut.height };
  });
  const edges: FlowchartEdgeLayout[] = diagram.edges.map((edge) => {
    const laidOut = graph.edge(edge.from, edge.to);
    return { from: edge.from, to: edge.to, points: laidOut.points };
  });

  return { width: graphSize.width ?? 0, height: graphSize.height ?? 0, nodes, edges };
}
```

- [ ] **Step 6: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS (5 `it`)

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @flo/core typecheck`
Expected: sin errores — confirma que los tipos de `@types/dagre`
(`graph.node()`, `graph.edge()`, `graph.graph()`) encajan con el uso de
arriba bajo `strict` + `NodeNext`.

- [ ] **Step 8: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/src/layout/flowchart.ts packages/core/src/layout/flowchart.test.ts
git commit -m "feat(core): layout de flowchart con dagre"
```

## Task 2: Layout de sequence (columnas, sin librería externa)

**Files:**
- Create: `packages/core/src/layout/sequence.ts`
- Test: `packages/core/src/layout/sequence.test.ts`

**Interfaces:**
- Consumes: `SequenceDiagram` de `packages/core/src/ast.ts`.
- Produces: `SequenceParticipantLayout`, `SequenceMessageLayout`,
  `SequenceLayout`, `COLUMN_WIDTH`, `HEADER_HEIGHT` (constantes, también
  usadas por Task 5), `layoutSequence(diagram: SequenceDiagram): SequenceLayout`
  — consumidos por Task 5 (`render/sequence.ts`).

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
// packages/core/src/layout/sequence.test.ts
import { describe, it, expect } from "vitest";
import { layoutSequence } from "./sequence.js";
import type { SequenceDiagram } from "../ast.js";

describe("layoutSequence", () => {
  it("places participants in columns and a message on the first row", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [
        { id: "a", label: "Alice", position: { line: 1, column: 1 } },
        { id: "b", label: "Bob", position: { line: 2, column: 1 } },
      ],
      messages: [{ from: "a", to: "b", label: "hola", position: { line: 3, column: 1 } }],
    };

    expect(layoutSequence(diagram)).toEqual({
      width: 320,
      height: 190,
      lifelineTop: 50,
      lifelineBottom: 170,
      participants: [
        { id: "a", label: "Alice", x: 80 },
        { id: "b", label: "Bob", x: 240 },
      ],
      messages: [{ from: "a", to: "b", label: "hola", y: 120 }],
    });
  });

  it("increments the row for each successive message, in declaration order", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [
        { id: "a", label: "a", position: { line: 1, column: 1 } },
        { id: "b", label: "b", position: { line: 1, column: 6 } },
      ],
      messages: [
        { from: "a", to: "b", label: "hola", position: { line: 1, column: 1 } },
        { from: "b", to: "a", label: "chau", position: { line: 2, column: 1 } },
      ],
    };

    const layout = layoutSequence(diagram);

    expect(layout.messages.map((message) => message.y)).toEqual([120, 170]);
    expect(layout.lifelineBottom).toBe(220);
    expect(layout.height).toBe(240);
  });

  it("lays out a diagram with no messages, keeping just the header row", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [{ id: "a", label: "a", position: { line: 1, column: 1 } }],
      messages: [],
    };

    expect(layoutSequence(diagram)).toEqual({
      width: 160,
      height: 140,
      lifelineTop: 50,
      lifelineBottom: 120,
      participants: [{ id: "a", label: "a", x: 80 }],
      messages: [],
    });
  });
});
```

- [ ] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./sequence.js` (dentro de `layout/`) no existe.

- [ ] **Step 3: Implementación**

```typescript
// packages/core/src/layout/sequence.ts
import type { SequenceDiagram } from "../ast.js";

export const COLUMN_WIDTH = 160;
export const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 50;
const TOP_MARGIN = 20;
const BOTTOM_MARGIN = 20;

export interface SequenceParticipantLayout {
  id: string;
  label: string;
  x: number;
}

export interface SequenceMessageLayout {
  from: string;
  to: string;
  label: string;
  y: number;
}

export interface SequenceLayout {
  width: number;
  height: number;
  lifelineTop: number;
  lifelineBottom: number;
  participants: SequenceParticipantLayout[];
  messages: SequenceMessageLayout[];
}

export function layoutSequence(diagram: SequenceDiagram): SequenceLayout {
  const participants: SequenceParticipantLayout[] = diagram.participants.map((participant, index) => ({
    id: participant.id,
    label: participant.label,
    x: COLUMN_WIDTH / 2 + index * COLUMN_WIDTH,
  }));

  const messages: SequenceMessageLayout[] = diagram.messages.map((message, index) => ({
    from: message.from,
    to: message.to,
    label: message.label,
    y: HEADER_HEIGHT + TOP_MARGIN + (index + 1) * ROW_HEIGHT,
  }));

  const lifelineTop = HEADER_HEIGHT;
  const lifelineBottom = HEADER_HEIGHT + TOP_MARGIN + (messages.length + 1) * ROW_HEIGHT;

  return {
    width: participants.length * COLUMN_WIDTH,
    height: lifelineBottom + BOTTOM_MARGIN,
    lifelineTop,
    lifelineBottom,
    participants,
    messages,
  };
}
```

- [ ] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS (3 `it`)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/layout/sequence.ts packages/core/src/layout/sequence.test.ts
git commit -m "feat(core): layout de columnas para sequence"
```

## Task 3: SVG builder — utilidades compartidas

**Files:**
- Create: `packages/core/src/render/svg.ts`
- Test: `packages/core/src/render/svg.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `escapeXml(value: string): string`, `ARROW_MARKER_ID`
  (constante), `arrowMarkerDefs(): string`,
  `svgText(x: number, y: number, text: string): string` — consumidos por
  Task 4 (`render/flowchart.ts`) y Task 5 (`render/sequence.ts`).

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
// packages/core/src/render/svg.test.ts
import { describe, it, expect } from "vitest";
import { escapeXml, arrowMarkerDefs, svgText, ARROW_MARKER_ID } from "./svg.js";

describe("escapeXml", () => {
  it("escapes all five XML special characters", () => {
    expect(escapeXml(`it's <a> & "b"`)).toBe("it&apos;s &lt;a&gt; &amp; &quot;b&quot;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeXml("Mostrar home")).toBe("Mostrar home");
  });
});

describe("arrowMarkerDefs", () => {
  it("defines a marker with the id referenced by ARROW_MARKER_ID", () => {
    const defs = arrowMarkerDefs();
    expect(ARROW_MARKER_ID).toBe("flo-arrow");
    expect(defs).toBe(
      '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>'
    );
  });
});

describe("svgText", () => {
  it("renders a centered text element at the given position", () => {
    expect(svgText(64, 45, "Inicio")).toBe(
      '<text x="64" y="45" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Inicio</text>'
    );
  });

  it("escapes the label content", () => {
    expect(svgText(10, 20, "A & B")).toBe(
      '<text x="10" y="20" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">A &amp; B</text>'
    );
  });
});
```

- [ ] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./svg.js` (dentro de `render/`) no existe.

- [ ] **Step 3: Implementación**

```typescript
// packages/core/src/render/svg.ts
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const ARROW_MARKER_ID = "flo-arrow";

export function arrowMarkerDefs(): string {
  return `<defs><marker id="${ARROW_MARKER_ID}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>`;
}

export function svgText(x: number, y: number, text: string): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">${escapeXml(text)}</text>`;
}
```

- [ ] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS (4 `it`)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/render/svg.ts packages/core/src/render/svg.test.ts
git commit -m "feat(core): utilidades de SVG (escape, marcador de flecha, texto)"
```

## Task 4: Render de flowchart a SVG

**Files:**
- Create: `packages/core/src/render/flowchart.ts`
- Test: `packages/core/src/render/flowchart.test.ts`

**Interfaces:**
- Consumes: `FlowchartDiagram`, `FlowchartNode` (`../ast.js`);
  `FlowchartLayout`, `FlowchartNodeLayout` (`../layout/flowchart.js`,
  Task 1); `ARROW_MARKER_ID`, `arrowMarkerDefs`, `svgText`
  (`./svg.js`, Task 3).
- Produces: `renderFlowchartToSvg(diagram: FlowchartDiagram, layout: FlowchartLayout): string`
  — consumido por Task 6 (`render/index.ts`).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// packages/core/src/render/flowchart.test.ts
import { describe, it, expect } from "vitest";
import { renderFlowchartToSvg } from "./flowchart.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import type { FlowchartDiagram } from "../ast.js";

describe("renderFlowchartToSvg", () => {
  it("renders a rectangle, a rounded node and a labeled edge between them", () => {
    const diagram: FlowchartDiagram = {
      kind: "flowchart",
      nodes: [
        { id: "start", shape: "rectangle", label: "Inicio", position: { line: 1, column: 1 } },
        { id: "end", shape: "rounded", label: "Fin", position: { line: 2, column: 1 } },
      ],
      edges: [{ from: "start", to: "end", label: "ok", position: { line: 3, column: 1 } }],
    };
    const layout = layoutFlowchart(diagram);

    const svg = renderFlowchartToSvg(diagram, layout);

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="200" viewBox="0 0 128 200">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g><rect x="20" y="20" width="88" height="50" rx="0" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="64" y="45" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Inicio</text></g>' +
        '<g><rect x="24" y="130" width="80" height="50" rx="12" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="64" y="155" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Fin</text></g>' +
        '<polyline points="64,70 64,100 64,130" fill="none" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" /><text x="64" y="92" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">ok</text>' +
        "</svg>"
    );
  });

  it("renders a decision node as a polygon and omits the label element for an unlabeled edge", () => {
    const diagram: FlowchartDiagram = {
      kind: "flowchart",
      nodes: [{ id: "check", shape: "decision", label: "OK?", position: { line: 1, column: 1 } }],
      edges: [],
    };
    const layout = layoutFlowchart(diagram);

    const svg = renderFlowchartToSvg(diagram, layout);

    expect(svg).toContain("<polygon points=");
    expect(svg).not.toContain("<rect");
  });
});
```

- [ ] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./flowchart.js` (dentro de `render/`) no existe.

- [ ] **Step 3: Implementación**

```typescript
// packages/core/src/render/flowchart.ts
import type { FlowchartDiagram, FlowchartNode } from "../ast.js";
import type { FlowchartLayout, FlowchartNodeLayout } from "../layout/flowchart.js";
import { ARROW_MARKER_ID, arrowMarkerDefs, svgText } from "./svg.js";

function shapeElement(node: FlowchartNode, nodeLayout: FlowchartNodeLayout): string {
  const { x, y, width, height } = nodeLayout;
  const left = x - width / 2;
  const top = y - height / 2;

  if (node.shape === "decision") {
    const points = [
      `${x},${top}`,
      `${x + width / 2},${y}`,
      `${x},${top + height}`,
      `${x - width / 2},${y}`,
    ].join(" ");
    return `<polygon points="${points}" fill="#eff6ff" stroke="#1f2937" stroke-width="2" />`;
  }

  const rx = node.shape === "rounded" ? 12 : 0;
  return `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${rx}" fill="#eff6ff" stroke="#1f2937" stroke-width="2" />`;
}

export function renderFlowchartToSvg(diagram: FlowchartDiagram, layout: FlowchartLayout): string {
  const nodeLayoutById = new Map(layout.nodes.map((node) => [node.id, node]));

  const nodeElements = diagram.nodes.map((node) => {
    const nodeLayout = nodeLayoutById.get(node.id);
    if (!nodeLayout) {
      throw new Error(`falta el layout del nodo '${node.id}'`);
    }
    return `<g>${shapeElement(node, nodeLayout)}${svgText(nodeLayout.x, nodeLayout.y, node.label)}</g>`;
  });

  const edgeElements = layout.edges.map((edgeLayout) => {
    const edge = diagram.edges.find(
      (candidate) => candidate.from === edgeLayout.from && candidate.to === edgeLayout.to
    );
    if (!edge) {
      throw new Error(`falta la arista '${edgeLayout.from}->${edgeLayout.to}' en el diagrama`);
    }
    const points = edgeLayout.points.map((point) => `${point.x},${point.y}`).join(" ");
    const line = `<polyline points="${points}" fill="none" stroke="#1f2937" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})" />`;
    if (!edge.label) {
      return line;
    }
    const mid = edgeLayout.points[Math.floor(edgeLayout.points.length / 2)];
    return `${line}${svgText(mid.x, mid.y - 8, edge.label)}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${arrowMarkerDefs()}${nodeElements.join("")}${edgeElements.join("")}</svg>`;
}
```

- [ ] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS (2 `it`)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/render/flowchart.ts packages/core/src/render/flowchart.test.ts
git commit -m "feat(core): render de flowchart a SVG"
```

## Task 5: Render de sequence a SVG

**Files:**
- Create: `packages/core/src/render/sequence.ts`
- Test: `packages/core/src/render/sequence.test.ts`

**Interfaces:**
- Consumes: `SequenceDiagram` (`../ast.js`); `SequenceLayout`,
  `COLUMN_WIDTH`, `HEADER_HEIGHT` (`../layout/sequence.js`, Task 2);
  `ARROW_MARKER_ID`, `arrowMarkerDefs`, `svgText` (`./svg.js`, Task 3).
- Produces: `renderSequenceToSvg(diagram: SequenceDiagram, layout: SequenceLayout): string`
  — consumido por Task 6 (`render/index.ts`).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// packages/core/src/render/sequence.test.ts
import { describe, it, expect } from "vitest";
import { renderSequenceToSvg } from "./sequence.js";
import { layoutSequence } from "../layout/sequence.js";
import type { SequenceDiagram } from "../ast.js";

describe("renderSequenceToSvg", () => {
  it("renders participant boxes, lifelines and one message with its label", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [
        { id: "a", label: "Alice", position: { line: 1, column: 1 } },
        { id: "b", label: "Bob", position: { line: 2, column: 1 } },
      ],
      messages: [{ from: "a", to: "b", label: "hola", position: { line: 3, column: 1 } }],
    };
    const layout = layoutSequence(diagram);

    const svg = renderSequenceToSvg(diagram, layout);

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g><rect x="10" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="80" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Alice</text><line x1="80" y1="50" x2="80" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<g><rect x="170" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="240" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Bob</text><line x1="240" y1="50" x2="240" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<line x1="80" y1="120" x2="240" y2="120" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" /><text x="160" y="112" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">hola</text>' +
        "</svg>"
    );
  });

  it("renders a diagram with no messages, keeping just the participant boxes and lifelines", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [{ id: "a", label: "a", position: { line: 1, column: 1 } }],
      messages: [],
    };
    const layout = layoutSequence(diagram);

    const svg = renderSequenceToSvg(diagram, layout);

    expect(svg).toContain('<line x1="80" y1="50" x2="80" y2="120"');
    expect(svg).not.toContain("marker-end");
  });
});
```

- [ ] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./sequence.js` (dentro de `render/`) no existe.

- [ ] **Step 3: Implementación**

```typescript
// packages/core/src/render/sequence.ts
import type { SequenceDiagram } from "../ast.js";
import type { SequenceLayout } from "../layout/sequence.js";
import { COLUMN_WIDTH, HEADER_HEIGHT } from "../layout/sequence.js";
import { ARROW_MARKER_ID, arrowMarkerDefs, svgText } from "./svg.js";

export function renderSequenceToSvg(diagram: SequenceDiagram, layout: SequenceLayout): string {
  const xById = new Map(layout.participants.map((participant) => [participant.id, participant.x]));

  const participantElements = layout.participants.map((participant) => {
    const left = participant.x - COLUMN_WIDTH / 2 + 10;
    const boxWidth = COLUMN_WIDTH - 20;
    const box = `<rect x="${left}" y="0" width="${boxWidth}" height="${HEADER_HEIGHT}" fill="#eff6ff" stroke="#1f2937" stroke-width="2" />`;
    const label = svgText(participant.x, HEADER_HEIGHT / 2, participant.label);
    const lifeline = `<line x1="${participant.x}" y1="${layout.lifelineTop}" x2="${participant.x}" y2="${layout.lifelineBottom}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" />`;
    return `<g>${box}${label}${lifeline}</g>`;
  });

  const messageElements = layout.messages.map((message) => {
    const x1 = xById.get(message.from);
    const x2 = xById.get(message.to);
    if (x1 === undefined || x2 === undefined) {
      throw new Error(`falta la posición de un participante en el mensaje '${message.from}->${message.to}'`);
    }
    const line = `<line x1="${x1}" y1="${message.y}" x2="${x2}" y2="${message.y}" stroke="#1f2937" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})" />`;
    const midX = (x1 + x2) / 2;
    return `${line}${svgText(midX, message.y - 8, message.label)}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${arrowMarkerDefs()}${participantElements.join("")}${messageElements.join("")}</svg>`;
}
```

- [ ] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS (2 `it`)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/render/sequence.ts packages/core/src/render/sequence.test.ts
git commit -m "feat(core): render de sequence a SVG"
```

## Task 6: `render(source)` — integración end-to-end

**Files:**
- Create: `packages/core/src/render/index.ts`
- Test: `packages/core/src/render/index.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `parse` (`../parser/index.js`, Fase 1); `layoutFlowchart`
  (`../layout/flowchart.js`, Task 1); `layoutSequence`
  (`../layout/sequence.js`, Task 2); `renderFlowchartToSvg`
  (`./flowchart.js`, Task 4); `renderSequenceToSvg` (`./sequence.js`,
  Task 5); `Diagnostic` (`../diagnostics.js`, Fase 1).
- Produces: `render(source: string): RenderResult` donde
  `RenderResult = { svg: string | null; diagnostics: Diagnostic[] }` — es
  la segunda mitad de la API pública de `@flo/core` para esta ronda
  (spec §3: `parse()` + `render()`). Consumido por Task 7.

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
// packages/core/src/render/index.test.ts
import { describe, it, expect } from "vitest";
import { render } from "./index.js";

describe("render", () => {
  it("returns svg: null and the parse diagnostics for an empty file", () => {
    const { svg, diagnostics } = render("");
    expect(svg).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("E003");
  });

  it("renders a full flowchart end to end, with no diagnostics", () => {
    const source = [
      "diagram flowchart",
      "",
      "start[Inicio]",
      "end(Fin)",
      "",
      "start -> end : ok",
      "",
    ].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<svg");
    expect(svg).toContain(">Inicio<");
    expect(svg).toContain(">Fin<");
    expect(svg).toContain(">ok<");
  });

  it("renders a full sequence diagram end to end, with no diagnostics", () => {
    const source = [
      "diagram sequence",
      "",
      "participant user as Usuario",
      "participant api as API",
      "",
      "user -> api : POST /login",
      "",
    ].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<svg");
    expect(svg).toContain(">Usuario<");
    expect(svg).toContain(">API<");
    expect(svg).toContain(">POST /login<");
  });

  it("still renders the partial diagram when the body has a recoverable error", () => {
    const source = ["diagram flowchart", "", "start[Inicio]", "start ->", ""].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics.some((diagnostic) => diagnostic.code === "E014")).toBe(true);
    expect(svg).not.toBeNull();
    expect(svg).toContain(">Inicio<");
  });
});
```

- [ ] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/core test`
Expected: FAIL — `./index.js` (dentro de `render/`) no existe.

- [ ] **Step 3: Implementación**

```typescript
// packages/core/src/render/index.ts
import { parse } from "../parser/index.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import { layoutSequence } from "../layout/sequence.js";
import { renderFlowchartToSvg } from "./flowchart.js";
import { renderSequenceToSvg } from "./sequence.js";
import type { Diagnostic } from "../diagnostics.js";

export interface RenderResult {
  svg: string | null;
  diagnostics: Diagnostic[];
}

export function render(source: string): RenderResult {
  const { diagram, diagnostics } = parse(source);

  if (diagram === null) {
    return { svg: null, diagnostics };
  }

  switch (diagram.kind) {
    case "flowchart": {
      const layout = layoutFlowchart(diagram);
      return { svg: renderFlowchartToSvg(diagram, layout), diagnostics };
    }
    case "sequence": {
      const layout = layoutSequence(diagram);
      return { svg: renderSequenceToSvg(diagram, layout), diagnostics };
    }
  }
}
```

- [ ] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/core test`
Expected: PASS (4 `it`)

- [ ] **Step 5: Exponer `render` desde el paquete**

```typescript
// packages/core/src/index.ts
export const VERSION = "0.0.0";
export { parse } from "./parser/index.js";
export type { ParseResult } from "./parser/index.js";
export { render } from "./render/index.js";
export type { RenderResult } from "./render/index.js";
export {
  isFlowchartDiagram,
  isSequenceDiagram,
} from "./ast.js";
export type {
  Diagram,
  FlowchartDiagram,
  SequenceDiagram,
  NodeShape,
  Position,
  FlowchartNode,
  FlowchartEdge,
  SequenceParticipant,
  SequenceMessage,
} from "./ast.js";
export { formatDiagnostic } from "./diagnostics.js";
export type { Diagnostic, DiagnosticSeverity } from "./diagnostics.js";
```

- [ ] **Step 6: Correr toda la suite del monorepo**

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: verde en `@flo/core` y `@flo/web` — `@flo/core` ahora expone
`parse()` + `render()` end-to-end (spec §3, §9 Fase 2).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/render/index.ts packages/core/src/render/index.test.ts packages/core/src/index.ts
git commit -m "feat(core): render(source) end-to-end para flowchart y sequence"
```

## Task 7: Snapshot tests de diagramas de referencia

**Files:**
- Create: `packages/core/src/render/reference-diagrams.test.ts`

**Interfaces:**
- Consumes: `render` (`./index.js`, Task 6).
- Produces: `packages/core/src/render/__snapshots__/reference-diagrams.test.ts.snap`
  (generado por Vitest) — regresión visual básica sobre un set fijo de
  diagramas (spec §7): cualquier cambio no intencional en layout o render
  hace fallar este archivo.

- [ ] **Step 1: Escribir los tests de snapshot**

```typescript
// packages/core/src/render/reference-diagrams.test.ts
import { describe, it, expect } from "vitest";
import { render } from "./index.js";

describe("reference diagrams (visual snapshot)", () => {
  it("renders the login flowchart from the spec (branching decision)", () => {
    const source = [
      "diagram flowchart",
      "",
      "start[Inicio]",
      "check{Login valido}",
      "home[Mostrar home]",
      "error[Mostrar error]",
      "",
      "start -> check",
      "check -> home : si",
      "check -> error : no",
      "",
    ].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).toMatchSnapshot();
  });

  it("renders the login sequence diagram from the spec (three participants)", () => {
    const source = [
      "diagram sequence",
      "",
      "participant user as Usuario",
      "participant api as API",
      "participant db as Base de datos",
      "",
      "user -> api : POST /login",
      "api -> db : SELECT usuario",
      "db -> api : fila",
      "api -> user : 200 OK",
      "",
    ].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).toMatchSnapshot();
  });

  it("renders a flowchart with a single node and no edges", () => {
    const source = ["diagram flowchart", "", "solo[Nodo unico]", ""].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).toMatchSnapshot();
  });

  it("renders a sequence diagram with auto-declared participants (no explicit 'participant' lines)", () => {
    const source = ["diagram sequence", "", "a -> b : hola", "b -> a : chau", ""].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Generar los snapshots**

Run: `pnpm --filter @flo/core test`
Expected: PASS — Vitest crea
`packages/core/src/render/__snapshots__/reference-diagrams.test.ts.snap`
en la primera corrida (no existe snapshot previo con el que comparar).

- [ ] **Step 3: Confirmar que el snapshot generado es estable**

Run: `pnpm --filter @flo/core test`
Expected: PASS de nuevo, sin diffs — la segunda corrida compara contra
el `.snap` recién creado.

- [ ] **Step 4: Commit (incluye el `.snap` generado)**

```bash
git add packages/core/src/render/reference-diagrams.test.ts packages/core/src/render/__snapshots__/reference-diagrams.test.ts.snap
git commit -m "test(core): snapshots visuales sobre diagramas de referencia"
```

## Task 8: Actualizar README (estado Fase 2 completa)

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `render` exportado por `@flo/core` (Task 6).
- Produces: ninguna — solo documentación.

- [ ] **Step 1: Actualizar el estado y la API documentada**

En `README.md`, reemplazar el bloque de estado actual:

```markdown
> **Estado actual:** Fase 0 (monorepo + CI) y Fase 1 (lenguaje: lexer,
> parser, AST, diagnostics) completas para los tipos `flowchart` y
> `sequence`. Todavía no hay layout, render a SVG ni editor visual — eso
> son las próximas fases (ver [Roadmap](#roadmap)).
```

por:

```markdown
> **Estado actual:** Fase 0 (monorepo + CI), Fase 1 (lenguaje: lexer,
> parser, AST, diagnostics) y Fase 2 (layout con `dagre` + render a SVG)
> completas para los tipos `flowchart` y `sequence`. Todavía no hay
> editor visual — eso es la próxima fase (ver [Roadmap](#roadmap)).
```

Y en la sección `@flo/core`, después del bloque que documenta `parse()`,
agregar:

```markdown
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
```

Y en la sección `## Roadmap`, quitar la línea de la Fase 2 (ya cumplida)
dejando:

```markdown
## Roadmap

- **Fase 3** — editor web: split-pane CodeMirror 6 + preview en vivo.
- **Fase 4** — persistencia (File System Access API, autosave a IndexedDB) y exportación a SVG/PNG.
- **Fase 5** — publicación de `@flo/core` a npm, documentación de usuario final, deploy del editor.
```

- [ ] **Step 2: Verificar la suite completa una última vez**

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: verde — mismo resultado del Step 6 de Task 6, ahora con el
README actualizado en el mismo commit lógico de cierre de fase.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README refleja Fase 2 completa (layout + render SVG)"
```

---

## Auto-revisión (self-review)

- **Cobertura del spec:** arquitectura (§3 — `render()` público en
  `@flo/core`, Task 6), layout (§9 Fase 2 — `dagre` para flowchart Task
  1, columnas para sequence Task 2), render a SVG para ambos tipos (Task
  4-5), testing (§7 — snapshots de referencia, Task 7) — cubiertos.
  Editor web (§6), persistencia y exportación (§9 Fases 3-4) quedan
  explícitamente fuera de esta ronda, tal como se pidió.
- **Placeholders:** ninguno — cada paso trae código completo y valores
  numéricos exactos verificados corriendo el código real de `dagre`
  (0.8.5) antes de escribir este plan, no calculados a mano.
- **Consistencia de tipos:** `FlowchartLayout`/`FlowchartNodeLayout`/
  `FlowchartEdgeLayout` (Task 1) se usan idénticos en Task 4;
  `SequenceLayout`/`SequenceParticipantLayout`/`SequenceMessageLayout`
  más las constantes `COLUMN_WIDTH`/`HEADER_HEIGHT` (Task 2) se usan
  idénticos en Task 5; `escapeXml`/`ARROW_MARKER_ID`/`arrowMarkerDefs`/
  `svgText` (Task 3) se importan sin cambios de firma en Tasks 4-5;
  `renderFlowchartToSvg`/`renderSequenceToSvg` comparten la firma
  `(diagram, layout) => string` que Task 6 usa de forma intercambiable
  según `diagram.kind`, igual que Task 10 del plan de Fase 0+1 hizo con
  los parsers.
- **Convención `.js` en imports:** todos los imports relativos nuevos
  llevan el sufijo `.js` (`NodeNext`), verificado contra el código ya
  existente en `packages/core/src/index.ts` y los tests de Fase 1.
- **Riesgo técnico principal (dagre + TypeScript strict + NodeNext):**
  verificado antes de escribir este plan con una reproducción real
  (`tsc --noEmit` y una corrida de Vitest end-to-end con
  `import dagre from "dagre"` bajo `esModuleInterop` + `NodeNext`) — los
  números de layout y el string SVG de los tests de Task 1, 4 y 5 son
  la salida real de ese código, no una estimación.
