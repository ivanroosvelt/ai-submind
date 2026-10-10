import type { MemoryType, NodeShape } from "../ast.js";
import { measureFlowchartNode } from "../layout/flowchart.js";
import { layoutKnowledge } from "../layout/knowledge.js";
import { parseBlockId } from "../workspace/uri.js";
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
  escapeXml,
  svgLabel,
  svgText,
} from "./svg.js";

/** Relleno por tipo de memoria (decisión #44): inline, así el SVG exportado conserva el color. */
export const MEMORY_FILL: Record<MemoryType, string> = {
  working: "#fef3c7",
  short_term: "#e0e7ff",
  long_term: "#dcfce7",
};

const GROUP_FILL = "#f8fafc";
const GROUP_STROKE = "#cbd5e1";
const GROUP_TEXT = "#64748b";

// Los títulos de notas suelen ser frases: en una sola línea un nodo mide
// cientos de px y el grafo se vuelve una franja ilegible.
const WRAP_CHARS = 28;
const LINE_HEIGHT = 18;

/** Parte un título largo en líneas de hasta `WRAP_CHARS`, por palabras. */
export function wrapLabel(label: string): string[] {
  if (label.length <= WRAP_CHARS) return [label];
  const lines: string[] = [];
  let line = "";
  for (const word of label.split(/\s+/)) {
    if (line && line.length + 1 + word.length > WRAP_CHARS) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function measureNode(shape: NodeShape, lines: string[]): { width: number; height: number } {
  const widest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  const size = measureFlowchartNode(shape, widest);
  return { width: size.width, height: size.height + (lines.length - 1) * LINE_HEIGHT };
}

function nodeText(x: number, y: number, lines: string[]): string {
  if (lines.length === 1) return svgText(x, y, lines[0]);
  const top = y - ((lines.length - 1) * LINE_HEIGHT) / 2;
  const spans = lines.map((line, i) => `<tspan x="${x}" y="${top + i * LINE_HEIGHT}">${escapeXml(line)}</tspan>`);
  return `<text text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">${spans.join("")}</text>`;
}

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

function blockTitle(link: LinkResult, id: BlockId): string {
  const { uri, name } = parseBlockId(id);
  const block = link.documents.get(uri)?.document.blocks.find((candidate) => candidate.name === name);
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
          data: { block, uri: parseBlockId(block).uri },
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

/** La carpeta común a todos los nombres, por segmentos ("a/b" de "a/b/c" y "a/b/d"). */
function commonDirPrefix(names: string[]): string {
  const split = names.map((name) => name.split("/"));
  const common: string[] = [];
  for (let i = 0; split.every((parts) => i < parts.length && parts[i] === split[0][i]); i++) common.push(split[0][i]);
  return common.join("/");
}

/** La carpeta de una uri: el grupo de su nodo en el layout (#69). */
function groupOf(uri: string): string {
  const slash = uri.lastIndexOf("/");
  return slash === -1 ? "" : uri.slice(0, slash);
}

/** Vista de grafo de conocimiento (spec de conocimiento §7, decisiones #44 y #69). */
export function renderKnowledge(link: LinkResult, result: QueryResult): string {
  const { nodes, edges } = graphOf(link, result);
  const lines = new Map(nodes.map((node) => [node.id, wrapLabel(node.label)]));
  const layout = layoutKnowledge(
    nodes.map((node) => ({ id: node.id, group: groupOf(node.data.uri), ...measureNode(node.shape, lines.get(node.id)!) })),
    edges
  );

  // El nombre de la región sin la carpeta que comparten todas (`knowledge/`).
  const names = layout.groups.map((group) => group.name);
  const prefix = names.length === 0 ? 0 : commonDirPrefix(names).length;
  // Regiones de carpeta detrás de todo; etiquetas de arista encima de los nodos.
  const groupElements = layout.groups.map(
    (group) =>
      `<g class="flo-kg-group" data-flo-group="${escapeXml(group.name)}"><rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" rx="16" fill="${GROUP_FILL}" stroke="${GROUP_STROKE}" stroke-dasharray="6 4" />` +
      `<text x="${group.x + 14}" y="${group.y + 18}" font-family="sans-serif" font-size="13" font-weight="600" fill="${GROUP_TEXT}">${escapeXml(group.name.slice(prefix).replace(/^\//, "") || group.name || "/")}</text></g>`
  );
  const nodeElements = nodes.map((node) => {
    const { x, y, width, height } = layout.nodes.get(node.id)!;
    const shape = shapeElement({ x, y, width, height, shape: node.shape }, false, node.fill);
    const className = node.className ? ` class="${node.className}"` : "";
    return `<g${className}${dataAttributes(node.data)}>${shape}${nodeText(x, y, lines.get(node.id)!)}</g>`;
  });
  const edgeElements: string[] = [];
  const labelElements: string[] = [];
  edges.forEach((edge, index) => {
    const points = layout.edges[index];
    if (points.length === 0) return;
    edgeElements.push(
      `<polyline points="${points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${STROKE_COLOR}" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})"${dataAttributes(edge.data)} />`
    );
    if (edge.type === "flow") return;
    const mid =
      points.length % 2 === 1
        ? points[(points.length - 1) / 2]
        : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    labelElements.push(
      `<g class="flo-kg-label"${dataAttributes({ from: edge.from, to: edge.to })}>${svgLabel(mid.x, mid.y, edge.type)}</g>`
    );
  });

  const { width, height } = layout;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${arrowMarkerDefs()}${groupElements.join("")}${edgeElements.join("")}${nodeElements.join("")}${labelElements.join("")}</svg>`;
}
