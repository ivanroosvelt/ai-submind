import type { DocumentUri } from "../ast.js";
import type { BlockId } from "../workspace/xref.js";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** De dónde sale un bloque renderizado: se repite en cada elemento anotado. */
export interface BlockOrigin {
  uri: DocumentUri;
  block: BlockId;
}

/** Atributos `data-flo-*` (spec §6.3, decisión #26), en el orden dado y escapados. */
export function dataAttributes(attributes: Record<string, string | number>): string {
  return Object.entries(attributes)
    .map(([name, value]) => ` data-flo-${name}="${escapeXml(String(value))}"`)
    .join("");
}

export const ARROW_MARKER_ID = "flo-arrow";

export const STROKE_COLOR = "#1f2937";
export const FILL_COLOR = "#eff6ff";
export const LIFELINE_COLOR = "#9ca3af";

export function arrowMarkerDefs(): string {
  return `<defs><marker id="${ARROW_MARKER_ID}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${STROKE_COLOR}" /></marker></defs>`;
}

export function svgText(x: number, y: number, text: string): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">${escapeXml(text)}</text>`;
}

const LABEL_CHAR_WIDTH = 7;
const LABEL_PADDING_X = 4;
const LABEL_HEIGHT = 16;

// Fondo blanco detrás de las etiquetas sobre líneas (arista/mensaje), para
// que no se confundan visualmente con la flecha que atraviesan.
export function svgLabel(x: number, y: number, text: string): string {
  const width = text.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X * 2;
  const rect = `<rect x="${x - width / 2}" y="${y - LABEL_HEIGHT / 2}" width="${width}" height="${LABEL_HEIGHT}" fill="#ffffff" />`;
  return `${rect}${svgText(x, y, text)}`;
}
