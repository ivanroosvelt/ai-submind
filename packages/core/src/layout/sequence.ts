import type { SequenceDiagram } from "../ast.js";

export const COLUMN_WIDTH = 160;
export const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 50;
const TOP_MARGIN = 20;
const BOTTOM_MARGIN = 20;

export interface SequenceParticipantLayout {
  id: string;
  label: string;
  x: number;
}

export interface SequenceMessageLayout {
  from: string;
  to: string;
  label: string;
  y: number;
}

export interface SequenceLayout {
  width: number;
  height: number;
  lifelineTop: number;
  lifelineBottom: number;
  participants: SequenceParticipantLayout[];
  messages: SequenceMessageLayout[];
}

export function layoutSequence(diagram: SequenceDiagram): SequenceLayout {
  const participants: SequenceParticipantLayout[] = diagram.participants.map((participant, index) => ({
    id: participant.id,
    label: participant.label,
    x: COLUMN_WIDTH / 2 + index * COLUMN_WIDTH,
  }));

  const messages: SequenceMessageLayout[] = diagram.messages.map((message, index) => ({
    from: message.from,
    to: message.to,
    label: message.label,
    y: HEADER_HEIGHT + TOP_MARGIN + (index + 1) * ROW_HEIGHT,
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
