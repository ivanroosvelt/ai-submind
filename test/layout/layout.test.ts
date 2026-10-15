// Shared deterministic layout (PLAN-002 S9; DEC-017, REQ-028, ENT-005): shape sizes from the displayed text
// with fixed font metrics, and dagre auto-layout of class diagrams with the shape of layout/<id>.json.
import { describe, expect, it } from "vitest";
import { serialize } from "../../src/format/canonical.js";
import { parseDocument } from "../../src/format/document.js";
import type { Layout } from "../../src/format/types.js";
import { Engine } from "../../src/engine/index.js";
import { autoLayout, boxSize, classGraph } from "../../src/layout/class-layout.js";
import { CHAR_WIDTH, LINE_HEIGHT, MIN_WIDTH, nodeBox, PAD_X } from "../../src/layout/size.js";
import { createQuery } from "../../src/query/index.js";

const GARAGE = new URL("../../spec/format/examples/valid/garage/knowledge/", import.meta.url)
  .pathname;

async function overview(): Promise<ReturnType<ReturnType<typeof createQuery>["diagram"]>["data"]> {
  const engine = await Engine.open(GARAGE);
  try {
    return createQuery(engine).diagram("overview").data;
  } finally {
    engine.close();
  }
}

const names = (id: string): string | undefined => ({ Integer: "Integer", T: "Text" })[id];

describe("shape size (DEC-017)", () => {
  it("is a pure function of the displayed text: rows, compartments and integer size", () => {
    const node = {
      id: "Car",
      name: "Car",
      visibility: "public",
      stereotypes: ["entity"],
      attributes: [
        {
          id: "Car.year",
          name: "year",
          visibility: "private",
          type: { idref: "Integer" },
          multiplicity: "1",
        },
        { id: "Car.n", name: "n", visibility: "public", is_derived: true, default_value: "0" },
      ],
      operations: [
        {
          id: "Car.drive()",
          name: "drive",
          visibility: "protected",
          parameters: [
            { id: "Car.drive().to", name: "to", type: { idref: "T" } },
            { id: "Car.drive().r", name: "r", direction: "out" },
          ],
          return_type: { idref: "Unknown" },
        },
      ],
    };
    const box = nodeBox("class", node, names);
    expect(box.header).toEqual(["«entity»", "Car"]);
    expect(box.compartments).toEqual([
      ["- year: Integer [1]", "+ /n = 0"],
      ["# drive(to: Text, out r): Unknown"],
    ]);
    const longest = "# drive(to: Text, out r): Unknown".length;
    expect(box.width).toBe(Math.ceil(longest * CHAR_WIDTH + 2 * PAD_X));
    expect(Number.isInteger(box.height)).toBe(true);
    expect(box.rows.map((r) => r.text)).toEqual([...box.header, ...box.compartments.flat()]);
    expect(box.separators).toHaveLength(2);
    expect(box.height).toBeGreaterThanOrEqual(5 * LINE_HEIGHT);
    expect(nodeBox("class", node, names)).toEqual(box);
  });

  it("gives keywords to interfaces, enumerations, data and primitive types; a minimum width", () => {
    const base = { id: "X", name: "X", visibility: "public" };
    expect(nodeBox("interface", base, names).header).toEqual(["«interface»", "X"]);
    expect(nodeBox("data_type", base, names).header).toEqual(["«dataType»", "X"]);
    expect(nodeBox("primitive_type", base, names).compartments).toEqual([]);
    const e = nodeBox("enumeration", { ...base, literals: ["A", "B"] }, names);
    expect(e.header).toEqual(["«enumeration»", "X"]);
    expect(e.compartments).toEqual([["A", "B"]]);
    expect(e.width).toBe(Math.ceil("«enumeration»".length * CHAR_WIDTH + 2 * PAD_X));
    expect(nodeBox("actor", base, names)).toMatchObject({ compartments: [], width: MIN_WIDTH });
    expect(nodeBox("package", base, names).header).toEqual(["X"]);
  });
});

interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlaps = (rects: readonly Rect[]): string[] =>
  rects.flatMap((r, i) =>
    rects
      .slice(i + 1)
      .filter((s) => r.x < s.x + s.w && s.x < r.x + r.w && r.y < s.y + s.h && s.y < r.y + r.h)
      .map((s) => `${r.id}/${s.id}`),
  );

