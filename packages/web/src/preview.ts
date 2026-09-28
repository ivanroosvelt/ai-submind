import { escapeXml, type RenderResult, type RenderedDiagram } from "@flo/core";

export interface PreviewState {
  lastDiagrams: RenderedDiagram[];
}

// Sin bloques y con errores = el documento no se pudo usar (p. ej. mientras
// se escribe un header); se mantiene el último preview válido. Un documento
// válido sin bloques (solo catálogo) sí vacía el preview.
export function nextPreviewState(state: PreviewState, result: RenderResult): PreviewState {
  if (result.diagrams.length === 0 && result.diagnostics.length > 0) return state;
  return { lastDiagrams: result.diagrams };
}

export function previewHtml(state: PreviewState, result: RenderResult): string {
  const diagrams = nextPreviewState(state, result).lastDiagrams;
  const count = result.diagnostics.length;
  const banner = count > 0 ? `<div class="flo-banner">${count} error${count === 1 ? "" : "es"}</div>` : "";
  const body =
    diagrams.length > 0
      ? diagrams
          .map(
            (diagram) =>
              `<section class="flo-block"><h2 class="flo-block-title">${escapeXml(diagram.title ?? diagram.name)}</h2>${diagram.svg}</section>`
          )
          .join("")
      : '<div class="flo-empty">Escribí un diagrama .flo para ver el preview</div>';
  return `${banner}${body}`;
}
