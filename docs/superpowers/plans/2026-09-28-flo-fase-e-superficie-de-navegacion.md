# .flo — Superficie de navegación en el core (Fase E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-09-28 (`e07edae`, `8ed80fd`, `bfea843`), revisión final sin hallazgos críticos ni importantes.

**Goal:** Que el SVG deje de ser una imagen muerta (atributos `data-flo-*`
en cada nodo y arista) y que `@flo/core` exponga el workspace, el índice de
referencias y el layout en su API pública.

**Architecture:** `layout/` pasa a registrar el `Range` de origen de cada
nodo (primera referencia en el bloque) y de cada arista. `render/` recibe
un `BlockOrigin` (`uri` + `BlockId`) y emite los atributos con un helper
`dataAttributes` en `render/svg.ts`. `render()` se apoya en una función
nueva `renderBlock(block, catalog, uri)`, que es la que un consumidor del
`Workspace` usa para renderizar un bloque de un documento linkeado. La
task 2 solo exporta: `Workspace`, `XRefIndex` (tipo), `blockId`, los tipos
de link, `layoutFlowchart`/`layoutSequence` con sus tipos, y `renderBlock`.

**Tech Stack:** TypeScript 5 (strict), Vitest. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
(§6.2 índice, §6.3 anotación del SVG, §10 Fase E, §11 decisiones #8, #15,
#24, #25). Orden de fases en
`docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md` §10
(D → **E** → K1 → …).

## Global Constraints

- **Snapshots de SVG no se regeneran** (`vitest -u` prohibido) y el archivo
  `render/__snapshots__/reference-diagrams.test.ts.snap` **no se toca**. Los
  atributos `data-flo-*` no son geometría: el test de snapshots los quita
  con `svg.replace(/ data-flo-[a-z]+="[^"]*"/g, "")` antes de
  `toMatchSnapshot()` (decisión #26, task 1). Si el snapshot falla después
  de quitarlos, es un bug.
- **Imports relativos en `packages/core/src/` llevan sufijo `.js`.**
- **Sin dependencias nuevas.** Nada de módulos de Node en `@flo/core`.
- **Mensajes y comentarios en español.** Nombres de test en inglés.
- **Sin códigos de diagnóstico nuevos** en esta fase.
- **Todo valor de atributo pasa por `escapeXml`** (el uri y los nombres
  vienen del usuario).
- **Orden fijo de atributos** (los tests comparan strings):
  nodos/participantes → `data-flo-entity`, `data-flo-block`,
  `data-flo-uri`, `data-flo-line`, después de `class` si lo hay;
  aristas/mensajes → `data-flo-from`, `data-flo-to`, `data-flo-block`,
  `data-flo-uri`, `data-flo-line`, al final del elemento, justo antes de
  ` />`.
- **`@flo/web` no se toca.** Consume `@flo/core` por `dist/`: la task 2
  termina con `pnpm --filter @flo/core build` y la suite completa.
- Un commit por task, terminando con la línea
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verificación final: `pnpm -r typecheck && pnpm -r test && pnpm -r build`
  (desde la raíz del repo).

## Review Focus

1. **Uri con `&`, `"` o `<`** (`render(src, 'r&d/"<x>".flo')`): los
   atributos salen escapados y el SVG sigue bien formado. Test en task 1.
2. **Entidad declarada en otro documento**: `data-flo-uri` es el
   documento del bloque y `data-flo-line` la línea de la referencia, no la
   de la declaración. Test en task 1.
3. **Entidad nombrada en varias aristas**: un solo `<g>` anotado por nodo,
   con la línea de su *primera* referencia en el bloque (aunque aparezca
   primero como destino); cada arista con su propia línea. Test en task 1.
4. **La geometría no se mueve**: los tres snapshots de referencia pasan
   byte a byte tras quitar los `data-flo-*`. Test en task 1.
5. **Consumidor que solo usa la API pública**: `Workspace` → `link()` →
   `renderBlock` da el mismo SVG que `render()` para un documento suelto,
   y la web compila y pasa contra el `dist/` nuevo. Test en task 2.

---

## File Structure

| Archivo | Responsabilidad | Task |
|---|---|---|
| `packages/core/src/layout/nodes.ts` | `BlockNode.range` (primera referencia) | 1 |
| `packages/core/src/layout/flowchart.ts` | `FlowchartEdgeLayout.range` | 1 |
| `packages/core/src/layout/sequence.ts` | `SequenceParticipantLayout.range`, `SequenceMessageLayout.range` | 1 |
| `packages/core/src/render/svg.ts` | `BlockOrigin`, `dataAttributes` | 1 |
| `packages/core/src/render/flowchart.ts`, `sequence.ts` | emitir `data-flo-*` | 1 |
| `packages/core/src/render/index.ts` | `renderBlock`; `render()` sobre él | 1 |
| `packages/core/src/render/reference-diagrams.test.ts` | quitar `data-flo-*` antes del snapshot | 1 |
| `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` | §7 fila `E033`; §11 #26; pendientes Fase E | 1 |
| `packages/core/src/index.ts` | exportar workspace, índice, layout, `renderBlock` | 2 |

---

### Task 1: Atributos `data-flo-*` en el SVG

**Files:**
- Modify: `packages/core/src/layout/nodes.ts`
- Modify: `packages/core/src/layout/flowchart.ts`
- Modify: `packages/core/src/layout/sequence.ts`
- Modify: `packages/core/src/render/svg.ts`
- Modify: `packages/core/src/render/flowchart.ts`
- Modify: `packages/core/src/render/sequence.ts`
- Modify: `packages/core/src/render/index.ts`
- Modify: `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
- Test: `packages/core/src/layout/flowchart.test.ts`, `packages/core/src/layout/sequence.test.ts`,
  `packages/core/src/render/flowchart.test.ts`, `packages/core/src/render/sequence.test.ts`,
  `packages/core/src/render/index.test.ts`, `packages/core/src/render/reference-diagrams.test.ts`

**Interfaces:**
- Consumes: `nodeId(ref)` (`layout/nodes.ts`), `blockId(uri, name)` y
  `BlockId` (`workspace/xref.ts`), `Catalog` (`workspace/resolver.ts`),
  `Workspace` (`workspace/workspace.ts`, solo en un test).
- Produces:
  ```ts
  // layout/nodes.ts
  export interface BlockNode { id: string; label: string; shape: NodeShape; resolved: boolean; range: Range }
  // layout/flowchart.ts
  export interface FlowchartEdgeLayout { from: string; to: string; label: string | null; points: LayoutPoint[]; range: Range }
  // layout/sequence.ts
  export interface SequenceParticipantLayout { id: string; label: string; resolved: boolean; x: number; range: Range }
  export interface SequenceMessageLayout { from: string; to: string; label: string; y: number; range: Range }
  // render/svg.ts
  export interface BlockOrigin { uri: DocumentUri; block: BlockId }
  export function dataAttributes(attributes: Record<string, string | number>): string;
  // render/flowchart.ts, render/sequence.ts
  export function renderFlowchartToSvg(layout: FlowchartLayout, origin: BlockOrigin): string;
  export function renderSequenceToSvg(layout: SequenceLayout, origin: BlockOrigin): string;
  // render/index.ts
  export function renderBlock(block: DiagramBlock, catalog: Catalog, uri: DocumentUri): RenderedDiagram;
  ```

- [x] **Step 1: Tests de layout que fallan (rango de cada nodo y arista)**

En `packages/core/src/layout/flowchart.test.ts`, reemplazar el `toEqual`
del test `"lays out a linear chain top-to-bottom with dagre, sizing each shape correctly"`
por este (mismos valores, más los `range`):

```ts
    expect(layoutFlowchart(block, catalog)).toEqual({
      width: 272,
      height: 340,
      nodes: [
        {
          id: "start", label: "Inicio", shape: "rectangle", resolved: true, x: 136, y: 45, width: 88, height: 50,
          range: { start: { line: 5, column: 3 }, end: { line: 5, column: 8 } },
        },
        {
          id: "check", label: "Login valido", shape: "decision", resolved: true, x: 136, y: 170, width: 232, height: 80,
          range: { start: { line: 5, column: 12 }, end: { line: 5, column: 17 } },
        },
        {
          id: "end", label: "Fin", shape: "rounded", resolved: true, x: 136, y: 295, width: 80, height: 50,
          range: { start: { line: 6, column: 12 }, end: { line: 6, column: 15 } },
        },
      ],
      edges: [
        {
          from: "start", to: "check", label: null, points: [{ x: 136, y: 70 }, { x: 136, y: 100 }, { x: 136, y: 130 }],
          range: { start: { line: 5, column: 3 }, end: { line: 5, column: 17 } },
        },
        {
          from: "check", to: "end", label: null, points: [{ x: 136, y: 210 }, { x: 136, y: 240 }, { x: 136, y: 270 }],
          range: { start: { line: 6, column: 3 }, end: { line: 6, column: 15 } },
        },
      ],
    });
```

Y agregar al final del `describe("layoutFlowchart", ...)`:

```ts
  it("records each node's first reference in the block, resolved or not", () => {
    const { block, catalog } = firstBlock("entity a\nentity b\nflow f {\n  a -> ghost\n  ghost -> b\n}\n");
    expect(layoutFlowchart(block, catalog).nodes.map((n) => [n.id, n.range])).toEqual([
      ["a", { start: { line: 4, column: 3 }, end: { line: 4, column: 4 } }],
      ["b", { start: { line: 5, column: 12 }, end: { line: 5, column: 13 } }],
      ["ghost", { start: { line: 4, column: 8 }, end: { line: 4, column: 13 } }],
    ]);
  });
```

En `packages/core/src/layout/sequence.test.ts`, reemplazar el `toEqual` del
test `"places participants in columns and a message on the first row"`:

```ts
    expect(layoutSequence(block, catalog)).toEqual({
      width: 320,
      height: 190,
      lifelineTop: 50,
      lifelineBottom: 170,
      participants: [
        { id: "a", label: "Alice", resolved: true, x: 80, range: { start: { line: 4, column: 3 }, end: { line: 4, column: 4 } } },
        { id: "b", label: "Bob", resolved: true, x: 240, range: { start: { line: 4, column: 8 }, end: { line: 4, column: 9 } } },
      ],
      messages: [
        { from: "a", to: "b", label: "hola", y: 120, range: { start: { line: 4, column: 3 }, end: { line: 4, column: 16 } } },
      ],
    });
```

- [x] **Step 2: Verificar que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/layout`
Expected: FAIL — los objetos no tienen `range`.

- [x] **Step 3: Implementar los rangos en `layout/`**

`packages/core/src/layout/nodes.ts` (archivo completo):

```ts
import type { DiagramBlock, NodeShape, Range, Ref } from "../ast.js";
import type { Catalog } from "../workspace/resolver.js";

export interface BlockNode {
  id: string;
  label: string;
  shape: NodeShape;
  resolved: boolean;
  /** Primera referencia al nodo dentro del bloque (no la declaración de la entidad). */
  range: Range;
}

/**
 * Nodos de un bloque, derivados de sus aristas (el bloque no declara nodos).
 * Las entidades resueltas van en orden de declaración del catálogo, así el
 * orden no depende de qué arista las nombra primero; las no resueltas
 * (E030) van al final, en orden de aparición, como placeholder con su
 * nombre como label.
 */
export function blockNodes(block: DiagramBlock, catalog: Catalog): BlockNode[] {
  const firstRef = new Map<string, Range>();
  const unresolved: string[] = [];
  for (const edge of block.edges) {
    for (const ref of [edge.from, edge.to]) {
      const id = nodeId(ref);
      if (firstRef.has(id)) continue;
      firstRef.set(id, ref.range);
      if (ref.target === null) unresolved.push(ref.name);
    }
  }

  const nodes: BlockNode[] = [];
  for (const entity of catalog.values()) {
    const range = firstRef.get(entity.id);
    if (range) nodes.push({ id: entity.id, label: entity.label, shape: entity.shape, resolved: true, range });
  }
  for (const name of unresolved) {
    nodes.push({ id: name, label: name, shape: "rectangle", resolved: false, range: firstRef.get(name)! });
  }
  return nodes;
}

/**
 * Id de nodo de un extremo de arista: la entidad resuelta, o el nombre
 * escrito si no resolvió (placeholder). Decisión #15.
 */
export function nodeId(ref: Ref): string {
  return ref.target ?? ref.name;
}
```

`packages/core/src/layout/flowchart.ts`: agregar `Range` al import de
`../ast.js`, el campo a la interfaz y a la construcción de aristas:

```ts
import type { DiagramBlock, NodeShape, Range } from "../ast.js";
```

```ts
export interface FlowchartEdgeLayout {
  from: string;
  to: string;
  label: string | null;
  points: LayoutPoint[];
  range: Range;
}
```

```ts
    edges: block.edges.map((edge) => ({
      from: nodeId(edge.from),
      to: nodeId(edge.to),
      label: edge.label,
      points: graph.edge(nodeId(edge.from), nodeId(edge.to)).points,
      range: edge.range,
    })),
```

`FlowchartNodeLayout extends BlockNode` hereda `range` sin cambios (el
`...node` ya lo copia).

`packages/core/src/layout/sequence.ts`: agregar `import type { DiagramBlock, Range } from "../ast.js";`
y:

```ts
export interface SequenceParticipantLayout {
  id: string;
  label: string;
  resolved: boolean;
  x: number;
  range: Range;
}

export interface SequenceMessageLayout {
  from: string;
  to: string;
  label: string;
  y: number;
  range: Range;
}
```

```ts
  const participants: SequenceParticipantLayout[] = blockNodes(block, catalog).map((node, index) => ({
    id: node.id,
    label: node.label,
    resolved: node.resolved,
    x: COLUMN_WIDTH / 2 + index * COLUMN_WIDTH,
    range: node.range,
  }));

  const messages: SequenceMessageLayout[] = block.edges.map((edge, index) => ({
    from: nodeId(edge.from),
    to: nodeId(edge.to),
    label: edge.label ?? "", // el parser garantiza la etiqueta en `sequence`
    y: HEADER_HEIGHT + TOP_MARGIN + (index + 1) * ROW_HEIGHT,
    range: edge.range,
  }));
```

- [x] **Step 4: Verificar que layout pasa**

Run: `pnpm --filter @flo/core exec vitest run src/layout`
Expected: PASS.

- [x] **Step 5: Tests de render que fallan**

`packages/core/src/render/flowchart.test.ts` (archivo completo):

```ts
import { describe, it, expect } from "vitest";
import { renderFlowchartToSvg } from "./flowchart.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import { parse } from "../parser/index.js";

function renderFirst(source: string): string {
  const { document, catalog } = parse(source, "doc.flo");
  return renderFlowchartToSvg(layoutFlowchart(document.blocks[0], catalog), { uri: "doc.flo", block: "doc.flo#f" });
}

describe("renderFlowchartToSvg", () => {
  it("renders a rectangle, a rounded node and a labeled edge between them", () => {
    const svg = renderFirst("entity start [Inicio]\nentity end (Fin)\nflow f {\n  start -> end : ok\n}\n");

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="200" viewBox="0 0 128 200">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g data-flo-entity="start" data-flo-block="doc.flo#f" data-flo-uri="doc.flo" data-flo-line="4"><rect x="20" y="20" width="88" height="50" rx="0" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="64" y="45" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Inicio</text></g>' +
        '<g data-flo-entity="end" data-flo-block="doc.flo#f" data-flo-uri="doc.flo" data-flo-line="4"><rect x="24" y="130" width="80" height="50" rx="12" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="64" y="155" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Fin</text></g>' +
        '<polyline points="64,70 64,100 64,130" fill="none" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" data-flo-from="start" data-flo-to="end" data-flo-block="doc.flo#f" data-flo-uri="doc.flo" data-flo-line="4" /><rect x="53" y="84" width="22" height="16" fill="#ffffff" /><text x="64" y="92" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">ok</text>' +
        "</svg>"
    );
  });

  it("renders a decision node as a polygon", () => {
    const svg = renderFirst("entity a [A]\nentity check {OK?}\nflow f {\n  a -> check\n}\n");
    expect(svg).toContain("<polygon points=");
  });

  it("renders an unresolved reference as a dashed, marked placeholder labelled with its name", () => {
    const svg = renderFirst("entity a [A]\nflow f {\n  a -> ghost\n}\n");
    expect(svg).toMatch(/<g class="flo-unresolved" data-flo-entity="ghost"[^>]*><rect/);
    expect(svg).toContain('stroke-dasharray="4 4"');
    expect(svg).toContain(">ghost<");
    expect(svg).not.toContain("NaN");
  });
});
```

`packages/core/src/render/sequence.test.ts` (archivo completo):

```ts
import { describe, it, expect } from "vitest";
import { renderSequenceToSvg } from "./sequence.js";
import { layoutSequence } from "../layout/sequence.js";
import { parse } from "../parser/index.js";

function renderFirst(source: string): string {
  const { document, catalog } = parse(source, "doc.flo");
  return renderSequenceToSvg(layoutSequence(document.blocks[0], catalog), { uri: "doc.flo", block: "doc.flo#s" });
}

describe("renderSequenceToSvg", () => {
  it("renders participant boxes, lifelines and one message with its label", () => {
    const svg = renderFirst("entity a [Alice]\nentity b [Bob]\nsequence s {\n  a -> b : hola\n}\n");

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g data-flo-entity="a" data-flo-block="doc.flo#s" data-flo-uri="doc.flo" data-flo-line="4"><g class="flo-seq-header-box"><rect x="10" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="80" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Alice</text></g><line x1="80" y1="50" x2="80" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<g data-flo-entity="b" data-flo-block="doc.flo#s" data-flo-uri="doc.flo" data-flo-line="4"><g class="flo-seq-header-box"><rect x="170" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="240" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Bob</text></g><line x1="240" y1="50" x2="240" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<line x1="80" y1="120" x2="240" y2="120" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" data-flo-from="a" data-flo-to="b" data-flo-block="doc.flo#s" data-flo-uri="doc.flo" data-flo-line="4" /><rect x="142" y="104" width="36" height="16" fill="#ffffff" /><text x="160" y="112" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">hola</text>' +
        "</svg>"
    );
  });

  it("renders an unresolved participant with a dashed box, keeping the sticky-header class", () => {
    const svg = renderFirst("entity a\nsequence s {\n  a -> ghost : x\n}\n");
    expect(svg).toMatch(/<g class="flo-unresolved" data-flo-entity="ghost"[^>]*><g class="flo-seq-header-box">/);
    expect(svg).toContain('stroke-width="2" stroke-dasharray="4 4" />');
    expect(svg).toContain(">ghost<");
  });
});
```

En `packages/core/src/render/index.test.ts`, cambiar el import de la
primera línea tras `vitest` por:

```ts
import { render, renderBlock } from "./index.js";
import { Workspace } from "../workspace/workspace.js";
```

y agregar al final del archivo:

```ts
describe("render: data-flo-* annotations", () => {
  it("annotates every node and edge with its entity, block, document and line", () => {
    const svg = render("entity a [A]\nflow f {\n  a -> ghost : sí\n}\n", "docs/login.flo").diagrams[0].svg;
    expect(svg).toContain(
      '<g data-flo-entity="a" data-flo-block="docs/login.flo#f" data-flo-uri="docs/login.flo" data-flo-line="3">'
    );
    expect(svg).toContain(
      '<g class="flo-unresolved" data-flo-entity="ghost" data-flo-block="docs/login.flo#f" data-flo-uri="docs/login.flo" data-flo-line="3">'
    );
    expect(svg).toContain(
      'marker-end="url(#flo-arrow)" data-flo-from="a" data-flo-to="ghost" data-flo-block="docs/login.flo#f" data-flo-uri="docs/login.flo" data-flo-line="3" />'
    );
  });

  it("annotates sequence participants and each message with its own line", () => {
    const svg = render("entity a\nentity b\nsequence s {\n  a -> b : uno\n  b -> a : dos\n}\n", "s.flo").diagrams[0].svg;
    expect(svg).toContain(
      '<g data-flo-entity="a" data-flo-block="s.flo#s" data-flo-uri="s.flo" data-flo-line="4"><g class="flo-seq-header-box">'
    );
    expect(svg).toContain(
      '<g data-flo-entity="b" data-flo-block="s.flo#s" data-flo-uri="s.flo" data-flo-line="4"><g class="flo-seq-header-box">'
    );
    expect(svg).toContain('data-flo-from="a" data-flo-to="b" data-flo-block="s.flo#s" data-flo-uri="s.flo" data-flo-line="4" />');
    expect(svg).toContain('data-flo-from="b" data-flo-to="a" data-flo-block="s.flo#s" data-flo-uri="s.flo" data-flo-line="5" />');
  });

  it("gives each node one annotated group, with the line of its first reference in the block", () => {
    const svg = render("entity a\nentity b\nentity c\nflow f {\n  a -> b\n  c -> a\n  b -> c\n}\n").diagrams[0].svg;
    expect(svg.match(/data-flo-entity=/g)).toHaveLength(3);
    expect(svg).toContain('data-flo-entity="b" data-flo-block="#f" data-flo-uri="" data-flo-line="5"');
    expect(svg).toContain('data-flo-entity="c" data-flo-block="#f" data-flo-uri="" data-flo-line="6"');
  });

  it("annotates an entity shared by two blocks with each block's own id", () => {
    const [x, y] = render("entity a\nentity b\nflow x {\n  a -> b\n}\nflow y {\n  b -> a\n}\n", "d.flo").diagrams;
    expect(x.svg).toContain('data-flo-entity="a" data-flo-block="d.flo#x" data-flo-uri="d.flo" data-flo-line="4"');
    expect(y.svg).toContain('data-flo-entity="a" data-flo-block="d.flo#y" data-flo-uri="d.flo" data-flo-line="7"');
  });

  it("escapes the document uri inside the attributes", () => {
    const svg = render("entity a\nentity b\nflow f {\n  a -> b\n}\n", 'r&d/"<x>".flo').diagrams[0].svg;
    expect(svg).toContain('data-flo-uri="r&amp;d/&quot;&lt;x&gt;&quot;.flo"');
    expect(svg).toContain('data-flo-block="r&amp;d/&quot;&lt;x&gt;&quot;.flo#f"');
    expect(svg).not.toContain('"<x>"');
  });

  it("annotates an entity declared in another document with the block's document and the reference line", () => {
    const workspace = new Workspace();
    workspace.setDocument("catalogo.flo", "entity api [API]\nentity db [DB]\n");
    workspace.setDocument("login.flo", 'use "./catalogo.flo"\n\nflow acceso {\n  api -> db\n}\n');
    const { document, catalog } = workspace.link().documents.get("login.flo")!;

    const diagram = renderBlock(document.blocks[0], catalog, "login.flo");

    expect(diagram).toMatchObject({ name: "acceso", title: null, kind: "flow" });
    expect(diagram.svg).toContain(
      '<g data-flo-entity="api" data-flo-block="login.flo#acceso" data-flo-uri="login.flo" data-flo-line="4">'
    );
    expect(diagram.svg).not.toContain("catalogo.flo");
  });
});
```

En `packages/core/src/render/reference-diagrams.test.ts`, agregar después
del import de `./index.js`:

```ts
// Los data-flo-* (decisión #26) no son geometría: se quitan antes de
// comparar, y así estos snapshots siguen sin regenerarse.
function geometry(svg: string): string {
  return svg.replace(/ data-flo-[a-z]+="[^"]*"/g, "");
}
```

y cambiar las tres líneas `expect(diagrams[0].svg).toMatchSnapshot();` por
`expect(geometry(diagrams[0].svg)).toMatchSnapshot();`. **No tocar el
`.snap`.**

- [x] **Step 6: Verificar que fallan**

Run: `pnpm --filter @flo/core exec vitest run src/render`
Expected: FAIL — typecheck/`renderBlock` no existe y los SVG no traen
`data-flo-*`. (Los snapshots pasan ya en este paso: quitar atributos que
todavía no existen no cambia nada.)

- [x] **Step 7: Implementar el render anotado**

`packages/core/src/render/svg.ts`: agregar al principio y después de
`escapeXml`:

```ts
import type { DocumentUri } from "../ast.js";
import type { BlockId } from "../workspace/xref.js";
```

```ts
/** De dónde sale un bloque renderizado: se repite en cada elemento anotado. */
export interface BlockOrigin {
  uri: DocumentUri;
  block: BlockId;
}

/** Atributos `data-flo-*` (spec §6.3, decisión #26), en el orden dado y escapados. */
export function dataAttributes(attributes: Record<string, string | number>): string {
  return Object.entries(attributes)
    .map(([name, value]) => ` data-flo-${name}="${escapeXml(String(value))}"`)
    .join("");
}
```

`packages/core/src/render/flowchart.ts`: importar `BlockOrigin` y
`dataAttributes` de `./svg.js` y reemplazar `renderFlowchartToSvg`:

```ts
export function renderFlowchartToSvg(layout: FlowchartLayout, origin: BlockOrigin): string {
  const nodeElements = layout.nodes.map((node) => {
    const data = dataAttributes({ entity: node.id, block: origin.block, uri: origin.uri, line: node.range.start.line });
    return `<g${node.resolved ? "" : ' class="flo-unresolved"'}${data}>${shapeElement(node)}${svgText(node.x, node.y, node.label)}</g>`;
  });

  const edgeElements = layout.edges.map((edge) => {
    const points = edge.points.map((point) => `${point.x},${point.y}`).join(" ");
    const data = dataAttributes({
      from: edge.from,
      to: edge.to,
      block: origin.block,
      uri: origin.uri,
      line: edge.range.start.line,
    });
    const line = `<polyline points="${points}" fill="none" stroke="${STROKE_COLOR}" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})"${data} />`;
    if (!edge.label) {
      return line;
    }
    const mid = edge.points[Math.floor(edge.points.length / 2)];
    return `${line}${svgLabel(mid.x, mid.y - 8, edge.label)}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${arrowMarkerDefs()}${nodeElements.join("")}${edgeElements.join("")}</svg>`;
}
```

`packages/core/src/render/sequence.ts`: importar `BlockOrigin` y
`dataAttributes` de `./svg.js`; la firma pasa a
`renderSequenceToSvg(layout: SequenceLayout, origin: BlockOrigin)`, y
dentro:

```ts
    const data = dataAttributes({
      entity: participant.id,
      block: origin.block,
      uri: origin.uri,
      line: participant.range.start.line,
    });
    const group = `<g${participant.resolved ? "" : ' class="flo-unresolved"'}${data}>`;
    return `${group}<g class="flo-seq-header-box">${box}${label}</g>${lifeline}</g>`;
