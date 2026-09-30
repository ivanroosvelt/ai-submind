# .flo — vista de grafo de conocimiento (Fase K4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El editor web suma un tercer modo de preview, "Grafo": el
resultado de `query` dibujado como SVG (color por tipo de memoria, tipo de
relación como label, bloques destino de `visualized_by`), con barra de
filtros (memoria, tags, texto, profundidad), pan/zoom por `viewBox`,
drill-down al editor y a los flujos, y presets guardados en
`.flo/views/<nombre>.json` de la carpeta abierta. De paso cierra el
pendiente de K3 sobre errores en las herramientas MCP.

**Architecture:** Una pieza pura nueva en `@flo/core`:
`renderKnowledge(link, result)` (`render/knowledge.ts`), que reusa la forma
de nodo del flowchart con un relleno parametrizable. En `@flo/web`, tres
módulos chicos y testeables por separado: `pan-zoom.ts` (aritmética del
`viewBox` y listeners), `knowledge-view.ts` (`GraphQuery`, `Where` ↔ barra,
HTML de la barra y del grafo) y `presets.ts` (validar, listar y guardar
presets sobre un `FileSystemDirectoryHandle`). `App` pasa de un booleano
`mapMode` a `mode: "document" | "map" | "graph"` y orquesta todo; nadie
guarda un `LinkResult` (cada `refresh` enlaza de nuevo, #37).

**Tech Stack:** TypeScript 5 (strict), dagre 0.8 (multigrafo), Vite,
Vitest + jsdom + fake-indexeddb, File System Access API.

**Spec:** `docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md`
(§7 vista de grafo, §10 K4, §11 testing K4). Decisiones vigentes en
`docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` §11:
#24, #25, #26, #31, #32, #35, #37, #38, #40, #41, #42 y las nuevas
**#44–#47** de esta fase (escritas en §11 junto con este plan). Pendientes
de §11 que este plan recoge:

| Pendiente | Dónde |
|---|---|
| K2 — dos relaciones idénticas dan dos aristas idénticas | task 1 (dedupe por `from\|to\|type`, #44) |
| K3 — `list_tags` sin `inputSchema`; un error del core llega como texto del SDK | task 7 (#47) |

Orden de fases: D → E → K1 → K2 → K3 → F → **K4** (la última de ambos specs).

## Global Constraints

- **Sin dependencias nuevas** en ningún paquete. dagre ya está en core
  (`new dagre.graphlib.Graph({ multigraph: true })`).
- **`@flo/web` consume `@flo/core` por `dist/`**: la task 1 termina con
  `pnpm --filter @flo/core build`; antes de correr los tests de web, el
  `dist/` tiene que estar al día.
- **Imports relativos con sufijo `.js`** en `packages/core/src/` y en
  `packages/web/src/`.
- **Snapshots de SVG existentes**: ninguno cambia y no se regeneran
  (`vitest -u` prohibido). La task 1 agrega **un archivo de snapshot
  nuevo** (`render/__snapshots__/knowledge.test.ts.snap`), que vitest
  escribe la primera vez sin `-u`; `reference-diagrams.test.ts.snap` no se
  toca (el cambio de `shapeElement` tiene que dar los mismos bytes).
- **Sin códigos de diagnóstico nuevos.** Los rechazos de nombres de vista
  y de presets inválidos son mensajes, no `Diagnostic`.
- **Textos de UI, mensajes y comentarios en español**; nombres de test en
  inglés.
- **Todo lo que viene del usuario y va a HTML o SVG pasa por `escapeXml`**
  (títulos, ids, uris, tags, texto de búsqueda, nombres de vista), también
  en atributos.
- Un commit por task (`feat(core): ...`, `feat(web): ...`, `fix(mcp): ...`,
  `docs: ...`), con la línea final
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verificación final (desde la raíz): `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

## Review Focus

1. **Un preset escrito a mano o roto** (JSON inválido, `where` con una
   clave mal escrita, `depth: -1`, archivo `../x.json` o con espacios en
   el nombre): se salta con un aviso en consola y el resto de las vistas
   se listan; nunca rompe la vista de grafo. Guardar con un nombre como
   `../x` o `a b` se rechaza sin escribir. Tests en tasks 4 y 6.
2. **Títulos, tags y texto con `<`, `"` o `&`** (un `.md` con
   `title: "A <b> & \"c\""`, un `context_tag` con comillas, una búsqueda
   con `"`): se ven literales en el SVG y en la barra, sin romper el HTML.
   Tests en tasks 1 y 3.
3. **Un filtro sin resultados o un workspace sin `.md`**: el grafo dice
   "Ninguna nota coincide con el filtro"; exportar no lanza (no hay SVG que
   exportar). Test en task 5.
4. **Editar en el grafo centrado en una entidad que después se borra o
   renombra**: el grafo se recalcula sin esa semilla (`query` ignora ids
   desconocidos) y "Centrado en" muestra el id; no hay excepción. Test en
   task 5.
5. **Arrastrar el grafo y soltar sobre un nodo**: no abre el archivo (el
   click que sigue a un arrastre de más de 3 px se descarta); un click
   quieto sí. Test en task 2.

---

## File Structure

`packages/core/src/`:
- Create `render/knowledge.ts` — `renderKnowledge`, `MEMORY_FILL`.
- Create `render/knowledge.test.ts` (+ el `.snap` nuevo que escribe vitest).
- Modify `render/flowchart.ts` — `shapeElement` exportada, con `dashed` y `fill` como parámetros.
- Modify `index.ts`, `index.test.ts` — exportar lo nuevo.

`packages/web/src/`:
- Create `pan-zoom.ts` (+ test) — `ViewBox`, `parseViewBox`, `zoomViewBox`, `panViewBox`, `bindPanZoom`.
- Create `knowledge-view.ts` (+ test) — `GraphQuery`, `GraphFilter`, `DEFAULT_GRAPH`, `whereOf`, `filterOf`, `readBar`, `graphBarHtml`, `graphHtml`.
- Create `presets.ts` (+ test) — `Preset`, `isPresetName`, `isWhere`, `parsePreset`, `byName`, `listPresets`, `savePreset`.
- Create `test-dir.ts` — `memoryDir`: carpeta en memoria que se lee y se escribe (solo la usan tests).
- Modify `folder-io.ts` (+ test) — `ensureWritable(dir)` pasa a `ensurePermission(dir, mode)`.
- Modify `toolbar.ts` (+ test) — botón "Grafo".
- Modify `app.ts` (+ test) — modo de preview, vista de grafo, drill-down, presets.
- Modify `index.html` — estilos de la barra, la leyenda y el grafo.

`packages/mcp/src/`:
- Modify `tools.ts` (+ test) — `inputSchema` de `list_tags` y errores como `{ error }`.

Docs (task 8): `README.md`, estado de los dos specs y de este plan.

---

### Task 1: `renderKnowledge` en el core

**Files:**
- Create: `packages/core/src/render/knowledge.ts`
- Create: `packages/core/src/render/knowledge.test.ts`
- Modify: `packages/core/src/render/flowchart.ts` (`shapeElement`)
- Modify: `packages/core/src/index.ts`, `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes: `query`, `QueryResult` (`workspace/query.ts`); `LinkResult` y
  `link.xref.relationsFrom(id)`; `measureFlowchartNode` (`layout/flowchart.ts`);
  `dataAttributes`, `svgText`, `svgLabel`, `arrowMarkerDefs`,
  `ARROW_MARKER_ID`, `FILL_COLOR`, `STROKE_COLOR` (`render/svg.ts`).
- Produces:
  - `renderKnowledge(link: LinkResult, result: QueryResult): string` — el SVG (decisión #44).
  - `MEMORY_FILL: Record<MemoryType, string>` — `{ working: "#fef3c7", short_term: "#e0e7ff", long_term: "#dcfce7" }`; la web lo usa para la leyenda.
  - `shapeElement(node: { x; y; width; height; shape }, dashed = false, fill = FILL_COLOR): string` exportada desde `render/flowchart.ts`.
  - Atributos del SVG: nodo de entidad `<g [class="flo-mem-<tipo>"] data-flo-entity data-flo-uri>`; nodo de bloque `<g class="flo-kg-block" data-flo-block data-flo-uri>`; arista `<polyline data-flo-from data-flo-to data-flo-type [data-flo-block]>`, en ese orden.

- [ ] **Step 1: Write the failing test**

`packages/core/src/render/knowledge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Workspace } from "../workspace/workspace.js";
import { query } from "../workspace/query.js";
import { FILL_COLOR } from "./svg.js";
import { MEMORY_FILL, renderKnowledge } from "./knowledge.js";

// Los data-flo-* no son geometría (decisión #26): se quitan antes del snapshot.
function geometry(svg: string): string {
  return svg.replace(/ data-flo-[a-z]+="[^"]*"/g, "");
}

const FILES: Record<string, string> = {
  "knowledge.schema.yaml": "type_tags: [decision]\nrelation_types: [affects, enforces, visualized_by]\n",
  "catalog.flo": 'entity api [API]\nentity db\nflow acceso "Acceso" {\n  api -> db\n}\n',
  "kb/pkce.md": [
    "---",
    "id: pkce",
    "title: PKCE",
    "memory_type: long_term",
    "type_tags: [decision]",
    'use: ["../catalog.flo"]',
    "relations:",
    "  - target: api",
    "    type: affects",
    "  - target: api",
    "    type: affects",
    "  - target: api",
    "    type: enforces",
    "  - target: ../catalog.flo#acceso",
    "    type: visualized_by",
    "  - target: rule.md",
    "    type: enforces",
    "---",
    "Texto.",
    "",
  ].join("\n"),
  "kb/rule.md": '---\nid: rule\ntitle: "Regla <1> & \\"b\\""\nmemory_type: working\n---\n',
};

function linkOf(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

const count = (text: string, part: string) => text.split(part).length - 1;

describe("renderKnowledge", () => {
  const link = linkOf(FILES);
  const svg = renderKnowledge(link, query(link, { where: { text: "" }, depth: 1 }));

  it("uses a fixture without diagnostics", () => {
    expect([...link.diagnostics.values()].flat()).toEqual([]);
  });

  it("matches the knowledge graph snapshot", () => {
    expect(geometry(svg)).toMatchSnapshot();
  });

  it("colors knowledge nodes by memory type and keeps .flo entities plain", () => {
    expect(svg).toContain(`<g class="flo-mem-long_term" data-flo-entity="pkce" data-flo-uri="kb/pkce.md"><rect`);
    expect(svg).toContain(`fill="${MEMORY_FILL.long_term}"`);
    expect(svg).toContain(`<g class="flo-mem-working" data-flo-entity="rule" data-flo-uri="kb/rule.md">`);
    expect(svg).toContain(`fill="${MEMORY_FILL.working}"`);
    expect(svg).toContain(`<g data-flo-entity="api" data-flo-uri="catalog.flo"><rect`);
    expect(svg).toContain(`fill="${FILL_COLOR}"`);
  });

  it("draws a duplicated relation once and two relation types between a pair as two edges", () => {
    expect(count(svg, 'data-flo-from="pkce" data-flo-to="api" data-flo-type="affects"')).toBe(1);
    expect(count(svg, 'data-flo-from="pkce" data-flo-to="api" data-flo-type="enforces"')).toBe(1);
    expect(svg).toContain(">affects<");
    expect(svg).toContain(">enforces<");
  });

  it("adds a node for a block target and an edge to it", () => {
    expect(svg).toContain('<g class="flo-kg-block" data-flo-block="catalog.flo#acceso" data-flo-uri="catalog.flo"><rect');
    expect(svg).toContain(">Acceso<");
    expect(svg).toContain(
      'data-flo-from="pkce" data-flo-to="catalog.flo#acceso" data-flo-type="visualized_by" data-flo-block="catalog.flo#acceso"'
    );
    expect(svg).toContain(">visualized_by<");
  });

  it("draws flow edges without a label", () => {
    const deeper = renderKnowledge(link, query(link, { where: { text: "" }, depth: 2 }));
    expect(deeper).toContain('data-flo-from="api" data-flo-to="db" data-flo-type="flow"');
    expect(deeper).not.toContain(">flow<");
  });

  it("escapes titles", () => {
    expect(svg).toContain(">Regla &lt;1&gt; &amp; &quot;b&quot;<");
    expect(svg).not.toContain("<1>");
  });

  it("gives an empty svg for an empty result", () => {
    const empty = renderKnowledge(link, { nodes: [], edges: [] });
    expect(empty).toContain('width="0"');
    expect(empty).not.toContain("<g");
  });
});
```

Y en `packages/core/src/index.test.ts`, sumar `renderKnowledge` y
`MEMORY_FILL` al import de `./index.js` y un caso al final del `describe`:

```ts
  it("exposes renderKnowledge", () => {
    const workspace = new Workspace();
    workspace.setDocument("knowledge.schema.yaml", "type_tags: []\nrelation_types: []\n");
    workspace.setDocument("n.md", "---\nid: n\ntitle: N\nmemory_type: working\n---\n");
    const link = workspace.link();
    expect(renderKnowledge(link, query(link))).toContain(`fill="${MEMORY_FILL.working}"`);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @flo/core exec vitest run src/render/knowledge.test.ts src/index.test.ts`
Expected: FAIL — no existe `./knowledge.js` / `renderKnowledge` no está exportado.

- [ ] **Step 3: Make `shapeElement` reusable**

En `packages/core/src/render/flowchart.ts`, reemplazar `shapeElement` por
la versión exportada y actualizar su única llamada. Los bytes de salida del
flowchart no cambian (los snapshots de referencia lo verifican):

```ts
/** La forma de un nodo; `fill` lo cambia la vista de grafo (decisión #44). */
export function shapeElement(
  node: Pick<FlowchartNodeLayout, "x" | "y" | "width" | "height" | "shape">,
  dashed = false,
  fill = FILL_COLOR
): string {
  const { x, y, width, height } = node;
  const left = x - width / 2;
  const top = y - height / 2;
  const dash = dashed ? UNRESOLVED_DASH : "";

  if (node.shape === "decision") {
    const points = [
      `${x},${top}`,
      `${x + width / 2},${y}`,
      `${x},${top + height}`,
      `${x - width / 2},${y}`,
    ].join(" ");
    return `<polygon points="${points}" fill="${fill}" stroke="${STROKE_COLOR}" stroke-width="2"${dash} />`;
  }

  const rx = node.shape === "rounded" ? 12 : 0;
  return `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${STROKE_COLOR}" stroke-width="2"${dash} />`;
}
```

y en `renderFlowchartToSvg`: `${shapeElement(node, !node.resolved)}`.

- [ ] **Step 4: Write `renderKnowledge`**

`packages/core/src/render/knowledge.ts`:

```ts
import dagre from "dagre";
import type { MemoryType, NodeShape } from "../ast.js";
import { measureFlowchartNode } from "../layout/flowchart.js";
import type { QueryResult } from "../workspace/query.js";
import type { LinkResult } from "../workspace/workspace.js";
import type { BlockId } from "../workspace/xref.js";
import { shapeElement } from "./flowchart.js";
import {
  ARROW_MARKER_ID,
  FILL_COLOR,
  STROKE_COLOR,
  arrowMarkerDefs,
  dataAttributes,
  svgLabel,
  svgText,
} from "./svg.js";

/** Relleno por tipo de memoria (decisión #44): inline, así el SVG exportado conserva el color. */
export const MEMORY_FILL: Record<MemoryType, string> = {
  working: "#fef3c7",
  short_term: "#e0e7ff",
  long_term: "#dcfce7",
};

const GRAPH_OPTIONS = { rankdir: "TB", nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 };

interface GraphNode {
  id: string; // EntityId o BlockId: un BlockId lleva '#', así que no chocan
  label: string;
  shape: NodeShape;
  fill: string;
  className: string | null;
  data: Record<string, string>;
}

interface GraphEdge {
  from: string;
  to: string;
  type: string;
  data: Record<string, string>;
}

const uriOf = (id: BlockId) => id.slice(0, id.lastIndexOf("#"));

function blockTitle(link: LinkResult, id: BlockId): string {
  const name = id.slice(id.lastIndexOf("#") + 1);
  const block = link.documents.get(uriOf(id))?.document.blocks.find((candidate) => candidate.name === name);
  return block?.title ?? name;
}

/**
 * Los nodos y aristas a dibujar: los del resultado, y los bloques destino
 * de las relaciones a bloque de esos nodos (#32 los deja fuera de `query`).
 * Las aristas se deduplican por `from|to|type` (pendiente de K2).
 */
function graphOf(link: LinkResult, result: QueryResult): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (edge: GraphEdge) => {
    const key = `${edge.from}\n${edge.to}\n${edge.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(edge);
  };

  for (const node of result.nodes) {
    const memory = node.memoryType;
    nodes.push({
      id: node.id,
      label: node.title,
      shape: link.entities.get(node.id)?.shape ?? "rectangle",
      fill: memory ? MEMORY_FILL[memory] : FILL_COLOR,
      className: memory ? `flo-mem-${memory}` : null,
      data: { entity: node.id, uri: node.uri },
    });
  }
  for (const { from, to, type } of result.edges) addEdge({ from, to, type, data: { from, to, type } });

  const blocks = new Set<BlockId>();
  for (const node of result.nodes) {
    for (const relation of link.xref.relationsFrom(node.id)) {
      if (relation.resolved?.kind !== "block") continue;
      const block = relation.resolved.id;
      if (!blocks.has(block)) {
        blocks.add(block);
        nodes.push({
          id: block,
          label: blockTitle(link, block),
          shape: "rounded",
          fill: FILL_COLOR,
          className: "flo-kg-block",
          data: { block, uri: uriOf(block) },
        });
      }
      addEdge({
        from: node.id,
        to: block,
        type: relation.type,
        data: { from: node.id, to: block, type: relation.type, block },
      });
    }
  }
  return { nodes, edges };
}

const finiteOrZero = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Vista de grafo de conocimiento (spec de conocimiento §7, decisión #44). */
export function renderKnowledge(link: LinkResult, result: QueryResult): string {
  const { nodes, edges } = graphOf(link, result);
  // Multigrafo: dos tipos de relación entre el mismo par son dos aristas.
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ ...GRAPH_OPTIONS });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) graph.setNode(node.id, measureFlowchartNode(node.shape, node.label));
  edges.forEach((edge, index) => graph.setEdge(edge.from, edge.to, {}, String(index)));
  dagre.layout(graph);

  const nodeElements = nodes.map((node) => {
    const { x, y, width, height } = graph.node(node.id);
    const shape = shapeElement({ x, y, width, height, shape: node.shape }, false, node.fill);
    const className = node.className ? ` class="${node.className}"` : "";
    return `<g${className}${dataAttributes(node.data)}>${shape}${svgText(x, y, node.label)}</g>`;
  });
  const edgeElements = edges.map((edge, index) => {
    const points = graph.edge({ v: edge.from, w: edge.to, name: String(index) }).points;
    const line = `<polyline points="${points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${STROKE_COLOR}" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})"${dataAttributes(edge.data)} />`;
    if (edge.type === "flow") return line;
    const mid = points[Math.floor(points.length / 2)];
    return `${line}${svgLabel(mid.x, mid.y - 8, edge.type)}`;
  });

  const size = graph.graph();
  const width = finiteOrZero(size.width);
  const height = finiteOrZero(size.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${arrowMarkerDefs()}${nodeElements.join("")}${edgeElements.join("")}</svg>`;
}
```

En `packages/core/src/index.ts`, debajo de `renderMap`:

```ts
export { renderKnowledge, MEMORY_FILL } from "./render/knowledge.js";
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @flo/core exec vitest run`
Expected: PASS, con `1 snapshot written` para `knowledge.test.ts` y
**ningún** snapshot actualizado en `reference-diagrams.test.ts.snap`
(`git status` muestra solo el `.snap` nuevo). Si la fixture da
diagnósticos, corregir la fixture (no el código) hasta que el primer test
pase, y revisar a ojo que el `.snap` escrito tenga los tres nodos de
entidad, el de bloque y las cinco aristas.

- [ ] **Step 6: Typecheck y build**

Run: `pnpm --filter @flo/core typecheck && pnpm --filter @flo/core build`
Expected: sin errores; `packages/core/dist/index.d.ts` exporta `renderKnowledge` y `MEMORY_FILL`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/render/knowledge.ts packages/core/src/render/knowledge.test.ts packages/core/src/render/__snapshots__/knowledge.test.ts.snap packages/core/src/render/flowchart.ts packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): renderKnowledge, el grafo de conocimiento como SVG"
```

---

### Task 2: Pan/zoom por `viewBox`

**Files:**
- Create: `packages/web/src/pan-zoom.ts`
- Create: `packages/web/src/pan-zoom.test.ts`

**Interfaces:**
- Produces:
  - `type ViewBox = [number, number, number, number]` (x, y, ancho, alto).
  - `parseViewBox(value: string | null): ViewBox | null`.
  - `zoomViewBox(viewBox: ViewBox, factor: number, px: number, py: number): ViewBox` — `factor > 1` acerca; el punto `(px, py)` (unidades del SVG) queda quieto.
  - `panViewBox(viewBox: ViewBox, dx: number, dy: number): ViewBox` — `dx`/`dy` en unidades del SVG; arrastrar a la derecha mueve el contenido a la derecha (x baja).
  - `bindPanZoom(svg: SVGSVGElement, onChange: (viewBox: ViewBox) => void): void`.

- [ ] **Step 1: Write the failing test**

`packages/web/src/pan-zoom.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { bindPanZoom, panViewBox, parseViewBox, zoomViewBox } from "./pan-zoom.js";

describe("viewBox math", () => {
  it("parses a viewBox attribute", () => {
    expect(parseViewBox("0 0 100 50")).toEqual([0, 0, 100, 50]);
    expect(parseViewBox(null)).toBeNull();
    expect(parseViewBox("0 0 x 1")).toBeNull();
  });

  it("zooms around a point that stays still", () => {
    expect(zoomViewBox([0, 0, 100, 50], 2, 50, 25)).toEqual([25, 12.5, 50, 25]);
    expect(zoomViewBox([0, 0, 100, 50], 0.5, 0, 0)).toEqual([0, 0, 200, 100]);
  });

  it("pans against the drag direction", () => {
    expect(panViewBox([10, 10, 100, 50], 5, -5)).toEqual([5, 15, 100, 50]);
  });
});

function setup() {
  const parent = document.createElement("div");
  parent.innerHTML = '<svg viewBox="0 0 100 50"><g data-flo-entity="a"><rect /></g></svg>';
  document.body.appendChild(parent);
  const svg = parent.querySelector("svg")!;
  const onChange = vi.fn();
  bindPanZoom(svg, onChange);
  const parentClick = vi.fn();
  parent.addEventListener("click", parentClick);
  return { svg, onChange, parentClick, node: svg.querySelector("rect")! };
}

const mouse = (target: Element, type: string, x: number, y = 0) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));

