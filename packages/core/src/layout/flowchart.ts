import dagre from "dagre";
import type { DiagramBlock, NodeShape, Range } from "../ast.js";
import type { Catalog } from "../workspace/resolver.js";
import { blockNodes, nodeId, type BlockNode } from "./nodes.js";

const GRAPH_OPTIONS = { rankdir: "TB", nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 };
const CHAR_WIDTH = 8;

export interface LayoutPoint {
  x: number;
  y: number;
}

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
  range: Range;
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

function finiteOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function layoutFlowchart(block: DiagramBlock, catalog: Catalog): FlowchartLayout {
  // Multigrafo (decisión #49): una arista con nombre por línea del bloque,
  // así dos `a -> b` repetidas tienen recorridos propios.
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ ...GRAPH_OPTIONS });
  graph.setDefaultEdgeLabel(() => ({}));

  // Primero todos los nodos y después todas las aristas, en ese orden: es
  // el mismo input que recibía dagre con el lenguaje anterior, y del orden
  // de inserción depende la posición final.
  const nodes = blockNodes(block, catalog);
  for (const node of nodes) {
    graph.setNode(node.id, measureFlowchartNode(node.shape, node.label));
  }
  block.edges.forEach((edge, index) => graph.setEdge(nodeId(edge.from), nodeId(edge.to), {}, String(index)));

  dagre.layout(graph);

  const graphSize = graph.graph();
  return {
    width: finiteOrZero(graphSize.width),
    height: finiteOrZero(graphSize.height),
    nodes: nodes.map((node) => {
      const laidOut = graph.node(node.id);
      return { ...node, x: laidOut.x, y: laidOut.y, width: laidOut.width, height: laidOut.height };
    }),
    edges: block.edges.map((edge, index) => ({
      from: nodeId(edge.from),
      to: nodeId(edge.to),
      label: edge.label,
      points: graph.edge({ v: nodeId(edge.from), w: nodeId(edge.to), name: String(index) }).points,
      range: edge.range,
    })),
  };
}