```

(reemplaza la línea `const group = participant.resolved ? "<g>" : '<g class="flo-unresolved">';`
y el `return` que la sigue), y en `messageElements`:

```ts
    const data = dataAttributes({
      from: message.from,
      to: message.to,
      block: origin.block,
      uri: origin.uri,
      line: message.range.start.line,
    });
    const line = `<line x1="${x1}" y1="${message.y}" x2="${x2}" y2="${message.y}" stroke="${STROKE_COLOR}" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})"${data} />`;
```

`packages/core/src/render/index.ts` (archivo completo):

```ts
import { parse } from "../parser/index.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import { layoutSequence } from "../layout/sequence.js";
import { renderFlowchartToSvg } from "./flowchart.js";
import { renderSequenceToSvg } from "./sequence.js";
import { blockId } from "../workspace/xref.js";
import type { Catalog } from "../workspace/resolver.js";
import type { BlockKind, DiagramBlock, DocumentUri } from "../ast.js";
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

/** Un bloque de un documento ya linkeado, contra el catálogo alcanzable de ese documento. */
export function renderBlock(block: DiagramBlock, catalog: Catalog, uri: DocumentUri): RenderedDiagram {
  const origin = { uri, block: blockId(uri, block.name) };
  return {
    name: block.name,
    title: block.title,
    kind: block.kind,
    svg:
      block.kind === "flow"
        ? renderFlowchartToSvg(layoutFlowchart(block, catalog), origin)
        : renderSequenceToSvg(layoutSequence(block, catalog), origin),
  };
}