describe("bindPanZoom", () => {
  it("zooms in with the wheel (jsdom has no layout: 1 px = 1 unit)", () => {
    const { svg, onChange } = setup();
    svg.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100, clientX: 0, clientY: 0 }));
    const expected = zoomViewBox([0, 0, 100, 50], 1.1, 0, 0);
    expect(parseViewBox(svg.getAttribute("viewBox"))).toEqual(expected);
    expect(onChange).toHaveBeenLastCalledWith(expected);
  });

  it("pans while dragging with the main button", () => {
    const { svg, onChange } = setup();
    mouse(svg, "mousedown", 10);
    mouse(svg, "mousemove", 30, 10);
    mouse(svg, "mouseup", 30, 10);
    expect(svg.getAttribute("viewBox")).toBe("-20 -10 100 50");
    expect(onChange).toHaveBeenLastCalledWith([-20, -10, 100, 50]);
  });

  it("swallows the click that ends a drag, but not a still click", () => {
    const { svg, parentClick, node } = setup();
    mouse(node, "mousedown", 0);
    mouse(svg, "mousemove", 10);
    mouse(node, "mouseup", 10);
    mouse(node, "click", 10);
    expect(parentClick).not.toHaveBeenCalled();
    mouse(node, "mousedown", 10);
    mouse(node, "mouseup", 11);
    mouse(node, "click", 11);
    expect(parentClick).toHaveBeenCalledTimes(1);
  });

  it("ignores moves without a pressed button", () => {
    const { svg, onChange } = setup();
    mouse(svg, "mousemove", 30);
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @flo/web exec vitest run src/pan-zoom.test.ts`
Expected: FAIL — no existe `./pan-zoom.js`.

- [ ] **Step 3: Write the implementation**

`packages/web/src/pan-zoom.ts`:

```ts
/** x, y, ancho y alto del `viewBox` de un SVG. */
export type ViewBox = [number, number, number, number];

const ZOOM_STEP = 1.1;
// Un arrastre más corto que esto es un click (decisión #45).
const DRAG_THRESHOLD = 3;

export function parseViewBox(value: string | null): ViewBox | null {
  const parts = value?.trim().split(/[\s,]+/).map(Number) ?? [];
  return parts.length === 4 && parts.every(Number.isFinite) ? (parts as ViewBox) : null;
}

/** `factor > 1` acerca; el punto `(px, py)`, en unidades del SVG, queda quieto. */
export function zoomViewBox([x, y, width, height]: ViewBox, factor: number, px: number, py: number): ViewBox {
  return [px - (px - x) / factor, py - (py - y) / factor, width / factor, height / factor];
}

/** Desplaza el contenido `(dx, dy)` unidades del SVG, en el sentido del arrastre. */
export function panViewBox([x, y, width, height]: ViewBox, dx: number, dy: number): ViewBox {
  return [x - dx, y - dy, width, height];
}

/** Rueda = zoom alrededor del puntero; arrastre con el botón principal = desplazar (spec de conocimiento §7). */
export function bindPanZoom(svg: SVGSVGElement, onChange: (viewBox: ViewBox) => void): void {
  const current = () => parseViewBox(svg.getAttribute("viewBox")) ?? [0, 0, 0, 0];
  const set = (viewBox: ViewBox) => {
    svg.setAttribute("viewBox", viewBox.join(" "));
    onChange(viewBox);
  };
  // Unidades del SVG por px de pantalla; sin tamaño (jsdom, SVG oculto) se toma 1:1.
  const scale = () => {
    const width = svg.getBoundingClientRect().width;
    return width > 0 ? current()[2] / width : 1;
  };

  svg.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const viewBox = current();
      const s = scale();
      const px = viewBox[0] + (event.clientX - rect.left) * s;
      const py = viewBox[1] + (event.clientY - rect.top) * s;
      set(zoomViewBox(viewBox, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, px, py));
    },
    { passive: false }
  );

  let last: { x: number; y: number } | null = null;
  let travelled = 0;
  svg.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    last = { x: event.clientX, y: event.clientY };
    travelled = 0;
  });
  svg.addEventListener("mousemove", (event) => {
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    last = { x: event.clientX, y: event.clientY };
    travelled += Math.abs(dx) + Math.abs(dy);
    const s = scale();
    set(panViewBox(current(), dx * s, dy * s));
  });
  const end = () => (last = null);
  svg.addEventListener("mouseup", end);
  svg.addEventListener("mouseleave", end);
  // Captura en el SVG: el click que cierra un arrastre no llega al preview (drill-down).
  svg.addEventListener(
    "click",
    (event) => {
      if (travelled > DRAG_THRESHOLD) event.stopPropagation();
      travelled = 0;
    },
    true
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @flo/web exec vitest run src/pan-zoom.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pan-zoom.ts packages/web/src/pan-zoom.test.ts
git commit -m "feat(web): pan y zoom de un SVG por su viewBox"
```

---

### Task 3: Estado, barra de filtros y HTML de la vista de grafo

**Files:**
- Create: `packages/web/src/knowledge-view.ts`
- Create: `packages/web/src/knowledge-view.test.ts`

**Interfaces:**
- Consumes: `ViewBox` (task 2); `escapeXml`, `MEMORY_FILL`, `EntityId`,
  `LinkResult`, `MemoryType`, `TagCatalog`, `Where` de `@flo/core` (task 1).
- Produces:
  - `interface GraphQuery { where: Where; from: EntityId[] | null; depth: number; viewBox: ViewBox | null }`.
  - `interface GraphFilter { memory: MemoryType | null; typeTag: string | null; contextTag: string | null; text: string }`.
  - `DEFAULT_GRAPH: GraphQuery` = `{ where: { and: [{ text: "" }] }, from: null, depth: 1, viewBox: null }`. Nunca se muta: se reemplaza.
  - `whereOf(filter: GraphFilter): Where`, `filterOf(where: Where): GraphFilter | null`.
  - `readBar(root: ParentNode): { filter: GraphFilter; depth: number }`.
  - `graphBarHtml(link: LinkResult, tags: TagCatalog, graph: GraphQuery, presets: string[] | null): string` — controles con `data-flo-kg="memory|typeTag|contextTag|text|depth|preset"`, botones `data-flo-kg-clear-from` y `data-flo-kg-save`, leyenda `.flo-kg-legend`.
  - `graphHtml(svg: string, empty: boolean): string` — `<section class="flo-block flo-kg">`.

- [ ] **Step 1: Write the failing test**

`packages/web/src/knowledge-view.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MEMORY_FILL, Workspace, tagCatalog } from "@flo/core";
import { DEFAULT_GRAPH, filterOf, graphBarHtml, graphHtml, readBar, whereOf, type GraphFilter } from "./knowledge-view.js";

