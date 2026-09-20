import { describe, it, expect } from "vitest";
import { layoutFlowchart, measureFlowchartNode } from "./flowchart.js";
import type { FlowchartDiagram, Range } from "../ast.js";

// ponytail: layout ignores range/nameRange entirely, so the exact span here is
// irrelevant to these tests — one placeholder stands in for every occurrence.
const RANGE: Range = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

describe("measureFlowchartNode", () => {
  it("sizes a rectangle from its label length", () => {
    expect(measureFlowchartNode("rectangle", "Inicio")).toEqual({ width: 88, height: 50 });
  });

  it("sizes a decision (diamond) wider than a rectangle with the same label", () => {
    expect(measureFlowchartNode("decision", "Login valido")).toEqual({ width: 232, height: 80 });
  });

  it("sizes a rounded node with a short label at the minimum width", () => {
    expect(measureFlowchartNode("rounded", "Fin")).toEqual({ width: 80, height: 50 });
  });
});

describe("layoutFlowchart", () => {
  it("lays out a linear chain top-to-bottom with dagre, sizing each shape correctly", () => {
    const diagram: FlowchartDiagram = {
      kind: "flowchart",
      nodes: [
        { id: "start", shape: "rectangle", label: "Inicio", range: RANGE, nameRange: RANGE },
        { id: "check", shape: "decision", label: "Login valido", range: RANGE, nameRange: RANGE },
        { id: "end", shape: "rounded", label: "Fin", range: RANGE, nameRange: RANGE },
      ],
      edges: [
        { from: "start", to: "check", label: null, range: RANGE, fromRange: RANGE, toRange: RANGE },
        { from: "check", to: "end", label: null, range: RANGE, fromRange: RANGE, toRange: RANGE },
      ],
    };

    const layout = layoutFlowchart(diagram);

    expect(layout).toEqual({
      width: 272,
      height: 340,
      nodes: [
        { id: "start", x: 136, y: 45, width: 88, height: 50 },
        { id: "check", x: 136, y: 170, width: 232, height: 80 },
        { id: "end", x: 136, y: 295, width: 80, height: 50 },
      ],
      edges: [
        {
          from: "start",
          to: "check",
          points: [
            { x: 136, y: 70 },
            { x: 136, y: 100 },
            { x: 136, y: 130 },
          ],
        },
        {
          from: "check",
          to: "end",
          points: [
            { x: 136, y: 210 },
            { x: 136, y: 240 },
            { x: 136, y: 270 },
          ],
        },
      ],
    });
  });

  it("lays out a single node with no edges", () => {
    const diagram: FlowchartDiagram = {
      kind: "flowchart",
      nodes: [{ id: "solo", shape: "rectangle", label: "Solo", range: RANGE, nameRange: RANGE }],
      edges: [],
    };

    const layout = layoutFlowchart(diagram);

    expect(layout).toEqual({
      width: 120,
      height: 90,
      nodes: [{ id: "solo", x: 60, y: 45, width: 80, height: 50 }],
      edges: [],
    });
  });
});
