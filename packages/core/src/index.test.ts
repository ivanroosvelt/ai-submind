import { describe, it, expect } from "vitest";
import {
  parse,
  isFlowchartDiagram,
  isSequenceDiagram,
  formatDiagnostic,
  type FlowchartDiagram,
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

  it("records the full declaration range and the name range separately", () => {
    const { diagram } = parse("diagram flowchart\nstart[Inicio]\n");
    const node = (diagram as FlowchartDiagram).nodes[0];
    expect(node.nameRange).toEqual({
      start: { line: 2, column: 1 },
      end: { line: 2, column: 6 },
    });
    expect(node.range).toEqual({
      start: { line: 2, column: 1 },
      end: { line: 2, column: 14 },
    });
  });

  it("records the range of each edge endpoint", () => {
    const { diagram } = parse("diagram flowchart\na[A]\nb[B]\na -> b : ok\n");
    const edge = (diagram as FlowchartDiagram).edges[0];
    expect(edge.fromRange.start).toEqual({ line: 4, column: 1 });
    expect(edge.toRange.start).toEqual({ line: 4, column: 6 });
  });
});