const EMPTY: GraphFilter = { memory: null, typeTag: null, contextTag: null, text: "" };

function linkOf(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

const link = linkOf({
  "knowledge.schema.yaml": "type_tags: [decision]\nrelation_types: []\n",
  "n.md": '---\nid: n\ntitle: "Nota <1>"\nmemory_type: working\ntype_tags: [decision]\ncontext_tags: ["project:\\"x\\""]\n---\n',
});

describe("whereOf / filterOf", () => {
  it("always seeds from knowledge entities with a base text predicate", () => {
    expect(whereOf(EMPTY)).toEqual({ and: [{ text: "" }] });
    expect(DEFAULT_GRAPH.where).toEqual(whereOf(EMPTY));
  });

  it("adds one predicate per chosen control and reads it back", () => {
    const filter: GraphFilter = { memory: "working", typeTag: "decision", contextTag: "project:", text: "pkce" };
    const where = whereOf(filter);
    expect(where).toEqual({ and: [{ text: "pkce" }, { memory: "working" }, { typeTag: "decision" }, { contextTag: "project:" }] });
    expect(filterOf(where)).toEqual(filter);
  });

  it("does not read a where the bar could not have built", () => {
    expect(filterOf({ memory: "working" })).toBeNull();
    expect(filterOf({ and: [{ memory: "working" }] })).toBeNull(); // sin texto base
    expect(filterOf({ and: [{ text: "" }, { or: [] }] })).toBeNull();
    expect(filterOf({ and: [{ text: "" }, { memory: "working" }, { memory: "long_term" }] })).toBeNull();
  });
});

describe("graphBarHtml", () => {
  const bar = (graph = DEFAULT_GRAPH, presets: string[] | null = null) => {
    const div = document.createElement("div");
    div.innerHTML = graphBarHtml(link, tagCatalog(link), graph, presets);
    return div;
  };

  it("offers the memory types, tags in use and depths, and reads them back", () => {
    const div = bar({ ...DEFAULT_GRAPH, where: whereOf({ ...EMPTY, typeTag: "decision", text: 'a "b"' }), depth: 2 });
    expect([...div.querySelectorAll('[data-flo-kg="memory"] option')].map((o) => o.getAttribute("value"))).toEqual([
      "",
      "working",
      "short_term",
      "long_term",
    ]);
    expect(readBar(div)).toEqual({ filter: { ...EMPTY, typeTag: "decision", text: 'a "b"' }, depth: 2 });
    expect(div.querySelector<HTMLSelectElement>('[data-flo-kg="contextTag"]')!.options[1].value).toBe('project:"x"');
  });

  it("keeps a selected value that is no longer in use", () => {
    const div = bar({ ...DEFAULT_GRAPH, where: whereOf({ ...EMPTY, typeTag: "borrado" }) });
    expect(readBar(div).filter.typeTag).toBe("borrado");
  });

  it("says when the where comes from a view the bar cannot show", () => {
    expect(bar({ ...DEFAULT_GRAPH, where: { or: [] } }).textContent).toContain("Filtro de la vista");
    expect(bar().textContent).not.toContain("Filtro de la vista");
  });

  it("shows the seeds with a button to clear them", () => {
    const div = bar({ ...DEFAULT_GRAPH, from: ["n", "fantasma"] });
    expect(div.querySelector("[data-flo-kg-clear-from]")!.textContent).toBe("Centrado en Nota <1>, fantasma ×");
    expect(bar().querySelector("[data-flo-kg-clear-from]")).toBeNull();
  });

  it("offers views only when presets are available", () => {
    expect(bar().querySelector('[data-flo-kg="preset"]')).toBeNull();
    const div = bar(DEFAULT_GRAPH, ["a", "b"]);
    expect([...div.querySelectorAll('[data-flo-kg="preset"] option')].map((o) => o.textContent)).toEqual(["Vistas", "a", "b"]);
    expect(div.querySelector("[data-flo-kg-save]")).not.toBeNull();
  });

  it("has a legend with the memory colors", () => {
    expect(bar().querySelector(".flo-kg-legend")!.innerHTML).toContain(MEMORY_FILL.long_term);
  });
});

describe("graphHtml", () => {
  it("wraps the svg, or says nothing matched", () => {
    expect(graphHtml("<svg></svg>", false)).toContain('<section class="flo-block flo-kg">');
    expect(graphHtml("<svg></svg>", true)).toContain("Ninguna nota coincide con el filtro");
    expect(graphHtml("<svg></svg>", true)).not.toContain("<svg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @flo/web exec vitest run src/knowledge-view.test.ts`
Expected: FAIL — no existe `./knowledge-view.js`.

- [ ] **Step 3: Write the implementation**

`packages/web/src/knowledge-view.ts`:

```ts
import { MEMORY_FILL, escapeXml, type EntityId, type LinkResult, type MemoryType, type TagCatalog, type Where } from "@flo/core";
import type { ViewBox } from "./pan-zoom.js";

/** Lo que muestra la vista de grafo (decisión #45); un preset es esto con nombre (#46). */
export interface GraphQuery {
  where: Where;
  from: EntityId[] | null;
  depth: number;
  viewBox: ViewBox | null;
}

/** Lo que la barra sabe armar. */
export interface GraphFilter {
  memory: MemoryType | null;
  typeTag: string | null;
  contextTag: string | null;
  text: string;
}

const MEMORY_TYPES = Object.keys(MEMORY_FILL) as MemoryType[];
const DEPTHS = [0, 1, 2, 3];

// `{ text: "" }` lo cumple toda entidad de `.md` y ninguna `.flo` (#31): las
// semillas son notas y las entidades `.flo` entran por expansión.
export const DEFAULT_GRAPH: GraphQuery = { where: { and: [{ text: "" }] }, from: null, depth: 1, viewBox: null };

export function whereOf(filter: GraphFilter): Where {
  const parts: Where[] = [{ text: filter.text }];
  if (filter.memory) parts.push({ memory: filter.memory });
  if (filter.typeTag) parts.push({ typeTag: filter.typeTag });
  if (filter.contextTag) parts.push({ contextTag: filter.contextTag });
  return { and: parts };
}

/** La inversa de `whereOf`; null si el `where` no lo pudo armar la barra (un preset escrito a mano). */
export function filterOf(where: Where): GraphFilter | null {
  if (!("and" in where)) return null;
  const filter: GraphFilter = { memory: null, typeTag: null, contextTag: null, text: "" };
  let hasText = false;
  for (const part of where.and) {
    if ("text" in part && !hasText) {
      filter.text = part.text;
      hasText = true;
    } else if ("memory" in part && filter.memory === null) filter.memory = part.memory;
    else if ("typeTag" in part && filter.typeTag === null) filter.typeTag = part.typeTag;
    else if ("contextTag" in part && filter.contextTag === null) filter.contextTag = part.contextTag;
    else return null;
  }
  return hasText ? filter : null;
}

export function readBar(root: ParentNode): { filter: GraphFilter; depth: number } {
  const value = (name: string) =>
    root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-flo-kg="${name}"]`)?.value ?? "";
  return {
    filter: {
      memory: (value("memory") || null) as MemoryType | null,
      typeTag: value("typeTag") || null,
      contextTag: value("contextTag") || null,
      text: value("text"),
    },
    depth: Number(value("depth")) || 0,
  };
}

/** Opciones de un select; un valor elegido que ya no está en uso se conserva (lo pidió una vista). */
function options(values: string[], selected: string | null, all: string): string {
  const list = selected !== null && !values.includes(selected) ? [...values, selected] : values;
  const items = list.map(
    (value) => `<option value="${escapeXml(value)}"${value === selected ? " selected" : ""}>${escapeXml(value)}</option>`
  );
  return `<option value="">${all}</option>${items.join("")}`;
}

function legendHtml(): string {
  const items = MEMORY_TYPES.map(
    (type) => `<span><i class="flo-kg-swatch" style="background:${MEMORY_FILL[type]}"></i>${type}</span>`
  );
  return `<span class="flo-kg-legend">${items.join("")}</span>`;
}

/** La barra de la vista de grafo: filtros, semillas, vistas guardadas y leyenda. */
export function graphBarHtml(link: LinkResult, tags: TagCatalog, graph: GraphQuery, presets: string[] | null): string {
  const filter = filterOf(graph.where);
  const shown = filter ?? { memory: null, typeTag: null, contextTag: null, text: "" };
  const depths = [...new Set([...DEPTHS, graph.depth])].sort((a, b) => a - b);
  const parts = [
    `<select data-flo-kg="memory">${options(MEMORY_TYPES, shown.memory, "Toda la memoria")}</select>`,
    `<select data-flo-kg="typeTag">${options(tags.typeTags, shown.typeTag, "Todos los tipos")}</select>`,
    `<select data-flo-kg="contextTag">${options(tags.contextTags, shown.contextTag, "Todo contexto")}</select>`,
    `<input type="search" data-flo-kg="text" placeholder="Buscar" value="${escapeXml(shown.text)}">`,
    `<label>Profundidad <select data-flo-kg="depth">${depths
      .map((depth) => `<option value="${depth}"${depth === graph.depth ? " selected" : ""}>${depth}</option>`)
      .join("")}</select></label>`,
  ];
  if (!filter) parts.push('<span class="flo-kg-note">Filtro de la vista</span>');
  if (graph.from) {
    const labels = graph.from.map((id) => link.entities.get(id)?.label ?? id).join(", ");
    parts.push(`<button type="button" data-flo-kg-clear-from>Centrado en ${escapeXml(labels)} ×</button>`);
  }
  if (presets) {
    parts.push(
      `<select data-flo-kg="preset">${options(presets, null, "Vistas")}</select>`,
      '<button type="button" data-flo-kg-save>Guardar vista</button>'
    );
  }
  parts.push(legendHtml());
  return parts.join("");
}

export function graphHtml(svg: string, empty: boolean): string {
  const body = empty ? '<p class="flo-empty">Ninguna nota coincide con el filtro</p>' : svg;
  return `<section class="flo-block flo-kg"><h2 class="flo-block-title">Grafo de conocimiento</h2>${body}</section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @flo/web exec vitest run src/knowledge-view.test.ts`
Expected: PASS. (Si falla por `MEMORY_FILL` indefinido, falta `pnpm --filter @flo/core build`.)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/knowledge-view.ts packages/web/src/knowledge-view.test.ts
git commit -m "feat(web): barra de filtros y HTML de la vista de grafo"
```

---

### Task 4: Presets en `.flo/views` y permiso de lectura

**Files:**
- Create: `packages/web/src/presets.ts`
- Create: `packages/web/src/presets.test.ts`
- Create: `packages/web/src/test-dir.ts`
- Modify: `packages/web/src/folder-io.ts` (`ensureWritable` → `ensurePermission`)
- Modify: `packages/web/src/folder-io.test.ts`
- Modify: `packages/web/src/app.ts:22,218` (la llamada de `save`)

**Interfaces:**
- Consumes: `GraphQuery` (task 3), `ViewBox` (task 2), `writeWorkspaceFile` (`folder-io.ts`), `readFileAsText` (`file-io.ts`), `Where` de `@flo/core`.
- Produces:
  - `interface Preset extends GraphQuery { name: string }`.
  - `PRESETS_DIR = ".flo/views"`.
  - `isPresetName(name: string): boolean` — `/^[A-Za-z0-9_-]+$/`.
  - `isWhere(value: unknown): value is Where` — estricto, como el esquema `zod` de MCP.
  - `parsePreset(name: string, text: string): Preset | null`.
  - `byName(a: Preset, b: Preset): number`.
  - `listPresets(dir: FileSystemDirectoryHandle): Promise<Preset[]>`.
  - `savePreset(dir: FileSystemDirectoryHandle, preset: Preset): Promise<void>`.
  - `ensurePermission(dir: FileSystemDirectoryHandle, mode: "read" | "readwrite"): Promise<boolean>` (reemplaza `ensureWritable`).
  - `memoryDir(tree: MemoryTree, name?: string): FileSystemDirectoryHandle` y `type MemoryTree = { [name: string]: string | MemoryTree }` en `test-dir.ts`: `getDirectoryHandle`/`getFileHandle` con `{ create }`, `values()`, `getFile()` y `createWritable()`; lo escrito queda en `tree`; lo que no existe lanza `DOMException` `NotFoundError`.

- [ ] **Step 1: Write the test helper**

`packages/web/src/test-dir.ts` (no es un test: lo importan los tests de
presets y de `App`; `main.ts` no lo importa, así que no entra al build):

```ts
export type MemoryTree = { [name: string]: string | MemoryTree };

/** Carpeta en memoria con la forma de File System Access que usa la web; lo escrito queda en `tree`. Solo tests. */
export function memoryDir(tree: MemoryTree, name = ""): FileSystemDirectoryHandle {
  const fail = (child: string, kind: string) => new DOMException(`'${child}': ${kind}`, kind);
  const fileHandle = (child: string) => ({
    kind: "file",
    name: child,
    getFile: async () => new File([tree[child] as string], child),
    createWritable: async () => {
      let data = "";
      return {
        write: async (chunk: string) => {
          data += chunk;
        },
        close: async () => {
          tree[child] = data;
        },
      };
    },
  });
  return {
    kind: "directory",
    name,
    async *values() {
      for (const [child, value] of Object.entries(tree)) {
        yield typeof value === "string" ? fileHandle(child) : memoryDir(value, child);
      }
    },
    async getDirectoryHandle(child: string, options?: { create?: boolean }) {
      if (!(child in tree)) {
        if (!options?.create) throw fail(child, "NotFoundError");
        tree[child] = {};
      }
      const value = tree[child];
      if (typeof value === "string") throw fail(child, "TypeMismatchError");
      return memoryDir(value, child);
    },
    async getFileHandle(child: string, options?: { create?: boolean }) {
      if (!(child in tree)) {
        if (!options?.create) throw fail(child, "NotFoundError");
        tree[child] = "";
      }
      if (typeof tree[child] !== "string") throw fail(child, "TypeMismatchError");
      return fileHandle(child);
    },
  } as unknown as FileSystemDirectoryHandle;
}
```

- [ ] **Step 2: Write the failing tests**

`packages/web/src/presets.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { isPresetName, isWhere, listPresets, parsePreset, savePreset, type Preset } from "./presets.js";
import { memoryDir, type MemoryTree } from "./test-dir.js";

afterEach(() => vi.restoreAllMocks());

const PRESET: Preset = {
  name: "decisiones",
  where: { and: [{ text: "" }, { typeTag: "decision" }] },
  from: null,
  depth: 1,
  viewBox: [0, 0, 400, 300],
};

describe("isPresetName", () => {
  it("accepts letters, digits, '-' and '_' only", () => {
    expect(isPresetName("mis-vistas_2")).toBe(true);
    for (const bad of ["", "../x", "a/b", "a b", "a.json", "ñandú"]) expect(isPresetName(bad), bad).toBe(false);
  });
});

describe("isWhere", () => {
  it("accepts every Where shape", () => {
    const where = {
      and: [
        { or: [{ memory: "working" }, { not: { typeTag: "x" } }] },
        { contextTag: "project:" },
        { custom: "status" },
        { custom: "level", equals: 3 },
        { text: "a" },
      ],
    };
    expect(isWhere(where)).toBe(true);
  });

  it("rejects unknown keys, wrong types and bad memory types", () => {
    for (const bad of [
      {},
      { type_tag: "x" },
      { text: 1 },
      { and: {} },
      { memory: "forever" },
      { text: "a", extra: 1 },
      { custom: "a", equals: null },
      { equals: 1, other: 2 },
      null,
      [],
    ]) {
      expect(isWhere(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("parsePreset", () => {
  it("reads a valid preset and takes its name from the file", () => {
    expect(parsePreset("decisiones", JSON.stringify({ ...PRESET, name: "otro" }))).toEqual(PRESET);
    expect(parsePreset("x", JSON.stringify({ where: { text: "" }, depth: 0 }))).toEqual({
      name: "x",
      where: { text: "" },
      from: null,
      depth: 0,
      viewBox: null,
    });
  });

  it("rejects broken JSON and wrong shapes", () => {
    const ok = { where: { text: "" }, depth: 1 };
    for (const bad of [
      "no es json",
      "[]",
      JSON.stringify({ ...ok, where: { type_tag: "x" } }),
      JSON.stringify({ ...ok, depth: -1 }),
      JSON.stringify({ ...ok, depth: 1.5 }),
      JSON.stringify({ ...ok, from: "a" }),
      JSON.stringify({ ...ok, from: [1] }),
      JSON.stringify({ ...ok, viewBox: [0, 0, 0, 10] }),
      JSON.stringify({ ...ok, viewBox: [0, 0, 10] }),
    ]) {
      expect(parsePreset("x", bad), bad).toBeNull();
    }
  });
});

describe("listPresets / savePreset", () => {
  it("gives no presets when the folder has no .flo/views", async () => {
    expect(await listPresets(memoryDir({}))).toEqual([]);
    expect(await listPresets(memoryDir({ ".flo": "un archivo" }))).toEqual([]);
  });

  it("round-trips a saved preset as pretty JSON", async () => {
    const tree: MemoryTree = {};
    await savePreset(memoryDir(tree), PRESET);
    const written = ((tree[".flo"] as MemoryTree).views as MemoryTree)["decisiones.json"];
    expect(written).toBe(`${JSON.stringify(PRESET, null, 2)}\n`);
    expect(await listPresets(memoryDir(tree))).toEqual([PRESET]);
  });

  it("lists valid presets by name and skips the rest with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const valid = (name: string) => JSON.stringify({ ...PRESET, name });
    const tree: MemoryTree = {
      ".flo": {
        views: {
          "b.json": valid("b"),
          "a.json": valid("a"),
          "roto.json": "{",
          "con espacio.json": valid("con espacio"),
          "notas.txt": "no es una vista",
          sub: { "c.json": valid("c") },
        },
      },
    };
    expect((await listPresets(memoryDir(tree))).map((preset) => preset.name)).toEqual(["a", "b"]);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
```

En `packages/web/src/folder-io.test.ts`, cambiar el import de
`ensureWritable` por `ensurePermission` y reemplazar el
`describe("ensureWritable", ...)` por:

```ts
describe("ensurePermission", () => {
  it("asks for the requested mode only when it is not granted yet", async () => {
    const granted = { queryPermission: vi.fn().mockResolvedValue("granted"), requestPermission: vi.fn() };
    expect(await ensurePermission(granted as unknown as FileSystemDirectoryHandle, "read")).toBe(true);
    expect(granted.queryPermission).toHaveBeenCalledWith({ mode: "read" });
    expect(granted.requestPermission).not.toHaveBeenCalled();
    const denied = { queryPermission: vi.fn().mockResolvedValue("prompt"), requestPermission: vi.fn().mockResolvedValue("denied") };
    expect(await ensurePermission(denied as unknown as FileSystemDirectoryHandle, "readwrite")).toBe(false);
    expect(denied.requestPermission).toHaveBeenCalledWith({ mode: "readwrite" });
  });

  it("assumes permission when the browser has no permission API", async () => {
    expect(await ensurePermission({} as FileSystemDirectoryHandle, "readwrite")).toBe(true);
  });
});
```

(Si el `describe` actual tiene casos que este no cubre, conservarlos con el
nuevo nombre y `"readwrite"`.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/presets.test.ts src/folder-io.test.ts`
Expected: FAIL — no existe `./presets.js`; `ensurePermission` no está exportada.

- [ ] **Step 4: Rename `ensureWritable`**

En `packages/web/src/folder-io.ts`:

```ts
/** Un handle restaurado del borrador pierde el permiso al recargar la página: se vuelve a pedir. */
export async function ensurePermission(dir: FileSystemDirectoryHandle, mode: "read" | "readwrite"): Promise<boolean> {
  if (!dir.queryPermission || !dir.requestPermission) return true;
  const descriptor = { mode };
  if ((await dir.queryPermission(descriptor)) === "granted") return true;
  return (await dir.requestPermission(descriptor)) === "granted";
}
```

En `packages/web/src/app.ts`, el import pasa a `ensurePermission` y
`save()` llama `ensurePermission(dir, "readwrite")`.

- [ ] **Step 5: Write `presets.ts`**

`packages/web/src/presets.ts`:

```ts
import type { Where } from "@flo/core";
import { readFileAsText } from "./file-io.js";
import { writeWorkspaceFile } from "./folder-io.js";
import type { GraphQuery } from "./knowledge-view.js";
import type { ViewBox } from "./pan-zoom.js";

/** Una vista guardada de la vista de grafo (spec de conocimiento §7, decisión #46). */
export interface Preset extends GraphQuery {
  name: string;
}

export const PRESETS_DIR = ".flo/views";

const NAME = /^[A-Za-z0-9_-]+$/;
const MEMORY = new Set(["working", "short_term", "long_term"]);
const SCALAR = new Set(["string", "number", "boolean"]);

export function isPresetName(name: string): boolean {
  return NAME.test(name);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `Where` estricto, como el esquema `zod` de MCP: una clave desconocida o un tipo incorrecto lo invalida. */
export function isWhere(value: unknown): value is Where {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 2) {
    return typeof value.custom === "string" && "equals" in value && SCALAR.has(typeof value.equals);
  }
  if (keys.length !== 1) return false;
  const inner = value[keys[0]];
  switch (keys[0]) {
    case "and":
    case "or":
      return Array.isArray(inner) && inner.every(isWhere);
    case "not":
      return isWhere(inner);
    case "memory":
      return typeof inner === "string" && MEMORY.has(inner);
    case "typeTag":
    case "contextTag":
    case "custom":
    case "text":
      return typeof inner === "string";
    default:
      return false;
  }
}

const isViewBox = (value: unknown): value is ViewBox =>
  Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && value[2] > 0 && value[3] > 0;

/** El contenido de `.flo/views/<name>.json`; null si no es JSON o no tiene la forma. Manda el nombre del archivo. */
export function parsePreset(name: string, text: string): Preset | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(value) || !isWhere(value.where)) return null;
  const { depth, from = null, viewBox = null } = value;
  if (typeof depth !== "number" || !Number.isInteger(depth) || depth < 0) return null;
  if (from !== null && !(Array.isArray(from) && from.every((id) => typeof id === "string"))) return null;
  if (viewBox !== null && !isViewBox(viewBox)) return null;
  return { name, where: value.where, from, depth, viewBox };
}

export const byName = (a: Preset, b: Preset) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

async function viewsDir(dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (await dir.getDirectoryHandle(".flo")).getDirectoryHandle("views");
  } catch (error) {
    // Sin `.flo/views` (o con un archivo con ese nombre) no hay vistas.
    if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "TypeMismatchError")) return null;
    throw error;
  }
}

/** Las vistas válidas de la carpeta, por nombre; las demás se saltan con un aviso. */
export async function listPresets(dir: FileSystemDirectoryHandle): Promise<Preset[]> {
  const views = await viewsDir(dir);
  if (!views) return [];
  const presets: Preset[] = [];
  for await (const handle of views.values()) {
    if (handle.kind !== "file" || !handle.name.endsWith(".json")) continue;
    const name = handle.name.slice(0, -".json".length);
    const preset = isPresetName(name)
      ? parsePreset(name, await readFileAsText(await (handle as FileSystemFileHandle).getFile()))
      : null;
    if (preset) presets.push(preset);
    else console.warn(`flo: se ignora la vista ${PRESETS_DIR}/${handle.name} (nombre o contenido inválido)`);
  }
  return presets.sort(byName);
}

export async function savePreset(dir: FileSystemDirectoryHandle, preset: Preset): Promise<void> {
  const { name, where, from, depth, viewBox } = preset;
  const json = JSON.stringify({ name, where, from, depth, viewBox }, null, 2);
  await writeWorkspaceFile(dir, `${PRESETS_DIR}/${name}.json`, `${json}\n`);
}
```

- [ ] **Step 6: Run the web tests and typecheck**

Run: `pnpm --filter @flo/web exec vitest run && pnpm --filter @flo/web typecheck`
Expected: PASS; sin errores de tipos (`Number.isFinite` acepta `unknown`
en `lib.es2015`; si el `tsconfig` de web no lo acepta, usar
`value.every((n) => typeof n === "number" && Number.isFinite(n))`).

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/presets.ts packages/web/src/presets.test.ts packages/web/src/test-dir.ts packages/web/src/folder-io.ts packages/web/src/folder-io.test.ts packages/web/src/app.ts
git commit -m "feat(web): presets de la vista de grafo en .flo/views"
```

---

### Task 5: `App` — modo "Grafo", filtros, drill-down y exportar

**Files:**
- Modify: `packages/web/src/toolbar.ts`, `packages/web/src/toolbar.test.ts`
- Modify: `packages/web/src/app.ts`
- Modify: `packages/web/src/app.test.ts`
- Modify: `packages/web/index.html` (estilos)

**Interfaces:**
- Consumes: `renderKnowledge`, `query`, `tagCatalog` de `@flo/core`
  (task 1); `bindPanZoom` (task 2); `DEFAULT_GRAPH`, `GraphQuery`,
  `graphBarHtml`, `graphHtml`, `readBar`, `whereOf` (task 3);
  `addEdgeHitAreas` (`map-view.ts`, ya existe).
- Produces:
  - `ToolbarActions.onToggleGraph(): void` y el botón `#flo-toggle-graph` ("Grafo", `aria-pressed`).
  - `App.toggleGraph(): void`; `App.graph: GraphQuery` (público, para tests; nunca se muta, se reemplaza).
  - `App` pasa de `mapMode: boolean` a `private mode: "document" | "map" | "graph"`; `toggleMap()` conserva su firma.
  - `private showGraph(graph: GraphQuery): void` — la usa la task 6 para cargar presets al entrar.

- [ ] **Step 1: Write the failing tests**

En `packages/web/src/toolbar.test.ts`, sumar `onToggleGraph: vi.fn()` a
`mockActions()` y, dentro de "wires each button to its action":

```ts
    container.querySelector<HTMLButtonElement>("#flo-toggle-graph")!.click();
    expect(actions.onToggleGraph).toHaveBeenCalledTimes(1);
```

En `packages/web/src/app.test.ts`, después de `FILES`, la fixture de
conocimiento y un `describe` nuevo (usa el helper `click` que ya existe en
el archivo; si `click` está definido dentro del `describe("App")`, moverlo
al nivel del módulo):

```ts
const KG_SOURCES: Record<string, string> = {
  "knowledge.schema.yaml": "type_tags: [decision, rule]\nrelation_types: [affects, enforces, visualized_by]\n",
  "catalog.flo": 'entity api [API]\nentity db\nflow acceso "Acceso" {\n  api -> db\n}\n',
  "login.flo": 'use "./catalog.flo"\nuse "./kb/pkce.md"\nflow login {\n  api -> pkce\n}\n',
  "kb/pkce.md": [
    "---",
    "id: pkce",
    "title: PKCE",
    "memory_type: long_term",
    "type_tags: [decision]",
    'context_tags: ["project:core"]',
    'use: ["../catalog.flo"]',
    "relations:",
    "  - target: api",
    "    type: affects",
    "  - target: ../catalog.flo#acceso",
    "    type: visualized_by",
    "  - target: rule.md",
    "    type: enforces",
    "---",
    "Texto de PKCE.",
    "",
  ].join("\n"),
  "kb/rule.md": "---\nid: rule\ntitle: Regla\nmemory_type: working\ntype_tags: [rule]\n---\nContraseñas largas.\n",
};

export const KG_FILES: WorkspaceSnapshot = { files: KG_SOURCES, saved: { ...KG_SOURCES }, active: "login.flo", dir: null };

const graphNodes = (el: AppElements) =>
  [...el.preview.querySelectorAll(".flo-kg g[data-flo-entity]")].map((g) => g.getAttribute("data-flo-entity"));

function change(root: ParentNode, name: string, value: string): void {
  const control = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-flo-kg="${name}"]`)!;
  control.value = value;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("App knowledge graph", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses a fixture without diagnostics", () => {
    const app = new App(elements(), KG_FILES);
    expect([...app.ws.link().diagnostics.values()].flat()).toEqual([]);
  });

  it("shows the notes and their neighbours, with the graph button pressed", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    expect(el.preview.querySelector(".flo-kg-bar")).not.toBeNull();
    expect(graphNodes(el)).toEqual(["pkce", "rule", "api"]);
    expect(el.preview.innerHTML).toContain('data-flo-block="catalog.flo#acceso"');
    expect(el.toolbar.querySelector("#flo-toggle-graph")!.getAttribute("aria-pressed")).toBe("true");
    expect(el.toolbar.querySelector("#flo-toggle-map")!.getAttribute("aria-pressed")).toBe("false");
    app.toggleGraph();
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
  });

  it("filters with the bar", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    change(el.preview, "memory", "working");
    change(el.preview, "depth", "0");
    expect(graphNodes(el)).toEqual(["rule"]);
    expect(app.graph).toEqual({ where: { and: [{ text: "" }, { memory: "working" }] }, from: null, depth: 0, viewBox: null });
    change(el.preview, "memory", "");
    change(el.preview, "text", "pkce");
    expect(graphNodes(el)).toEqual(["pkce"]);
  });

  it("says so when nothing matches, and exporting does not throw", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    change(el.preview, "text", "no existe");
    expect(el.preview.textContent).toContain("Ninguna nota coincide con el filtro");
    vi.mocked(exportSvg).mockClear();
    click(el.toolbar.querySelector("#flo-export-svg")!);
    expect(exportSvg).not.toHaveBeenCalled();
  });

  it("opens a note in the editor and stays in the graph", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    click(el.preview.querySelector('.flo-kg g[data-flo-entity="rule"] text')!);
    expect(app.ws.active).toBe("kb/rule.md");
    expect(app.view.state.doc.toString()).toBe(KG_SOURCES["kb/rule.md"]);
    expect(el.preview.querySelector(".flo-kg")).not.toBeNull();
  });

  it("opens the entity panel for a .flo entity", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    click(el.preview.querySelector('.flo-kg g[data-flo-entity="api"] text')!);
    expect(el.panel.innerHTML).toContain("<code>api</code>");
  });

  it("opens the flow of a visualized_by edge, highlighting its source when present", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    click(el.preview.querySelector('polyline.flo-map-hit[data-flo-type="visualized_by"]')!);
    expect(app.ws.active).toBe("catalog.flo");
    expect(app.selectedBlock).toBe("catalog.flo#acceso");
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
    expect(el.toolbar.querySelector("#flo-toggle-graph")!.getAttribute("aria-pressed")).toBe("false");
  });

  it("opens the flow from its block node", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    click(el.preview.querySelector('.flo-kg g[data-flo-block="catalog.flo#acceso"] text')!);
    expect(app.selectedBlock).toBe("catalog.flo#acceso");
  });

  it("centers the graph on a note clicked in a flow, until cleared", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    click(el.preview.querySelector('[data-flo-entity="pkce"] text')!);
    expect(app.graph.from).toEqual(["pkce"]);
    expect(graphNodes(el)).toEqual(["pkce", "api", "rule"]);
    expect(el.preview.querySelector("[data-flo-kg-clear-from]")!.textContent).toBe("Centrado en PKCE ×");
    click(el.preview.querySelector("[data-flo-kg-clear-from]")!);
    expect(app.graph.from).toBeNull();
    expect(graphNodes(el)).toEqual(["pkce", "rule", "api"]);
  });

  it("still opens the entity panel for a .flo entity clicked in a flow", () => {
    const el = elements();
    new App(el, KG_FILES);
    click(el.preview.querySelector('[data-flo-entity="api"] text')!);
    expect(el.panel.innerHTML).toContain("<code>api</code>");
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
  });

  it("survives editing away the note it is centered on", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    click(el.preview.querySelector('[data-flo-entity="pkce"] text')!);
    app.openDocument("kb/pkce.md");
    app.view.dispatch({ changes: { from: 0, to: app.view.state.doc.length, insert: "" } });
    vi.advanceTimersByTime(500);
    expect(el.preview.textContent).toContain("Ninguna nota coincide con el filtro");
    expect(el.preview.querySelector("[data-flo-kg-clear-from]")!.textContent).toBe("Centrado en pkce ×");
  });

  it("keeps the pan/zoom across edits and drops it when the query changes", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    const svg = () => el.preview.querySelector(".flo-kg svg")!;
    svg().dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 }));
    const zoomed = svg().getAttribute("viewBox");
    expect(app.graph.viewBox).not.toBeNull();
    app.refresh();
    expect(svg().getAttribute("viewBox")).toBe(zoomed);
    change(el.preview, "depth", "2");
    expect(app.graph.viewBox).toBeNull();
    expect(svg().getAttribute("viewBox")).not.toBe(zoomed);
  });

  it("exports the graph as shown", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    vi.mocked(exportSvg).mockClear();
    click(el.toolbar.querySelector("#flo-export-svg")!);
    const svg = vi.mocked(exportSvg).mock.calls[0][0];
    expect(svg).toContain('data-flo-entity="pkce"');
    expect(svg).not.toContain("flo-map-hit");
  });

  it("goes back to the document view when another workspace is loaded", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    app.load(FILES);
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
    expect(app.graph).toEqual({ where: { and: [{ text: "" }] }, from: null, depth: 1, viewBox: null });
  });
});
```

Notas para los tests:
- El orden esperado de `graphNodes` sale de #31: distancia y luego orden
  del catálogo (#24: documentos por uri, `catalog.flo` < `kb/pkce.md` <
  `kb/rule.md`). Sin semilla explícita: `pkce`, `rule` (distancia 0) y
  `api` (1). Centrado en `pkce`: `pkce` (0), luego `api` y `rule` (1) en
  orden del catálogo. Si el test da otro orden, verificar contra `query`
  del core antes de tocar el código: el orden es el de `query`, la vista no
  reordena.
- El debounce del editor es de 200 ms; `vi.advanceTimersByTime(500)` lo
  cubre. Si el archivo usa otra forma de esperar el `onChange`, seguirla.
- En "exports the graph as shown": las franjas `flo-map-hit` no deben
  exportarse; por eso `exportable()` serializa un clon sin ellas (Step 3).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/toolbar.test.ts src/app.test.ts`
