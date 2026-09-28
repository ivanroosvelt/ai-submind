import type { DiagramBlock, Range } from "../ast.js";
import type { Catalog } from "../workspace/resolver.js";
import { blockNodes, nodeId } from "./nodes.js";

export const COLUMN_WIDTH = 160;
export const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 50;
const TOP_MARGIN = 20;
const BOTTOM_MARGIN = 20;

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
  lifelineTop: number;
  lifelineBottom: number;
  participants: SequenceParticipantLayout[];
  messages: SequenceMessageLayout[];
}

export function layoutSequence(block: DiagramBlock, catalog: Catalog): SequenceLayout {
  const participants: SequenceParticipantLayout[] = blockNodes(block, catalog).map((node, index) => ({
    id: node.id,
    label: node.label,
    resolved: node.resolved,
    x: COLUMN_WIDTH / 2 + index * COLUMN_WIDTH,
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
    width: participants.length * COLUMN_WIDTH,
    height: lifelineBottom + BOTTOM_MARGIN,
    lifelineTop,
    lifelineBottom,
    participants,
    messages,
  };
}