describe("explicit sizes (spec §8)", () => {
  it("are a minimum: the rendered size is never smaller than the content", () => {
    const n = { width: 150, height: 90 };
    expect(boxSize(n, { x: 0, y: 0 })).toEqual({ width: 150, height: 90 });
    expect(boxSize(n, { x: 0, y: 0, width: 100, height: 200 })).toEqual({
      width: 150,
      height: 200,
    });
    expect(boxSize(n, { x: 0, y: 0, width: 300, height: 10 })).toEqual({ width: 300, height: 90 });
  });

  it("the example layout of every class diagram has no overlapping nodes at their real size", async () => {
    const engine = await Engine.open(GARAGE);
    try {
      const query = createQuery(engine);
      for (const d of query.listDiagrams({ kind: "class" }).data.items) {
        const view = query.diagram(d.id).data;
        const g = classGraph(view.elements, (id) => view.names[id]);
        const rects = g.nodes.map((n) => {
          const p = view.layout?.nodes?.[n.id];
          expect(p, `${d.id}: ${n.id} has a position`).toBeDefined();
          const { width, height } = boxSize(n, p ?? { x: 0, y: 0 });
          return { id: n.id, x: p?.x ?? 0, y: p?.y ?? 0, w: width, h: height };
        });
        expect(overlaps(rects), d.id).toEqual([]);
      }
    } finally {
      engine.close();
    }
  });
});

describe("class diagram auto-layout (DEC-017)", () => {
  it("builds the graph of the shown nodes and the relationships between shown nodes", async () => {
    const view = await overview();
    const g = classGraph(view.elements, (id) => view.names[id]);
    expect(g.nodes.map((n) => n.id)).toEqual(
      [
        "Car",
        "Contract",
        "Customer",
        "Drivable",
        "Engine",
        "EngineFailure",
        "Fleet",
        "FuelType",
        "Garage",
        "Integer",
        "Mechanic",
        "Registration",
        "Truck",
      ].sort(),
    );
    expect(g.edges.find((e) => e.id === "Truck--extends--Car")).toMatchObject({
      type: "generalization",
      source: "Truck",
      target: "Car",
    });
    expect(g.edges.find((e) => e.id === "Car--implements--Drivable")).toMatchObject({
      type: "realization",
      source: "Car",
      target: "Drivable",
    });
    expect(g.edges.map((e) => e.id)).toContain("Car--Engine");
  });

  it("is deterministic, integer, canonical and without overlaps; keeps styles and explicit sizes", async () => {
    const view = await overview();
    const a = autoLayout(view);
    const b = autoLayout(structuredClone(view));
    expect(a).toEqual(b);
    expect(a.diagram).toEqual({ idref: "overview" });
    // The output is already canonical: serializing does not reorder or drop anything.
    const text = serialize("layout", a);
    expect(JSON.parse(text)).toEqual(a);
    expect(
      parseDocument("layout/overview.json", "layout", new TextEncoder().encode(text)).status,
    ).toBe("writable");
    const nodes = a.nodes ?? {};
    expect(Object.keys(nodes)).toEqual(Object.keys(nodes).sort());
    expect(Object.keys(nodes)).toHaveLength(13);
    // Car keeps its style and explicit size from the previous layout; vertices are dropped.
    expect(nodes.Car).toMatchObject({ width: 200, height: 140, style: { fill: "#fff8e1" } });
    expect(a.edges?.["Car--Engine"]).toBeUndefined();
    const g = classGraph(view.elements, (id) => view.names[id]);
    const rects = g.nodes.map((n) => {
      const p = nodes[n.id] ?? { x: NaN, y: NaN };
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      const { width, height } = boxSize(n, p);
      return { id: n.id, x: p.x, y: p.y, w: width, h: height };
    });
    expect(overlaps(rects)).toEqual([]);
    // Parents above children: Car above Truck, Drivable above Car.
    expect(nodes.Car?.y ?? 0).toBeLessThan(nodes.Truck?.y ?? 0);
    expect(nodes.Drivable?.y ?? 0).toBeLessThan(nodes.Car?.y ?? 0);
  });

  it("places only the nodes without a position, below the placed ones, when asked to keep them", async () => {
    const view = await overview();
    const layout: Layout = {
      format_version: "1.0",
      diagram: { idref: "overview" },
      nodes: { Car: { x: 10, y: 20 }, Engine: { x: 400, y: 30 } },
    };
    const out = autoLayout({ ...view, layout }, { keep: true });
    const nodes = out.nodes ?? {};
    expect(nodes.Car).toEqual({ x: 10, y: 20 });
    expect(nodes.Engine).toEqual({ x: 400, y: 30 });
    const g = classGraph(view.elements, (id) => view.names[id]);
    const bottom = Math.max(
      ...["Car", "Engine"].map((id) => {
        const n = g.nodes.find((x) => x.id === id);
        return (nodes[id]?.y ?? 0) + (n?.height ?? 0);
      }),
    );
    for (const [id, p] of Object.entries(nodes)) {
      if (id !== "Car" && id !== "Engine") expect(p.y).toBeGreaterThan(bottom);
    }
    expect(Object.keys(nodes)).toHaveLength(13);
  });
});
