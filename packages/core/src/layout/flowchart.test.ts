import { describe, it, expect } from "vitest";
import { measureFlowchartNode, layoutFlowchart } from "./flowchart.js";
import { parse } from "../parser/index.js";

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

function firstBlock(source: string) {
  const { document, catalog } = parse(source);
  return { block: document.blocks[0], catalog };
}

describe("layoutFlowchart", () => {
  it("lays out a linear chain top-to-bottom with dagre, sizing each shape correctly", () => {
    const { block, catalog } = firstBlock(
      "entity start [Inicio]\nentity check {Login valido}\nentity end (Fin)\nflow f {\n  start -> check\n  check -> end\n}\n"
    );

    expect(layoutFlowchart(block, catalog)).toEqual({
      width: 272,
      height: 340,
      nodes: [
        { id: "start", label: "Inicio", shape: "rectangle", resolved: true, x: 136, y: 45, width: 88, height: 50 },
        { id: "check", label: "Login valido", shape: "decision", resolved: true, x: 136, y: 170, width: 232, height: 80 },
        { id: "end", label: "Fin", shape: "rounded", resolved: true, x: 136, y: 295, width: 80, height: 50 },
      ],
      edges: [
        { from: "start", to: "check", label: null, points: [{ x: 136, y: 70 }, { x: 136, y: 100 }, { x: 136, y: 130 }] },
        { from: "check", to: "end", label: null, points: [{ x: 136, y: 210 }, { x: 136, y: 240 }, { x: 136, y: 270 }] },
      ],
    });
  });

  it("orders nodes by catalog declaration, not by first use in the edges", () => {
    const { block, catalog } = firstBlock("entity b\nentity a\nflow f {\n  a -> b\n}\n");
    expect(layoutFlowchart(block, catalog).nodes.map((n) => n.id)).toEqual(["b", "a"]);
  });

  it("includes only the entities the block references", () => {
    const { block, catalog } = firstBlock("entity a\nentity b\nentity unused\nflow f {\n  a -> b\n}\n");
    expect(layoutFlowchart(block, catalog).nodes.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("adds a visible, finite placeholder for an unresolved reference, after the resolved nodes", () => {
    const { block, catalog } = firstBlock("entity a [A]\nflow f {\n  ghost -> a\n}\n");
    const layout = layoutFlowchart(block, catalog);
    expect(layout.nodes.map((n) => [n.id, n.label, n.shape, n.resolved])).toEqual([
      ["a", "A", "rectangle", true],
      ["ghost", "ghost", "rectangle", false],
    ]);
    expect(layout.nodes[1].width).toBeGreaterThan(1);
    expect(layout.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(Number.isFinite(layout.width) && Number.isFinite(layout.height)).toBe(true);
  });

  it("lays out an empty block with finite dimensions", () => {
    const { block, catalog } = firstBlock("flow f {\n}\n");
    const layout = layoutFlowchart(block, catalog);
    expect(layout.nodes).toEqual([]);
    expect(Number.isFinite(layout.width) && Number.isFinite(layout.height)).toBe(true);
  });
});
