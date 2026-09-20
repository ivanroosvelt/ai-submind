import { describe, it, expect } from "vitest";
import { renderSequenceToSvg } from "./sequence.js";
import { layoutSequence } from "../layout/sequence.js";
import type { SequenceDiagram } from "../ast.js";

describe("renderSequenceToSvg", () => {
  it("renders participant boxes, lifelines and one message with its label", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [
        { id: "a", label: "Alice", position: { line: 1, column: 1 } },
        { id: "b", label: "Bob", position: { line: 2, column: 1 } },
      ],
      messages: [{ from: "a", to: "b", label: "hola", position: { line: 3, column: 1 } }],
    };
    const layout = layoutSequence(diagram);

    const svg = renderSequenceToSvg(diagram, layout);

    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190">' +
        '<defs><marker id="flo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" /></marker></defs>' +
        '<g><g class="flo-seq-header-box"><rect x="10" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="80" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Alice</text></g><line x1="80" y1="50" x2="80" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<g><g class="flo-seq-header-box"><rect x="170" y="0" width="140" height="50" fill="#eff6ff" stroke="#1f2937" stroke-width="2" /><text x="240" y="25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">Bob</text></g><line x1="240" y1="50" x2="240" y2="170" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4" /></g>' +
        '<line x1="80" y1="120" x2="240" y2="120" stroke="#1f2937" stroke-width="2" marker-end="url(#flo-arrow)" /><rect x="142" y="104" width="36" height="16" fill="#ffffff" /><text x="160" y="112" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">hola</text>' +
        "</svg>"
    );
  });

  it("renders a diagram with no messages, keeping just the participant boxes and lifelines", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [{ id: "a", label: "a", position: { line: 1, column: 1 } }],
      messages: [],
    };
    const layout = layoutSequence(diagram);

    const svg = renderSequenceToSvg(diagram, layout);

    expect(svg).toContain('<line x1="80" y1="50" x2="80" y2="120"');
    expect(svg).not.toContain("marker-end");
  });
});
