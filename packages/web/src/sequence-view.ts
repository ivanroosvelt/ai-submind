const HEADER_BOX_CLASS = "flo-seq-header-box";
const SVG_NS = "http://www.w3.org/2000/svg";

// Envuelve los headers de los participantes de cada sequence diagram en un
// <svg> aparte, pegado con position:sticky, para que queden visibles al
// hacer scroll. Cada diagrama vive en su propia <section>, que es el
// contenedor del sticky: el header de un bloque no se monta sobre el
// siguiente. Los SVG sin headers (flowcharts) no se tocan.
export function enhanceSequencePreview(container: HTMLElement): void {
  // querySelectorAll es una lista estática: los <svg> de header que se
  // insertan en el loop no se vuelven a procesar.
  container.querySelectorAll("svg").forEach((svg) => enhanceOne(container, svg));
}

function enhanceOne(container: HTMLElement, svg: SVGSVGElement): void {
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
