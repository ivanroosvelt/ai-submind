import type { DiagramBlock, Range } from "../ast.js";
import type { Catalog } from "../workspace/resolver.js";
import { blockNodes, nodeId } from "./nodes.js";

export const COLUMN_WIDTH = 160;
export const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 50;
const TOP_MARGIN = 20;
const BOTTOM_MARGIN = 20;
// Las mismas medidas que el flowchart (measureFlowchartNode) y que svgLabel.
const CHAR_WIDTH = 8;
const LABEL_CHAR_WIDTH = 7;

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

export interface SequenceLayout {
  width: number;
  height: number;
  columnWidth: number;
  lifelineTop: number;
  lifelineBottom: number;
  participants: SequenceParticipantLayout[];
  messages: SequenceMessageLayout[];
}

export function layoutSequence(block: DiagramBlock, catalog: Catalog): SequenceLayout {
  const nodes = blockNodes(block, catalog);
  // Una sola columna para todas (#52): la del label más largo, o 160 si todo cabe.
  const columnWidth = Math.max(
    COLUMN_WIDTH,
    ...nodes.map((node) => node.label.length * CHAR_WIDTH + 40),
    ...block.edges.map((edge) => (edge.label ?? "").length * LABEL_CHAR_WIDTH + 28)
  );
  const participants: SequenceParticipantLayout[] = nodes.map((node, index) => ({
    id: node.id,
    label: node.label,
    resolved: node.resolved,
    x: columnWidth / 2 + index * columnWidth,
    range: node.range,
  }));

  const messages: SequenceMessageLayout[] = block.edges.map((edge, index) => ({
    from: nodeId(edge.from),
    to: nodeId(edge.to),
    label: edge.label ?? "", // el parser garantiza la etiqueta en `sequence`
    y: HEADER_HEIGHT + TOP_MARGIN + (index + 1) * ROW_HEIGHT,
    range: edge.range,
  }));

  const lifelineTop = HEADER_HEIGHT;
  const lifelineBottom = HEADER_HEIGHT + TOP_MARGIN + (messages.length + 1) * ROW_HEIGHT;

  return {
    width: participants.length * columnWidth,
    height: lifelineBottom + BOTTOM_MARGIN,
    columnWidth,
    lifelineTop,
    lifelineBottom,
    participants,
    messages,
  };
}
