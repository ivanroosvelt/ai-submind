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
