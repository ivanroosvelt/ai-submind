import { describe, it, expect } from "vitest";
import { isFlowchartDiagram, isSequenceDiagram, type Diagram } from "./ast.js";

describe("diagram type guards", () => {
  const flowchart: Diagram = { kind: "flowchart", nodes: [], edges: [] };
  const sequence: Diagram = { kind: "sequence", participants: [], messages: [] };

  it("isFlowchartDiagram narrows flowchart diagrams", () => {
    expect(isFlowchartDiagram(flowchart)).toBe(true);
    expect(isFlowchartDiagram(sequence)).toBe(false);
  });

  it("isSequenceDiagram narrows sequence diagrams", () => {
    expect(isSequenceDiagram(sequence)).toBe(true);
    expect(isSequenceDiagram(flowchart)).toBe(false);
  });
});
