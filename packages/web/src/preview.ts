import { blockId, escapeXml, renderBlock, type DocumentUri, type LinkResult, type RenderResult, type RenderedDiagram } from "@flo/core";
import { parseSvgSize } from "./export.js";
import { markdownHtml, noteHeaderHtml } from "./note-view.js";

export interface PreviewState {
  lastDiagrams: RenderedDiagram[];
}

/** Los bloques del documento contra su catálogo alcanzable; el esquema y un `.md` sin frontmatter no tienen. */
export function renderActive(link: LinkResult, uri: DocumentUri): RenderResult {
  const diagnostics = link.diagnostics.get(uri) ?? [];
  const linked = link.documents.get(uri);
  if (!linked) return { diagrams: [], diagnostics };
  return { diagrams: linked.document.blocks.map((block) => renderBlock(block, linked.catalog, uri)), diagnostics };
}

// Sin bloques y con errores = el documento no se pudo usar (p. ej. mientras
// se escribe un header); se mantiene el último preview válido. Un documento
// válido sin bloques (solo catálogo) sí vacía el preview.
export function nextPreviewState(state: PreviewState, result: RenderResult): PreviewState {
  if (result.diagrams.length === 0 && result.diagnostics.length > 0) return state;
  return { lastDiagrams: result.diagrams };
}

function sectionHtml(diagram: RenderedDiagram, uri: DocumentUri): string {
  // Un bloque sin aristas da un SVG de ancho 0: se dice en vez de dibujar nada.
  const body = parseSvgSize(diagram.svg).width === 0 ? '<p class="flo-empty">Bloque vacío</p>' : diagram.svg;
  const id = escapeXml(blockId(uri, diagram.name));
  return `<section class="flo-block" data-flo-block="${id}"><h2 class="flo-block-title">${escapeXml(diagram.title ?? diagram.name)}</h2>${body}</section>`;
}

/**
 * Una nota `.md`: cabecera del frontmatter y el cuerpo como prosa, con cada
 * cerca ` ```flo ` reemplazada por sus diagramas. Null si no es una nota.
 */
function noteHtml(link: LinkResult, uri: DocumentUri, diagrams: RenderedDiagram[]): string | null {
  const document = link.documents.get(uri)?.document;
  const entity = document?.entities[0];
  if (!document || !entity?.knowledge) return null;
  // Línea 1-based del documento → índice 0-based del cuerpo (el frontmatter termina en range.end).
  const bodyLine = (line: number) => line - entity.range.end.line - 1;
  const diagramsAt = (start: number, end: number) =>
    document.blocks
      .filter((block) => bodyLine(block.range.start.line) >= start && bodyLine(block.range.start.line) < end)
      .flatMap((block) => diagrams.filter((diagram) => diagram.name === block.name))
      .map((diagram) => sectionHtml(diagram, uri))
      .join("");
  return `<article class="flo-note">${noteHeaderHtml(link, entity)}<div class="flo-prose">${markdownHtml(entity.knowledge.body, diagramsAt)}</div></article>`;
}

export function previewHtml(state: PreviewState, result: RenderResult, uri: DocumentUri, link?: LinkResult): string {
  const diagrams = nextPreviewState(state, result).lastDiagrams;
  const count = result.diagnostics.length;
  const banner = count > 0 ? `<div class="flo-banner">${count} error${count === 1 ? "" : "es"}</div>` : "";
  const note = link ? noteHtml(link, uri, diagrams) : null;
  if (note) return banner + note;
  if (diagrams.length > 0) return banner + diagrams.map((diagram) => sectionHtml(diagram, uri)).join("");
  return banner || '<div class="flo-empty">Escribe un diagrama .flo para ver el preview</div>';
}

/**
 * Ids de marcador únicos en la página (#58): el core repite `flo-arrow` en
 * cada SVG (los exportados son archivos sueltos y lo necesitan así).
 */
export function scopeMarkerIds(container: ParentNode): void {
  container.querySelectorAll("svg").forEach((svg, index) => {
    const marker = svg.querySelector("marker[id]");
    if (!marker) return;
    const ref = `url(#${marker.id})`;
    marker.id = `${marker.id}-${index}`;
    svg.querySelectorAll(`[marker-end="${ref}"]`).forEach((line) => line.setAttribute("marker-end", `url(#${marker.id})`));
  });
}