Expected: FAIL — no existe `#flo-toggle-graph` ni `app.toggleGraph`.

- [ ] **Step 3: Implement**

`packages/web/src/toolbar.ts`: `onToggleGraph(): void` en
`ToolbarActions`; el botón después de "Mapa":

```html
    <button id="flo-toggle-graph" type="button" aria-pressed="false">Grafo</button>
```

y `byId("flo-toggle-graph").addEventListener("click", actions.onToggleGraph);`.

`packages/web/src/app.ts`:

1. Imports: sumar `renderKnowledge`, `tagCatalog`, `type LinkResult` de
   `@flo/core`; `bindPanZoom` de `./pan-zoom.js`; `DEFAULT_GRAPH`,
   `graphBarHtml`, `graphHtml`, `readBar`, `whereOf`, `type GraphQuery` de
   `./knowledge-view.js`.
2. Estado: reemplazar `private mapMode = false;` por

   ```ts
   private mode: "document" | "map" | "graph" = "document";
   /** La consulta de la vista de grafo (#45); se reemplaza, nunca se muta. */
   graph: GraphQuery = DEFAULT_GRAPH;
   ```

   y en la toolbar `onToggleGraph: () => this.toggleGraph(),`. Registrar
   también `el.preview.addEventListener("change", (event) => this.onPreviewChange(event.target as Element));`.
