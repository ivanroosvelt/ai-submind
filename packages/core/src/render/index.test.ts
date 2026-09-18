import { describe, it, expect } from "vitest";
import { render } from "./index.js";

describe("render", () => {
  it("returns svg: null and the parse diagnostics for an empty file", () => {
    const { svg, diagnostics } = render("");
    expect(svg).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("E003");
  });

  it("renders a full flowchart end to end, with no diagnostics", () => {
    const source = [
      "diagram flowchart",
      "",
      "start[Inicio]",
      "end(Fin)",
      "",
      "start -> end : ok",
      "",
    ].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<svg");
    expect(svg).toContain(">Inicio<");
    expect(svg).toContain(">Fin<");
    expect(svg).toContain(">ok<");
  });

  it("renders a full sequence diagram end to end, with no diagnostics", () => {
    const source = [
      "diagram sequence",
      "",
      "participant user as Usuario",
      "participant api as API",
      "",
      "user -> api : POST /login",
      "",
    ].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<svg");
    expect(svg).toContain(">Usuario<");
    expect(svg).toContain(">API<");
    expect(svg).toContain(">POST /login<");
  });

  it("still renders the partial diagram when the body has a recoverable error", () => {
    const source = ["diagram flowchart", "", "start[Inicio]", "start ->", ""].join("\n");

    const { svg, diagnostics } = render(source);

    expect(diagnostics.some((diagnostic) => diagnostic.code === "E014")).toBe(true);
    expect(svg).not.toBeNull();
    expect(svg).toContain(">Inicio<");
  });
});
