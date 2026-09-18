import type { RenderResult } from "@flo/core";

export interface PreviewState {
  lastSvg: string | null;
}

export function nextPreviewState(state: PreviewState, result: RenderResult): PreviewState {
  return { lastSvg: result.svg ?? state.lastSvg };
}

export function previewHtml(state: PreviewState, result: RenderResult): string {
  const svg = result.svg ?? state.lastSvg;
  const count = result.diagnostics.length;
  const banner = count > 0 ? `<div class="flo-banner">${count} error${count === 1 ? "" : "es"}</div>` : "";
  const body = svg ?? '<div class="flo-empty">Escribí un diagrama .flo para ver el preview</div>';
  return `${banner}${body}`;
}
