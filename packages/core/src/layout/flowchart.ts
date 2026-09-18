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

function finiteOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function layoutFlowchart(diagram: FlowchartDiagram): FlowchartLayout {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ ...GRAPH_OPTIONS });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of diagram.nodes) {
    graph.setNode(node.id, measureFlowchartNode(node.shape, node.label));
  }
  const declaredIds = new Set(diagram.nodes.map((node) => node.id));
  for (const edge of diagram.edges) {
    for (const id of [edge.from, edge.to]) {
      if (!declaredIds.has(id) && !graph.hasNode(id)) {
        // Placeholder para un extremo no declarado (E017): dagre necesita un
        // tamaño configurado para calcular una posición finita. El ancho debe
        // ser > 0 porque intersectRect divide por el ancho/2 al recortar el
        // último punto de la arista, y un ancho 0 produce NaN.
        graph.setNode(id, { width: 1, height: 1 });
      }
    }
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

  return { width: finiteOrZero(graphSize.width), height: finiteOrZero(graphSize.height), nodes, edges };
}
