import { describe, it, expect } from "vitest";
import { parse, render, formatDiagnostic, escapeXml } from "./index.js";

describe("index", () => {
  it("exposes parse, render, formatDiagnostic and escapeXml", () => {
    expect(parse("entity a\n").document.entities).toHaveLength(1);
    expect(render("entity a\nflow f {\n  a -> a\n}\n").diagrams).toHaveLength(1);
    expect(escapeXml("<a>")).toBe("&lt;a&gt;");
    expect(
      formatDiagnostic({
        code: "E999",
        message: "prueba",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
        severity: "error",
      })
    ).toBe("E999 error [1:1]: prueba");
  });

  it("records the declaration range and the name range of an entity separately", () => {
    const entity = parse("entity start [Inicio]\n").document.entities[0];
    expect(entity.nameRange).toEqual({ start: { line: 1, column: 8 }, end: { line: 1, column: 13 } });
    expect(entity.range).toEqual({ start: { line: 1, column: 1 }, end: { line: 1, column: 22 } });
  });
});
