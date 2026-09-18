import { describe, it, expect } from "vitest";
import { escapeXml, arrowMarkerDefs, svgText, ARROW_MARKER_ID } from "./svg.js";

describe("escapeXml", () => {
  it("escapes all five XML special characters", () => {
    expect(escapeXml(`it's <a> & "b"`)).toBe("it&apos;s &lt;a&gt; &amp; &quot;b&quot;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeXml("Mostrar home")).toBe("Mostrar home");
  });
});

describe("arrowMarkerDefs", () => {
  it("defines a marker with the id referenced by ARROW_MARKER_ID", () => {
    const defs = arrowMarkerDefs();
    expect(ARROW_MARKER_ID).toBe("flo-arrow");
    expect(defs).toBe(
      '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>'
    );
  });
});

describe("svgText", () => {
  it("renders a centered text element at the given position", () => {
    expect(svgText(64, 45, "Inicio")).toBe(
      '<text x="64" y="45" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Inicio</text>'
    );
  });

  it("escapes the label content", () => {
    expect(svgText(10, 20, "A & B")).toBe(
      '<text x="10" y="20" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">A &amp; B</text>'
    );
  });
});
