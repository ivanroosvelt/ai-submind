const HEADER_BOX_CLASS = "flo-seq-header-box";
const SVG_NS = "http://www.w3.org/2000/svg";

// Envuelve los headers de los participantes en un <svg> aparte, pegado con
// position:sticky, para que queden visibles al hacer scroll en un sequence
// diagram largo. Si el preview no es un sequence diagram (no hay headers), no hace nada.
export function enhanceSequencePreview(container: HTMLElement): void {
  const svg = container.querySelector("svg");
  if (!svg) return;

  const headerBoxes = svg.querySelectorAll(`.${HEADER_BOX_CLASS}`);
  if (headerBoxes.length === 0) return;

  const width = svg.getAttribute("width") ?? "0";
  const headerHeight = Number(headerBoxes[0].querySelector("rect")?.getAttribute("height") ?? "0");

  // El scroll container (preview-pane) tiene padding-top: ese margen no es
  // parte del "sticky" por CSS, así que el contenido scrolleado se ve a
  // través de él. Extendemos el header hacia arriba para taparlo también.
  const paddingTop = parseFloat(getComputedStyle(container).paddingTop) || 0;
  const totalHeight = headerHeight + paddingTop;

  const headerSvg = document.createElementNS(SVG_NS, "svg");
  headerSvg.setAttribute("width", width);
  headerSvg.setAttribute("height", String(totalHeight));
  headerSvg.setAttribute("viewBox", `0 ${-paddingTop} ${width} ${totalHeight}`);

  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", String(-paddingTop));
  background.setAttribute("width", width);
  background.setAttribute("height", String(totalHeight));
  background.setAttribute("fill", "#ffffff");
  headerSvg.appendChild(background);

  headerBoxes.forEach((box) => headerSvg.appendChild(box.cloneNode(true)));

  const sticky = document.createElement("div");
  sticky.className = "flo-seq-sticky";
  sticky.style.top = `-${paddingTop}px`;
  sticky.appendChild(headerSvg);

  svg.before(sticky);
}
