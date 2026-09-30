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
