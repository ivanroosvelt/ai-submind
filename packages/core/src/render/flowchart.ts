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