3. `load()`: `this.mode = "document"; this.graph = DEFAULT_GRAPH;` en vez
   de `this.mapMode = false;`.
4. `refresh()`:

   ```ts
   refresh(): void {
     const link = this.ws.link();
     if (this.mode === "map") {
       this.el.preview.innerHTML = mapHtml(renderMap(link));
       addEdgeHitAreas(this.el.preview);
     } else if (this.mode === "graph") {
       this.renderGraph(link);
     } else {
       const uri = this.ws.active;
       const result = renderActive(link, uri);
       this.previewState = nextPreviewState(this.previewState, result);
       this.el.preview.innerHTML = previewHtml(this.previewState, result, uri);
       enhanceSequencePreview(this.el.preview);
       this.markSelection();
     }
     this.el.toolbar.querySelector("#flo-toggle-map")?.setAttribute("aria-pressed", String(this.mode === "map"));
     this.el.toolbar.querySelector("#flo-toggle-graph")?.setAttribute("aria-pressed", String(this.mode === "graph"));
     this.renderPanel();
     this.renderExplorer();
     // ponytail: sin IndexedDB (modo privado) el editor sigue, solo sin borrador.
     saveDraft(this.ws.snapshot()).catch(() => {});
   }
   ```

5. Nuevos métodos (junto a `toggleMap`, que pasa a
   `this.mode = this.mode === "map" ? "document" : "map"; this.refresh();`):

   ```ts
   /** Alterna el preview entre el documento activo y la vista de grafo (spec de conocimiento §7, #45). */
   toggleGraph(): void {
     if (this.mode === "graph") {
       this.mode = "document";
       this.refresh();
     } else {
       this.showGraph(this.graph);
     }
   }

   private showGraph(graph: GraphQuery): void {
     this.mode = "graph";
     this.graph = graph;
     this.refresh();
   }

   private renderGraph(link: LinkResult): void {
     const { where, from, depth, viewBox } = this.graph;
     const result = query(link, { where, from: from ?? undefined, depth });
     this.el.preview.innerHTML =
       `<div class="flo-kg-bar">${graphBarHtml(link, tagCatalog(link), this.graph, null)}</div>` +
       graphHtml(renderKnowledge(link, result), result.nodes.length === 0);
     const svg = this.el.preview.querySelector<SVGSVGElement>(".flo-kg svg");
     if (!svg) return;
     if (viewBox) svg.setAttribute("viewBox", viewBox.join(" "));
     // Las aristas a un bloque se clickean (drill-down): franja ancha como en el mapa.
     addEdgeHitAreas(this.el.preview);
     bindPanZoom(svg, (next) => (this.graph = { ...this.graph, viewBox: next }));
   }

   private onPreviewChange(target: Element): void {
     if (this.mode !== "graph" || !target.hasAttribute("data-flo-kg")) return;
     const { filter, depth } = readBar(this.el.preview);
     this.graph = { where: whereOf(filter), from: this.graph.from, depth, viewBox: null };
     this.refresh();
   }

   private onGraphClick(target: Element): void {
     if (target.closest("[data-flo-kg-clear-from]")) {
       this.graph = { ...this.graph, from: null, viewBox: null };
       this.refresh();
       return;
     }
     const block = target.closest("[data-flo-block]");
     if (block) {
       this.selectBlock(block.getAttribute("data-flo-block")!, block.getAttribute("data-flo-from"));
       return;
     }
     const node = target.closest("[data-flo-entity]");
     if (!node) return;
     const id = node.getAttribute("data-flo-entity")!;
     const link = this.ws.link();
     if (!link.entities.get(id)?.knowledge) {
       this.selectEntity(id);
       return;
     }
     const location = link.xref.definitionOf(id);
     if (location) this.reveal(location);
   }
   ```

