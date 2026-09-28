import { describe, it, expect } from "vitest";
import { renderFlowchartToSvg } from "./flowchart.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import { parse } from "../parser/index.js";

function renderFirst(source: string): string {
  const { document, catalog } = parse(source);
  return renderFlowchartToSvg(layoutFlowchart(document.blocks[0], catalog));
}

describe("renderFlowchartToSvg", () => {
  it("renders a rectangle, a rounded node and a labeled edge between them", () => {
    const svg = renderFirst("entity start [Inicio]\nentity end (Fin)\nflow f {\n  start -> end : ok\n}\n");

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="200" viewBox="0 0 128 200">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g><rect x="20" y="20" width="88" height="50" rx="0" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="64" y="45" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Inicio</text></g>' +
        '<g><rect x="24" y="130" width="80" height="50" rx="12" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="64" y="155" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Fin</text></g>' +
        '<polyline points="64,70 64,100 64,130" fill="none" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" /><rect x="53" y="84" width="22" height="16" fill="#ffffff" /><text x="64" y="92" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">ok</text>' +
        "</svg>"
    );
  });

  it("renders a decision node as a polygon", () => {
    const svg = renderFirst("entity a [A]\nentity check {OK?}\nflow f {\n  a -> check\n}\n");
    expect(svg).toContain("<polygon points=");
  });

  it("renders an unresolved reference as a dashed, marked placeholder labelled with its name", () => {
    const svg = renderFirst("entity a [A]\nflow f {\n  a -> ghost\n}\n");
    expect(svg).toContain('<g class="flo-unresolved"><rect');
    expect(svg).toContain('stroke-dasharray="4 4"');
    expect(svg).toContain(">ghost<");
    expect(svg).not.toContain("NaN");
  });
});
