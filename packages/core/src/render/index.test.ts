import { describe, it, expect } from "vitest";
import { render } from "./index.js";

describe("render", () => {
  it("returns no diagrams and no diagnostics for an empty file", () => {
    expect(render("")).toEqual({ diagrams: [], diagnostics: [] });
  });

  it("renders one diagram per block, in source order, with name, title and kind", () => {
    const source = [
      "entity a [A]",
      "entity b [B]",
      'flow uno "Primero" {',
      "  a -> b",
      "}",
      "sequence dos {",
      "  a -> b : hola",
      "}",
      "",
    ].join("\n");

    const { diagrams, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(diagrams.map((d) => [d.name, d.title, d.kind])).toEqual([
      ["uno", "Primero", "flow"],
      ["dos", null, "sequence"],
    ]);
    expect(diagrams[0].svg).toContain(">A<");
    expect(diagrams[1].svg).toContain('class="flo-seq-header-box"');
  });

  it("renders an entity the same way in every block that uses it", () => {
    const { diagrams } = render("entity db {Base}\nentity a\nflow x {\n  a -> db\n}\nflow y {\n  db -> a\n}\n");
    for (const diagram of diagrams) {
      expect(diagram.svg).toContain("<polygon");
      expect(diagram.svg).toContain(">Base<");
    }
  });

  it("still renders the block when an edge line has a recoverable error", () => {
    const { diagrams, diagnostics } = render("entity start [Inicio]\nentity b\nflow f {\n  start -> b\n  start ->\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E014"]);
    expect(diagrams[0].svg).toContain(">Inicio<");
  });

  it("renders a block with an unresolved reference (E030) with finite coordinates", () => {
    const { diagrams, diagnostics } = render("entity start [Inicio]\nflow f {\n  start -> ghost\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E030"]);
    expect(diagrams[0].svg).toContain('class="flo-unresolved"');
    expect(diagrams[0].svg).not.toContain("NaN");
  });

  it("computes finite dimensions for an empty block", () => {
    const { diagrams, diagnostics } = render("flow f {\n}\n");
    expect(diagnostics).toEqual([]);
    expect(diagrams[0].svg).not.toContain("Infinity");
    expect(diagrams[0].svg).not.toContain("NaN");
  });

  it("keeps both labels when two edges share the same from/to pair", () => {
    const { diagrams, diagnostics } = render("entity a\nentity b\nflow f {\n  a -> b : si\n  a -> b : no\n}\n");
    expect(diagnostics).toEqual([]);
    expect(diagrams[0].svg).toContain(">si<");
    expect(diagrams[0].svg).toContain(">no<");
  });
});
