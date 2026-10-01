import { describe, it, expect } from "vitest";
import { renderSequenceToSvg } from "./sequence.js";
import { layoutSequence } from "../layout/sequence.js";
import { parse } from "../parser/index.js";

function renderFirst(source: string): string {
  const { document, catalog } = parse(source, "doc.flo");
  return renderSequenceToSvg(layoutSequence(document.blocks[0], catalog), { uri: "doc.flo", block: "doc.flo#s" });
}

describe("renderSequenceToSvg", () => {
  it("renders participant boxes, lifelines and one message with its label", () => {
    const svg = renderFirst("entity a [Alice]\nentity b [Bob]\nsequence s {\n  a -> b : hola\n}\n");

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g data-flo-entity="a" data-flo-block="doc.flo#s" data-flo-uri="doc.flo" data-flo-line="4"><g class="flo-seq-header-box"><rect x="10" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="80" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Alice</text></g><line x1="80" y1="50" x2="80" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<g data-flo-entity="b" data-flo-block="doc.flo#s" data-flo-uri="doc.flo" data-flo-line="4"><g class="flo-seq-header-box"><rect x="170" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="240" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Bob</text></g><line x1="240" y1="50" x2="240" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<line x1="80" y1="120" x2="240" y2="120" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" data-flo-from="a" data-flo-to="b" data-flo-block="doc.flo#s" data-flo-uri="doc.flo" data-flo-line="4" /><rect x="142" y="104" width="36" height="16" fill="#ffffff" /><text x="160" y="112" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">hola</text>' +
        "</svg>"
    );
  });

  it("renders an unresolved participant with a dashed box, keeping the sticky-header class", () => {
    const svg = renderFirst("entity a\nsequence s {\n  a -> ghost : x\n}\n");
    expect(svg).toMatch(/<g class="flo-unresolved" data-flo-entity="ghost"[^>]*><g class="flo-seq-header-box">/);
    expect(svg).toContain('stroke-width="2" stroke-dasharray="4 4" />');
    expect(svg).toContain(">ghost<");
  });

  it("draws a message to the same participant as a visible loop (#52)", () => {
    const svg = renderFirst("entity a\nsequence s {\n  a -> a : yo\n}\n");
    expect(svg).toContain('<polyline points="80,120 110,120 110,140 80,140" fill="none" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" data-flo-from="a" data-flo-to="a"');
    expect(svg).toContain('<text x="95" y="112"');
    expect(svg).not.toMatch(/<line x1="80" y1="120" x2="80" y2="120"/);
  });

  it("keeps a final self-message loop inside the lifeline and the SVG", () => {
    const svg = renderFirst("entity a\nentity b\nsequence s {\n  a -> b : x\n  b -> b : y\n}\n");
    // Último mensaje en y=170; el lazo baja a 190; la lifeline termina en 220 y el SVG mide 240.
    expect(svg).toContain('points="240,170 270,170 270,190 240,190"');
    expect(svg).toContain('y2="220"');
    expect(svg).toContain('height="240"');
  });

  it("widens every column to fit the longest participant label (#52)", () => {
    const svg = renderFirst("entity a [Un participante con un nombre largo]\nentity b\nsequence s {\n  a -> b : x\n}\n");
    // 35 caracteres × 8 + 40 = 320 por columna.
    expect(svg).toContain('width="640" height="190"');
    expect(svg).toContain('<rect x="10" y="0" width="300" height="50"');
    expect(svg).toContain('<text x="160" y="25"');
  });

  it("widens the columns to fit the longest message label (#52)", () => {
    const svg = renderFirst("entity a\nentity b\nsequence s {\n  a -> b : un mensaje bastante largo para una columna\n}\n");
    // 42 caracteres × 7 + 28 = 322 por columna.
    expect(svg).toContain('width="644"');
  });
});
