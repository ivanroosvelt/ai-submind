import dagre from "dagre";
import type { DiagramBlock, NodeShape } from "../ast.js";
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
    graph.setEdge(nodeId(edge.from), nodeId(edge.to));
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
      from: nodeId(edge.from),
      to: nodeId(edge.to),
      label: edge.label,
      points: graph.edge(nodeId(edge.from), nodeId(edge.to)).points,
    })),
  };
}
