import { describe, it, expect } from "vitest";
import {
  parse,
  isFlowchartDiagram,
  isSequenceDiagram,
  formatDiagnostic,
} from "./index.js";

describe("index", () => {
  it("re-exports the type guards and formatDiagnostic so consumers of parse() can narrow diagrams and format diagnostics", () => {
    const { diagram, diagnostics } = parse("diagram flowchart\nstart[Inicio]\n");
    expect(diagram).not.toBeNull();
    if (diagram) {
      expect(isFlowchartDiagram(diagram)).toBe(true);
      expect(isSequenceDiagram(diagram)).toBe(false);
    }
    expect(diagnostics).toEqual([]);

    const formatted = formatDiagnostic({
      code: "E999",
      message: "prueba",
      range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
      severity: "error",
    });
    expect(formatted).toBe("E999 error [1:1]: prueba");
  });
});
