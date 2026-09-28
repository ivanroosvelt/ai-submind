import { describe, it, expect } from "vitest";
import { renderSequenceToSvg } from "./sequence.js";
import { layoutSequence } from "../layout/sequence.js";
import { parse } from "../parser/index.js";

function renderFirst(source: string): string {
  const { document, catalog } = parse(source);
  return renderSequenceToSvg(layoutSequence(document.blocks[0], catalog));
}

describe("renderSequenceToSvg", () => {
  it("renders participant boxes, lifelines and one message with its label", () => {
    const svg = renderFirst("entity a [Alice]\nentity b [Bob]\nsequence s {\n  a -> b : hola\n}\n");

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g><g class="flo-seq-header-box"><rect x="10" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="80" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Alice</text></g><line x1="80" y1="50" x2="80" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<g><g class="flo-seq-header-box"><rect x="170" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="240" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Bob</text></g><line x1="240" y1="50" x2="240" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<line x1="80" y1="120" x2="240" y2="120" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" /><rect x="142" y="104" width="36" height="16" fill="#ffffff" /><text x="160" y="112" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">hola</text>' +
        "</svg>"
    );
  });

  it("renders an unresolved participant with a dashed box, keeping the sticky-header class", () => {
    const svg = renderFirst("entity a\nsequence s {\n  a -> ghost : x\n}\n");
    expect(svg).toContain('<g class="flo-unresolved"><g class="flo-seq-header-box">');
    expect(svg).toContain('stroke-width="2" stroke-dasharray="4 4" />');
    expect(svg).toContain(">ghost<");
  });
});