6. `onPreviewClick`: primera línea `if (this.mode === "graph") return this.onGraphClick(target);`;
   el chequeo del mapa pasa a `this.mode === "map" && edge`; y el final
   (nodo) queda:

   ```ts
   const node = target.closest("[data-flo-entity]");
   if (!node || node.classList.contains("flo-unresolved")) return;
   const id = node.getAttribute("data-flo-entity")!;
   // Una nota vuelve a la vista de grafo centrada en ella (spec de conocimiento §7).
   if (this.ws.link().entities.get(id)?.knowledge) {
     this.showGraph({ ...DEFAULT_GRAPH, from: [id], depth: this.graph.depth });
   } else {
     this.selectEntity(id);
   }
   ```

7. `selectBlock`: `this.mode = "document";` en vez de `this.mapMode = false;`.
8. `exportable()`:

   ```ts
   private exportable(): string | undefined {
     if (this.mode === "map") return renderMap(this.ws.link()).svg;
     if (this.mode === "graph") {
       // Lo que se ve, con su viewBox (#45), sin las franjas de click.
       const svg = this.el.preview.querySelector(".flo-kg svg")?.cloneNode(true) as Element | undefined;
       svg?.querySelectorAll(".flo-map-hit").forEach((hit) => hit.remove());
       return svg?.outerHTML;
     }
     const diagrams = this.previewState.lastDiagrams;
     const selected = diagrams.find((diagram) => blockId(this.ws.active, diagram.name) === this.selectedBlock);
     return (selected ?? diagrams[0])?.svg;
   }
   ```

   Con "Ninguna nota coincide" no hay `<svg>` y devuelve `undefined`;
   `onExportSvg`/`onExportPng` ya no exportan en ese caso (`if (svg)`).

