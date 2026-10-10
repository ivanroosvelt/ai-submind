import { describe, it, expect } from "vitest";
import { layoutKnowledge, type KnowledgeLayoutNode } from "./knowledge.js";

const node = (id: string, group: string): KnowledgeLayoutNode => ({ id, group, width: 160, height: 50 });

// Un grafo denso: dos carpetas y una estrella con cruces entre ellas.
const NODES = [
  ...Array.from({ length: 12 }, (_, i) => node(`r${i}`, "requisitos")),
  ...Array.from({ length: 8 }, (_, i) => node(`d${i}`, "decisiones")),
];
const EDGES = [
  ...Array.from({ length: 12 }, (_, i) => ({ from: `r${i}`, to: `d${i % 8}` })),
  ...Array.from({ length: 11 }, (_, i) => ({ from: `r${i}`, to: `r${i + 1}` })),
];

describe("layoutKnowledge", () => {
  it("is deterministic", () => {
    const a = layoutKnowledge(NODES, EDGES);
    const b = layoutKnowledge(NODES, EDGES);
    expect([...a.nodes.entries()]).toEqual([...b.nodes.entries()]);
    expect(a.edges).toEqual(b.edges);
  });

  it("does not overlap nodes and keeps them inside the canvas", () => {
    const { nodes, width, height } = layoutKnowledge(NODES, EDGES);
    const placed = [...nodes.values()];
    for (const n of placed) {
      expect(n.x - n.width / 2).toBeGreaterThanOrEqual(0);
      expect(n.y - n.height / 2).toBeGreaterThanOrEqual(0);
      expect(n.x + n.width / 2).toBeLessThanOrEqual(width);
      expect(n.y + n.height / 2).toBeLessThanOrEqual(height);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const [a, b] = [placed[i], placed[j]];
        const apart = Math.abs(a.x - b.x) >= (a.width + b.width) / 2 || Math.abs(a.y - b.y) >= (a.height + b.height) / 2;
        expect(apart).toBe(true);
      }
    }
  });

  it("is not a long strip: the aspect ratio stays moderate", () => {
    const { width, height } = layoutKnowledge(NODES, EDGES);
    expect(Math.max(width / height, height / width)).toBeLessThan(3);
  });

  it("keeps folder regions apart", () => {
    const { groups } = layoutKnowledge(NODES, EDGES);
    const [a, b] = groups;
    const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
    expect(apart).toBe(true);
  });

  it("draws one region per folder, only with more than one", () => {
    expect(layoutKnowledge(NODES, EDGES).groups.map((group) => group.name)).toEqual(["requisitos", "decisiones"]);
    expect(layoutKnowledge([node("a", "x"), node("b", "x")], [{ from: "a", to: "b" }]).groups).toEqual([]);
  });

  it("clips edges to the node borders and bends parallel ones", () => {
    const { nodes, edges } = layoutKnowledge(
      [node("a", ""), node("b", "")],
      [
        { from: "a", to: "b" },
        { from: "a", to: "b" },
      ]
    );
    const a = nodes.get("a")!;
    const [start] = edges[0];
    const onBorder = Math.abs(Math.abs(start.x - a.x) - a.width / 2) < 0.2 || Math.abs(Math.abs(start.y - a.y) - a.height / 2) < 0.2;
    expect(onBorder).toBe(true);
    expect(edges[0]).toHaveLength(2);
    expect(edges[1]).toHaveLength(3);
  });

  it("gives an empty layout for no nodes", () => {
    expect(layoutKnowledge([], [])).toMatchObject({ width: 0, height: 0, edges: [], groups: [] });
  });
});
