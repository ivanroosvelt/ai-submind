import { downloadBlob, downloadText } from "./file-io.js";

export function parseSvgSize(svg: string): { width: number; height: number } {
  const match = svg.match(/width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/);
  if (!match) {
    throw new Error("no se pudo leer el tamaño del SVG");
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function exportSvg(svg: string): void {
  downloadText(svg, "diagrama.svg", "image/svg+xml");
}

// ponytail: jsdom no implementa canvas (getContext/toBlob) ni la carga de
// Image vía data URL, así que este flujo no tiene test unitario — se
// verifica a mano en el navegador (pnpm --filter @flo/web dev, Task 6).
// Si hace falta cobertura automatizada, agregar Playwright (spec §7).
export function exportPng(svg: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { width, height } = parseSvgSize(svg);
    if (width === 0 || height === 0) {
      reject(new Error("el diagrama está vacío, no hay nada que exportar"));
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no se pudo crear el contexto 2d del canvas"));
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("no se pudo generar el PNG"));
          return;
        }
        downloadBlob(blob, "diagrama.png");
        resolve();
      }, "image/png");
    };
    image.onerror = () => reject(new Error("no se pudo cargar el SVG como imagen"));
    image.src = svgDataUrl(svg);
  });
}