`packages/web/index.html`, dentro de `<style>`, después de las reglas de
`.flo-map`:

```css
      .flo-kg-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 13px;
      }
      .flo-kg-note {
        color: #b45309;
      }
      .flo-kg-legend {
        display: inline-flex;
        gap: 8px;
        color: #6b7280;
      }
      .flo-kg-swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        margin-right: 3px;
        border: 1px solid #9ca3af;
      }
      .flo-kg svg {
        cursor: grab;
        max-width: 100%;
      }
      .flo-kg [data-flo-block],
      .flo-kg .flo-map-hit[data-flo-block] {
        cursor: pointer;
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web exec vitest run && pnpm --filter @flo/web typecheck`
Expected: PASS, incluidos todos los tests previos de mapa y exportar.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/toolbar.ts packages/web/src/toolbar.test.ts packages/web/src/app.ts packages/web/src/app.test.ts packages/web/index.html
git commit -m "feat(web): vista de grafo de conocimiento con filtros, pan/zoom y drill-down"
```

---

### Task 6: `App` — presets de vista

**Files:**
- Modify: `packages/web/src/app.ts`
- Modify: `packages/web/src/app.test.ts`

**Interfaces:**
- Consumes: `Preset`, `byName`, `isPresetName`, `listPresets`, `savePreset`
  (task 4); `ensurePermission` (task 4); `memoryDir`, `MemoryTree`
  (`test-dir.ts`, task 4); `showGraph`, `renderGraph`, `onPreviewChange`,
  `onGraphClick`, `KG_FILES`, `change` (task 5).
- Produces: `App` con `private presets: Preset[] | null` (null = sin
  cargar o sin carpeta); la barra recibe `this.presets?.map((p) => p.name) ?? null`.

- [ ] **Step 1: Write the failing tests**

En `packages/web/src/app.test.ts` (import de
`memoryDir, type MemoryTree` desde `./test-dir.js`), dentro de
`describe("App knowledge graph", ...)`:

```ts
  const decisiones = {
    name: "decisiones",
    where: { and: [{ text: "" }, { typeTag: "decision" }] },
    from: null,
    depth: 0,
    viewBox: [0, 0, 50, 50],
  };

  function withViews(views: MemoryTree): { tree: MemoryTree; snapshot: WorkspaceSnapshot } {
    const tree: MemoryTree = { ".flo": { views } };
    return { tree, snapshot: { ...KG_FILES, dir: memoryDir(tree) } };
  }

  const presetNames = (el: AppElements) =>
    [...el.preview.querySelectorAll('[data-flo-kg="preset"] option')].map((option) => option.textContent);

  it("lists the folder's views when entering the graph and applies one", async () => {
    const el = elements();
    const app = new App(el, withViews({ "decisiones.json": JSON.stringify(decisiones) }).snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "decisiones"]));
    change(el.preview, "preset", "decisiones");
    expect(app.graph).toEqual({ where: decisiones.where, from: null, depth: 0, viewBox: [0, 0, 50, 50] });
    expect(graphNodes(el)).toEqual(["pkce"]);
    expect(el.preview.querySelector(".flo-kg svg")!.getAttribute("viewBox")).toBe("0 0 50 50");
  });

  it("saves the current graph as a view", async () => {
    const el = elements();
    const { tree, snapshot } = withViews({});
    const app = new App(el, snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas"]));
    change(el.preview, "depth", "2");
    vi.spyOn(window, "prompt").mockReturnValue(" mia ");
    click(el.preview.querySelector("[data-flo-kg-save]")!);
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "mia"]));
    const views = (tree[".flo"] as MemoryTree).views as MemoryTree;
    expect(JSON.parse(views["mia.json"] as string)).toEqual({ name: "mia", ...app.graph });
  });

  it("rejects a view name that is not a plain file name", async () => {
    const el = elements();
    const { tree, snapshot } = withViews({});
    const app = new App(el, snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas"]));
    vi.spyOn(window, "prompt").mockReturnValue("../fuera");
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    click(el.preview.querySelector("[data-flo-kg-save]")!);
    await vi.waitFor(() => expect(alert).toHaveBeenCalled());
    expect((tree[".flo"] as MemoryTree).views).toEqual({});
    expect(app.graph.depth).toBe(1);
  });

  it("asks before replacing an existing view", async () => {
    const el = elements();
    const original = JSON.stringify(decisiones);
    const { tree, snapshot } = withViews({ "decisiones.json": original });
    const app = new App(el, snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "decisiones"]));
    vi.spyOn(window, "prompt").mockReturnValue("decisiones");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    click(el.preview.querySelector("[data-flo-kg-save]")!);
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(((tree[".flo"] as MemoryTree).views as MemoryTree)["decisiones.json"]).toBe(original);
  });

  it("skips broken views and offers no views without a folder", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = elements();
    const app = new App(el, withViews({ "roto.json": "{", "decisiones.json": JSON.stringify(decisiones) }).snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "decisiones"]));

    const other = elements();
    const plain = new App(other, KG_FILES);
    plain.toggleGraph();
    expect(other.preview.querySelector('[data-flo-kg="preset"]')).toBeNull();
    expect(other.preview.querySelector("[data-flo-kg-save]")).toBeNull();
  });
