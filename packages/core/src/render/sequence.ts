import type { SequenceDiagram } from "../ast.js";
import type { SequenceLayout } from "../layout/sequence.js";
import { COLUMN_WIDTH, HEADER_HEIGHT } from "../layout/sequence.js";
import { ARROW_MARKER_ID, FILL_COLOR, LIFELINE_COLOR, STROKE_COLOR, arrowMarkerDefs, svgText } from "./svg.js";

export function renderSequenceToSvg(diagram: SequenceDiagram, layout: SequenceLayout): string {
  const xById = new Map(layout.participants.map((participant) => [participant.id, participant.x]));

  const participantElements = layout.participants.map((participant) => {
    const left = participant.x - COLUMN_WIDTH / 2 + 10;
    const boxWidth = COLUMN_WIDTH - 20;
    const box = `<rect x="${left}" y="0" width="${boxWidth}" height="${HEADER_HEIGHT}" fill="${FILL_COLOR}" stroke="${STROKE_COLOR}" stroke-width="2" />`;
    const label = svgText(participant.x, HEADER_HEIGHT / 2, participant.label);
    const lifeline = `<line x1="${participant.x}" y1="${layout.lifelineTop}" x2="${participant.x}" y2="${layout.lifelineBottom}" stroke="${LIFELINE_COLOR}" stroke-width="1" stroke-dasharray="4 4" />`;
    return `<g>${box}${label}${lifeline}</g>`;
  });

  const messageElements = layout.messages.map((message) => {
    const x1 = xById.get(message.from);
    const x2 = xById.get(message.to);
    if (x1 === undefined || x2 === undefined) {
      throw new Error(`falta la posición de un participante en el mensaje '${message.from}->${message.to}'`);
    }
    const line = `<line x1="${x1}" y1="${message.y}" x2="${x2}" y2="${message.y}" stroke="${STROKE_COLOR}" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})" />`;
    const midX = (x1 + x2) / 2;
    return `${line}${svgText(midX, message.y - 8, message.label)}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${arrowMarkerDefs()}${participantElements.join("")}${messageElements.join("")}</svg>`;
}
