import type { RenderedMap } from "@tejo/core";

export function mapHtml(map: RenderedMap): string {
  const body =
    map.edges.length === 0 ? '<p class="flo-empty">Ningún flujo conecta entidades todavía</p>' : map.svg;
  return `<section class="flo-block flo-map"><h2 class="flo-block-title">Mapa del sistema</h2>${body}</section>`;
}

/** Una franja invisible de 12 px sobre cada arista: la línea de 2 px sola casi no se puede clickear. */
export function addEdgeHitAreas(container: ParentNode): void {
  container.querySelectorAll("polyline[data-flo-from]").forEach((line) => {
    const hit = line.cloneNode() as Element;
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", "12");
    hit.removeAttribute("marker-end");
    hit.classList.add("flo-map-hit");
    line.after(hit);
  });
}