```

(`vi.waitFor` avanza los timers falsos solo; si la versión instalada de
vitest no lo hace, envolver con `vi.useRealTimers()` al inicio de estos
tests.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/app.test.ts`
Expected: FAIL — no hay select de vistas.

- [ ] **Step 3: Implement**

En `packages/web/src/app.ts`:

1. Imports: `byName`, `isPresetName`, `listPresets`, `savePreset`,
   `type Preset` de `./presets.js`.
2. Estado: `private presets: Preset[] | null = null;` y en `load()`
   `this.presets = null;`.
3. `renderGraph`: la barra pasa `this.presets?.map((preset) => preset.name) ?? null`
   en vez de `null`.
4. `showGraph` carga las vistas la primera vez:

   ```ts
   private showGraph(graph: GraphQuery): void {
     this.mode = "graph";
     this.graph = graph;
     this.refresh();
     if (this.presets === null) void this.run("Leer vistas", () => this.loadPresets());
   }

   /** Las vistas de `.flo/views` (#46); sin permiso de lectura, ninguna. */
   private async loadPresets(): Promise<void> {
     const ws = this.ws;
     if (!ws.dir) return;
     const presets = (await ensurePermission(ws.dir, "read")) ? await listPresets(ws.dir) : [];
     if (this.ws !== ws) return;
     this.presets = presets;
     if (this.mode === "graph") this.refresh();
   }

   private async savePreset(): Promise<void> {
     const ws = this.ws;
     if (!ws.dir) return;
     const answer = window.prompt("Nombre de la vista:");
     if (answer === null) return;
     const name = answer.trim();
     if (!isPresetName(name)) {
       window.alert("El nombre de una vista solo puede tener letras, números, '-' y '_'.");
       return;
     }
     const presets = this.presets ?? [];
     if (presets.some((preset) => preset.name === name) && !window.confirm(`Ya existe la vista '${name}'. ¿Reemplazarla?`)) return;
     if (!(await ensurePermission(ws.dir, "readwrite"))) throw new Error("sin permiso de escritura en la carpeta");
     const preset: Preset = { name, ...this.graph };
     await savePreset(ws.dir, preset);
     if (this.ws !== ws) return;
     this.presets = [...presets.filter((other) => other.name !== name), preset].sort(byName);
     this.refresh();
   }
   ```

5. `onPreviewChange`, antes de leer la barra:

   ```ts
   if (target.getAttribute("data-flo-kg") === "preset") {
     const preset = this.presets?.find((candidate) => candidate.name === (target as HTMLSelectElement).value);
     if (preset) {
       const { name: _name, ...graph } = preset;
       this.graph = graph;
       this.refresh();
     }
     return;
   }
   ```

   (Si el lint de TS se queja de `_name` sin usar, usar
   `this.graph = { where: preset.where, from: preset.from, depth: preset.depth, viewBox: preset.viewBox };`.)

6. `onGraphClick`, primera rama:

   ```ts
   if (target.closest("[data-flo-kg-save]")) {
     void this.run("Guardar vista", () => this.savePreset());
     return;
   }
   ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web exec vitest run && pnpm --filter @flo/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/app.ts packages/web/src/app.test.ts
git commit -m "feat(web): guardar y aplicar vistas del grafo desde la carpeta abierta"
```

---

### Task 7: MCP — `list_tags` estricto y errores como `{ error }`

**Files:**
- Modify: `packages/mcp/src/tools.ts`
- Modify: `packages/mcp/src/tools.test.ts`

**Interfaces:**
- Consumes: `createServer(folder)`, `json`, `failure` (ya en `tools.ts`).
- Produces: toda herramienta registrada pasa por `guarded(handler)`; una
  excepción da `isError: true` con `{ error: <mensaje> }` (#47).

- [ ] **Step 1: Write the failing tests**

En `packages/mcp/src/tools.test.ts`, dentro de `describe("flo-mcp tools", ...)`:

```ts
  it("rejects unknown arguments to list_tags", async () => {
    const { call } = await connect();
    expect((await call("list_tags", { extra: 1 })).isError).toBe(true);
  });

  it("reports an error thrown inside a tool as JSON", async () => {
    const { folder, call } = await connect();
    vi.spyOn(folder, "link").mockImplementation(() => {
      throw new Error("se rompió el link");
    });
    for (const name of ["query", "list_tags", "check"]) {
      expect(await call(name), name).toEqual({ isError: true, value: { error: "se rompió el link" } });
    }
  });
```

(Si `check` sin ruta no pasa por `folder.link()` sino por
`folder.diagnostics()`, espiar también ese método con el mismo `throw`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/mcp exec vitest run src/tools.test.ts`
Expected: FAIL — `list_tags` acepta `extra`; el error llega como texto del SDK, no como JSON `{ error }`.

- [ ] **Step 3: Implement**

En `packages/mcp/src/tools.ts`, debajo de `failure`:

```ts
/** Una excepción del core dentro de una herramienta sale como `{ error }` (#35, #47), no como texto del SDK. */
function guarded<A extends unknown[], R>(handler: (...args: A) => Promise<R>) {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      return failure({ error: error instanceof Error ? error.message : String(error) });
    }
  };
}
```

Envolver el handler de las cinco herramientas: `async (opts) => json(...)`
pasa a `guarded(async (opts) => json(...))`, y así cada una. `list_tags`
declara `inputSchema: z.strictObject({})`:

```ts
  server.registerTool(
    "list_tags",
    {
      description: "El vocabulario en uso: type_tags, context_tags y los valores de cada custom_tag.",
      inputSchema: z.strictObject({}),
    },
    guarded(async () => json(tagCatalog(folder.link())))
  );
```

Si el tipo de `registerTool` no acepta el handler envuelto por la
genericidad de `guarded`, tipar el handler de cada herramienta en su sitio
(`guarded(async ({ id, project }: { id: string; project?: Projection }) => ...)`)
o convertir `guarded` en un `try/catch` dentro de cada handler; lo que
importa es el comportamiento del test.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/mcp exec vitest run && pnpm --filter @flo/mcp typecheck`
Expected: PASS (39 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/tools.ts packages/mcp/src/tools.test.ts
git commit -m "fix(mcp): list_tags estricto y errores de las herramientas como { error }"
```

---

### Task 8: Documentación y cierre

**Files:**
- Modify: `README.md` (sección de `@flo/web`, después del párrafo "Workspace y navegación")
- Modify: `docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md` (línea de **Estado**)
- Modify: `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` (línea de **Estado**; §11 "Pendientes diferidos (Fase K4)" si queda alguno)
- Modify: este plan (línea **Estado** debajo del header)

- [ ] **Step 1: README**

Después del párrafo que termina en "o el mapa si está visible.", agregar:

```markdown
  **Grafo de conocimiento:** "Grafo" dibuja las notas `.md` del workspace
  (color por `memory_type`, con leyenda) y lo que las conecta: relaciones
  con su tipo como etiqueta, flujos entre entidades y los bloques que
  `visualized_by` señala. La barra filtra por memoria, `type_tag`,
  `context_tag` y texto, y elige la profundidad de la expansión. Se
  desplaza arrastrando y se acerca con la rueda. Click en una nota la abre
  en el editor; en un bloque o en una arista hacia él, abre ese flujo; desde
  un flujo, click en una nota vuelve al grafo centrado en ella. Con una
  carpeta abierta, "Guardar vista" guarda filtros, profundidad y encuadre en
  `.flo/views/<nombre>.json` (versionable), y el selector "Vistas" los
  vuelve a aplicar.
```

- [ ] **Step 2: Estado de los specs y del plan**

- Spec de conocimiento, **Estado**: `completado: K1 y K2 el 2026-09-28, K3 el 2026-09-29 y K4 el <fecha>` con el link al plan de K4 junto a los otros.
- Spec de entidades, **Estado**: reemplazar "queda K4" por "K4 también (<fecha>, [plan](../plans/2026-09-30-flo-fase-k4-vista-de-grafo.md))".
- Este plan: debajo del header, `**Estado:** completado el <fecha> (<primer commit>..<último commit>).` con lo que haya encontrado la revisión.
- Lo que la revisión final deje sin hacer va a §11 del spec de entidades como `### Pendientes diferidos (Fase K4, <fecha>)`, con el mismo formato que las fases anteriores. Pendiente conocido de antemano, a anotar ahí: **release — navegador real:** pan/zoom, arrastre y "Guardar vista" (permiso de escritura tras un `prompt`) sin verificar en Chromium.

- [ ] **Step 3: Verificación completa**

Run: `pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: todo en verde; `git status` sin snapshots modificados salvo el nuevo de la task 1 (ya commiteado).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md docs/superpowers/plans/2026-09-30-flo-fase-k4-vista-de-grafo.md
git commit -m "docs: vista de grafo de conocimiento (Fase K4)"
```
