import type { SequenceLayout } from "../layout/sequence.js";
import { HEADER_HEIGHT } from "../layout/sequence.js";
import {
  ARROW_MARKER_ID,
  FILL_COLOR,
  LIFELINE_COLOR,
  STROKE_COLOR,
  arrowMarkerDefs,
  dataAttributes,
  svgLabel,
  svgText,
  type BlockOrigin,
} from "./svg.js";

export function renderSequenceToSvg(layout: SequenceLayout, origin: BlockOrigin): string {
  const xById = new Map(layout.participants.map((participant) => [participant.id, participant.x]));

  const participantElements = layout.participants.map((participant) => {
    const left = participant.x - layout.columnWidth / 2 + 10;
    const boxWidth = layout.columnWidth - 20;
    const dash = participant.resolved ? "" : ' stroke-dasharray="4 4"';
    const box = `<rect x="${left}" y="0" width="${boxWidth}" height="${HEADER_HEIGHT}" fill="${FILL_COLOR}" stroke="${STROKE_COLOR}" stroke-width="2"${dash} />`;
    const label = svgText(participant.x, HEADER_HEIGHT / 2, participant.label);
    const lifeline = `<line x1="${participant.x}" y1="${layout.lifelineTop}" x2="${participant.x}" y2="${layout.lifelineBottom}" stroke="${LIFELINE_COLOR}" stroke-width="1" stroke-dasharray="4 4" />`;
    const data = dataAttributes({
      entity: participant.id,
      block: origin.block,
      uri: origin.uri,
      line: participant.range.start.line,
    });
    const group = `<g${participant.resolved ? "" : ' class="flo-unresolved"'}${data}>`;
    return `${group}<g class="flo-seq-header-box">${box}${label}</g>${lifeline}</g>`;
  });

  const messageElements = layout.messages.map((message) => {
    const x1 = xById.get(message.from);
    const x2 = xById.get(message.to);
    if (x1 === undefined || x2 === undefined) {
      throw new Error(`falta la posición de un participante en el mensaje '${message.from}->${message.to}'`);
    }
    const data = dataAttributes({
      from: message.from,
      to: message.to,
      block: origin.block,
      uri: origin.uri,
      line: message.range.start.line,
    });
    if (message.from === message.to) {
      // Auto-mensaje (#52): un lazo a la derecha de la lifeline, que vuelve a ella.
      const { y } = message;
      const loop = `<polyline points="${x1},${y} ${x1 + 30},${y} ${x1 + 30},${y + 20} ${x1},${y + 20}" fill="none" stroke="${STROKE_COLOR}" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})"${data} />`;
      return `${loop}${svgLabel(x1 + 15, y - 8, message.label)}`;
    }
    const line = `<line x1="${x1}" y1="${message.y}" x2="${x2}" y2="${message.y}" stroke="${STROKE_COLOR}" stroke-width="2" marker-end="url(#${ARROW_MARKER_ID})"${data} />`;
    const midX = (x1 + x2) / 2;
    return `${line}${svgLabel(midX, message.y - 8, message.label)}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${arrowMarkerDefs()}${participantElements.join("")}${messageElements.join("")}</svg>`;
}
