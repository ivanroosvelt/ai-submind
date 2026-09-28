import type { FlowchartLayout, FlowchartNodeLayout } from "../layout/flowchart.js";
import {
  ARROW_MARKER_ID,
  FILL_COLOR,
  STROKE_COLOR,
  arrowMarkerDefs,
  dataAttributes,
  svgLabel,
  svgText,
  type BlockOrigin,
} from "./svg.js";

// Un nodo sin resolver (E030) se dibuja igual pero punteado, para que el
// flujo se siga leyendo y el hueco del catálogo salte a la vista.
const UNRESOLVED_DASH = ' stroke-dasharray="4 4"';

function shapeElement(node: FlowchartNodeLayout): string {
  const { x, y, width, height } = node;
  const left = x - width / 2;
  const top = y - height / 2;
  const dash = node.resolved ? "" : UNRESOLVED_DASH;

  if (node.shape === "decision") {
    const points = [
      `${x},${top}`,
      `${x + width / 2},${y}`,
      `${x},${top + height}`,
      `${x - width / 2},${y}`,
    ].join(" ");
    return `<polygon points="${points}" fill="${FILL_COLOR}" stroke="${STROKE_COLOR}" stroke-width="2"${dash} />`;
  }

  const rx = node.shape === "rounded" ? 12 : 0;
  return `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${rx}" fill="${FILL_COLOR}" stroke="${STROKE_COLOR}" stroke-width="2"${dash} />`;
}

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