export function render(source: string, uri: DocumentUri = ""): RenderResult {
  const { document, catalog, diagnostics } = parse(source, uri);
  return { diagrams: document.blocks.map((block) => renderBlock(block, catalog, uri)), diagnostics };
}
```

- [x] **Step 8: Verificar que core pasa, snapshots incluidos**

Run: `pnpm --filter @flo/core typecheck && pnpm --filter @flo/core test`
Expected: PASS. `git status --short packages/core/src/render/__snapshots__`
no lista nada.

- [x] **Step 9: Spec — §7, decisión #26 y pendientes**

En `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`:

1. En la tabla del §7, reemplazar la fila de `E033`:

```markdown
| `E033` | Nombre de bloque duplicado en el documento (decisión #25).        |
```

2. Al final del archivo (después de la tabla "Decisiones de la Fase D"),
agregar:

```markdown

### Decisiones de la Fase E (2026-09-28)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 26 | 2026-09-28 | **Atributos `data-flo-*` del SVG** (§6.3). Cada nodo o participante (`<g>` exterior) lleva `data-flo-entity` (id del nodo: la entidad resuelta, o el nombre escrito si es placeholder, que además tiene `flo-unresolved`), `data-flo-block` (`BlockId`, #25), `data-flo-uri` (documento del bloque, no el de la declaración) y `data-flo-line` (línea de la primera referencia al nodo en el bloque). Cada arista o mensaje (`<polyline>`/`<line>`) lleva `data-flo-from`, `data-flo-to`, `data-flo-block`, `data-flo-uri` y `data-flo-line` (línea de la arista). Se emiten siempre, también en Exportar SVG. Los snapshots de SVG comparan geometría: el test quita `data-flo-*` antes de `toMatchSnapshot()` y el `.snap` no se regenera. Los tipos de `layout/` llevan el `Range` de origen de cada nodo y arista. | render (E), preview y navegación (F), vista de grafo (K4) |

### Pendientes diferidos (Fase E, 2026-09-28)

- **F — preview:** el header fijo de `sequence` (`sequence-view.ts`) clona
  `.flo-seq-header-box`, que no lleva los `data-flo-*` (están en el `<g>`
  padre): un click en el header fijo tiene que resolverse contra el
  participante original.
- **F — workspace:** `link()` reescribe `Ref.target` en los documentos que
  guarda el `Workspace`, así que un `LinkResult` anterior cambia con el
  siguiente `link()` (§6.4). El editor no debe conservar resultados viejos
  entre links.
- **F — mensajes:** un `use` cuya ruta sale de la raíz da `E032` con el
  texto "no existe en el workspace"; convendría decir que sale de la raíz.
```

- [x] **Step 10: Commit**

```bash
git add packages/core/src/layout packages/core/src/render docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "feat(core): atributos data-flo-* en el SVG

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: API pública de workspace, índice y layout

**Files:**
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes: `Workspace`, `LinkResult`, `LinkedDocument`
  (`workspace/workspace.ts`); `XRefIndex`, `blockId`, `BlockId`, `Location`
  (`workspace/xref.ts`); `layoutFlowchart` y sus tipos
  (`layout/flowchart.ts`); `layoutSequence` y sus tipos
  (`layout/sequence.ts`); `BlockNode` (`layout/nodes.ts`); `renderBlock`
  (`render/index.ts`, task 1).
- Produces: esos mismos nombres, importables desde `@flo/core`.
  `XRefIndex` se exporta **solo como tipo** (se obtiene de `link()`, no se
  construye).

- [x] **Step 1: Escribir el test que falla**

En `packages/core/src/index.test.ts`, reemplazar la línea de import de
`./index.js` por:

```ts
import {
  parse,
  render,
  renderBlock,
  formatDiagnostic,
  escapeXml,
  Workspace,
  blockId,
  layoutFlowchart,
  layoutSequence,
  type BlockId,
  type FlowchartLayout,
  type LinkResult,
  type Location,
  type SequenceLayout,
} from "./index.js";
```

y agregar al final del archivo:

```ts
describe("index: navigation surface (Fase E)", () => {
  const catalog = "entity user [Usuario]\nentity api [API]\n";
  const login = 'use "./catalog.flo"\n\nflow login {\n  user -> api\n}\n\nsequence handshake {\n  user -> api : hola\n}\n';

  function linked(): LinkResult {
    const workspace = new Workspace();
    workspace.setDocument("catalog.flo", catalog);
    workspace.setDocument("login.flo", login);
    return workspace.link();
  }

  it("links a multi-document workspace and answers cross-reference queries", () => {
    const result = linked();
    expect([...result.diagnostics.values()].flat()).toEqual([]);

    const flows: BlockId[] = result.xref.flowsUsing("api");
    expect(flows).toEqual([blockId("login.flo", "login"), blockId("login.flo", "handshake")]);
    const definition: Location | null = result.xref.definitionOf("api");
    expect(definition?.uri).toBe("catalog.flo");
  });

  it("exposes the layout of a block from a linked document", () => {
    const { document, catalog: reachable } = linked().documents.get("login.flo")!;

    const flow: FlowchartLayout = layoutFlowchart(document.blocks[0], reachable);
    const sequence: SequenceLayout = layoutSequence(document.blocks[1], reachable);

    expect(flow.nodes.map((n) => [n.id, n.label, n.range.start.line])).toEqual([
      ["user", "Usuario", 4],
      ["api", "API", 4],
    ]);
    expect(sequence.participants.map((p) => p.id)).toEqual(["user", "api"]);
  });

  it("renders a block of a linked document with its data-flo-* annotations", () => {
    const { document, catalog: reachable } = linked().documents.get("login.flo")!;
    const diagram = renderBlock(document.blocks[0], reachable, "login.flo");
    expect(diagram).toMatchObject({ name: "login", title: null, kind: "flow" });
    expect(diagram.svg).toContain(
      'data-flo-entity="api" data-flo-block="login.flo#login" data-flo-uri="login.flo" data-flo-line="4"'
    );
  });

  it("renders a single document the same through render() and through a one-document workspace", () => {
    const source = "entity a [A]\nentity b {B?}\nflow f {\n  a -> b : si\n}\n";
    const workspace = new Workspace();
    workspace.setDocument("solo.flo", source);
    const { document, catalog: reachable } = workspace.link().documents.get("solo.flo")!;

    expect(renderBlock(document.blocks[0], reachable, "solo.flo").svg).toBe(render(source, "solo.flo").diagrams[0].svg);
  });
});
```

- [x] **Step 2: Verificar que falla**

Run: `pnpm --filter @flo/core exec vitest run src/index.test.ts`
Expected: FAIL — `Workspace`, `blockId`, `layoutFlowchart`, … no se
exportan desde `./index.js`.

- [x] **Step 3: Exportar**

`packages/core/src/index.ts`: reemplazar la línea
`export { render } from "./render/index.js";` por
`export { render, renderBlock } from "./render/index.js";` y agregar,
después de la línea `export type { Catalog } from "./workspace/resolver.js";`:

```ts
export { Workspace } from "./workspace/workspace.js";
export type { LinkResult, LinkedDocument } from "./workspace/workspace.js";
export { blockId } from "./workspace/xref.js";
export type { XRefIndex, BlockId, Location } from "./workspace/xref.js";
export { layoutFlowchart } from "./layout/flowchart.js";
export type { FlowchartLayout, FlowchartNodeLayout, FlowchartEdgeLayout, LayoutPoint } from "./layout/flowchart.js";
export { layoutSequence } from "./layout/sequence.js";
export type { SequenceLayout, SequenceParticipantLayout, SequenceMessageLayout } from "./layout/sequence.js";
export type { BlockNode } from "./layout/nodes.js";
```

- [x] **Step 4: Verificar que pasa**

Run: `pnpm --filter @flo/core exec vitest run src/index.test.ts`
Expected: PASS.

- [x] **Step 5: Verificación completa (core build + web contra el `dist/` nuevo)**

Run (desde la raíz del repo):
`pnpm --filter @flo/core build && pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: todo PASS; `git status --short packages/core/src/render/__snapshots__ packages/web`
no lista nada.

- [x] **Step 6: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): API pública de workspace, índice y layout

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
