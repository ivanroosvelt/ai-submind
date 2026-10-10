/**
 * Foco en un lienzo denso (decisión #69): el nodo enfocado, sus vecinos y las
 * aristas entre ellos quedan a la vista; el resto se atenúa. El foco fijo es
 * la entidad elegida; pasar el puntero sobre otro nodo lo cambia mientras dura.
 */

// Con más aristas que esto, las etiquetas de relación solo se ven en el foco.
export const DENSE_EDGES = 40;

const NODE = "g[data-flo-entity], g[data-flo-block]";

function nodeId(node: Element): string | null {
  return node.getAttribute("data-flo-entity") ?? node.getAttribute("data-flo-block");
}

/** Marca `flo-near` en el nodo `id`, sus vecinos y sus aristas; null quita el foco. */
export function applyFocus(svg: Element, id: string | null): void {
  for (const element of svg.querySelectorAll(".flo-near")) element.classList.remove("flo-near");
  svg.classList.toggle("flo-dim", id !== null);
  if (id === null) return;
  const near = new Set([id]);
  const edges = [...svg.querySelectorAll("polyline[data-flo-from], .flo-kg-label[data-flo-from]")];
  for (const edge of edges) {
    const from = edge.getAttribute("data-flo-from");
    const to = edge.getAttribute("data-flo-to");
    if (from !== id && to !== id) continue;
    edge.classList.add("flo-near");
    near.add(from!).add(to!);
  }
  for (const node of svg.querySelectorAll(NODE)) {
    if (near.has(nodeId(node) ?? "")) node.classList.add("flo-near");
  }
}

/** El foco sigue al puntero sobre los nodos y vuelve a `pinned()` al salir. */
export function bindFocus(svg: SVGSVGElement, pinned: () => string | null): void {
  const edges = svg.querySelectorAll("polyline[data-flo-from]:not(.flo-map-hit)").length;
  svg.classList.toggle("flo-dense", edges > DENSE_EDGES);
  applyFocus(svg, pinned());
  let hovered: Element | null = null;
  svg.addEventListener("pointerover", (event) => {
    const node = (event.target as Element).closest(NODE);
    // Con un botón apretado se está arrastrando el lienzo: el foco no salta.
    if (node === hovered || event.buttons !== 0) return;
    hovered = node;
    applyFocus(svg, node ? nodeId(node) : pinned());
  });
  svg.addEventListener("pointerleave", () => {
    hovered = null;
    applyFocus(svg, pinned());
  });
}
