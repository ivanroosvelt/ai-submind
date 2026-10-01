/** x, y, ancho y alto del `viewBox` de un SVG. */
export type ViewBox = [number, number, number, number];

const ZOOM_STEP = 1.1;
// Un arrastre más corto que esto es un click (decisión #45).
const DRAG_THRESHOLD = 3;

export function parseViewBox(value: string | null): ViewBox | null {
  const parts = value?.trim().split(/[\s,]+/).map(Number) ?? [];
  return parts.length === 4 && parts.every(Number.isFinite) ? (parts as ViewBox) : null;
}

/** `factor > 1` acerca; el punto `(px, py)`, en unidades del SVG, queda quieto. */
export function zoomViewBox([x, y, width, height]: ViewBox, factor: number, px: number, py: number): ViewBox {
  return [px - (px - x) / factor, py - (py - y) / factor, width / factor, height / factor];
}

/** Desplaza el contenido `(dx, dy)` unidades del SVG, en el sentido del arrastre. */
export function panViewBox([x, y, width, height]: ViewBox, dx: number, dy: number): ViewBox {
  return [x - dx, y - dy, width, height];
}

/** Rueda = zoom alrededor del puntero; arrastre con el botón principal = desplazar (spec de conocimiento §7). */
export function bindPanZoom(svg: SVGSVGElement, onChange: (viewBox: ViewBox) => void): void {
  const current = () => parseViewBox(svg.getAttribute("viewBox")) ?? [0, 0, 0, 0];
  const set = (viewBox: ViewBox) => {
    svg.setAttribute("viewBox", viewBox.join(" "));
    onChange(viewBox);
  };
  // Unidades del SVG por px de pantalla; sin tamaño (jsdom, SVG oculto) se toma 1:1.
  const scale = () => {
    const width = svg.getBoundingClientRect().width;
    return width > 0 ? current()[2] / width : 1;
  };

  svg.addEventListener(
    "wheel",
    (event) => {
      // Scroll puramente horizontal (trackpad): no es gesto de zoom.
      if (event.deltaY === 0) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const viewBox = current();
      const s = scale();
      const px = viewBox[0] + (event.clientX - rect.left) * s;
      const py = viewBox[1] + (event.clientY - rect.top) * s;
      set(zoomViewBox(viewBox, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, px, py));
    },
    { passive: false }
  );

  let down: { x: number; y: number } | null = null;
  let last: { x: number; y: number } | null = null;
  let isDrag = false;
  let pointerId = 0;
  // Pointer events (#59): mouse, touch y lápiz; la captura (al superar el umbral) sigue el arrastre fuera del SVG.
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    down = { x: event.clientX, y: event.clientY };
    last = { x: event.clientX, y: event.clientY };
    isDrag = false;
    pointerId = event.pointerId;
  });
  svg.addEventListener("pointermove", (event) => {
    if (!last || !down) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    last = { x: event.clientX, y: event.clientY };
    // Marcamos como arrastre si el desplazamiento neto desde pointerdown supera el umbral.
    if (!isDrag) {
      const netDistance = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      isDrag = netDistance > DRAG_THRESHOLD;
      // Capturar recién al arrastrar: capturar en pointerdown redirige el click al <svg> y rompe el drill-down.
      // ponytail: jsdom no implementa setPointerCapture.
      if (isDrag) svg.setPointerCapture?.(pointerId);
    }
    const s = scale();
    set(panViewBox(current(), dx * s, dy * s));
  });
  const end = () => {
    down = null;
    last = null;
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  // Captura en el SVG: el click que cierra un arrastre no llega al preview (drill-down).
  svg.addEventListener(
    "click",
    (event) => {
      if (isDrag) event.stopPropagation();
      isDrag = false;
    },
    true
  );
}
