// Shared sequence-diagram geometry and auto-layout (PLAN-002 S11; DEC-018, REQ-040, ENT-005): rows in
// temporal order, message shapes by sort and kind, executions, fragments and interaction uses, and the
// layout document with lifeline x, width and height only.
import { describe, expect, it } from "vitest";
import { serialize } from "../../src/format/canonical.js";
import { parseDocument } from "../../src/format/document.js";
import type { Layout } from "../../src/format/types.js";
import { Engine } from "../../src/engine/index.js";
import type { DiagramInput } from "../../src/layout/class-layout.js";
import {
  autoLayoutSequence,
  sequenceGeometry,
  type SequenceGeometry,
} from "../../src/layout/sequence-layout.js";
import { createQuery } from "../../src/query/index.js";

const EXAMPLES = new URL("../../spec/format/examples/", import.meta.url);
const GARAGE = new URL("valid/garage/knowledge/", EXAMPLES).pathname;
const CANONICAL = new URL("canonical/expected/", EXAMPLES).pathname;

async function view(root: string, id: string): Promise<DiagramInput> {
  const engine = await Engine.open(root);
  try {
    return createQuery(engine).diagram(id).data;
  } finally {
    engine.close();
  }
}

const by = <T extends { id: string }>(list: readonly T[], id: string): T => {
  const x = list.find((e) => e.id === id);
  if (!x) throw new Error(`no ${id}`);
  return x;
};
const first = (g: SequenceGeometry, id: string): { x: number; y: number } =>
  by(g.messages, id).points[0] ?? { x: NaN, y: NaN };
const last = (g: SequenceGeometry, id: string): { x: number; y: number } =>
  by(g.messages, id).points.at(-1) ?? { x: NaN, y: NaN };
const cx = (g: SequenceGeometry, id: string): number => {
  const l = by(g.lifelines, id);
  return l.x + l.width / 2;
};

/** Sequence diagram showing a hand-built interaction. */
const seq = (inter: Record<string, unknown>): DiagramInput => ({
  diagram: { id: "d" },
  elements: [{ id: String(inter.id), type: "interaction", node: inter }],
  names: {},
  layout: null,
  formatVersion: "1.0",
});

interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
const overlaps = (rects: readonly Rect[]): string[] =>
  rects.flatMap((r, i) =>
    rects
      .slice(i + 1)
      .filter(
        (s) =>
          r.x < s.x + s.width &&
          s.x < r.x + r.width &&
          r.y < s.y + s.height &&
          s.y < r.y + r.height,
      )
      .map((s) => `${r.id}/${s.id}`),
  );
const headers = (g: SequenceGeometry): Rect[] =>
  g.lifelines.map((l) => ({ id: l.id, x: l.x, y: l.y, width: l.width, height: l.headerHeight }));

describe("sequence geometry: rent-car (create, delete, self, lost, reply, executions, ref)", () => {
  it("lifelines: header text, persisted x order, created and destroyed lifelines", async () => {
    const g = sequenceGeometry(await view(GARAGE, "rent-car"));
    expect(g.lifelines.map((l) => l.id)).toEqual([
      "RentCar.customer",
      "RentCar.garage",
      "RentCar.car",
      "RentCar.contract",
    ]);
    expect(g.lifelines.map((l) => l.rows.map((r) => r.text))).toEqual([
      ["customer : Customer"],
      ["garage : Garage"],
      [": Car"],
      ["contract : Contract"],
    ]);
    expect(by(g.lifelines, "RentCar.customer").x).toBe(40);
    // The created lifeline starts at the row of its create message, centered on it.
    const contract = by(g.lifelines, "RentCar.contract");
    const create = first(g, "RentCar.create");
    expect(contract.created).toBe(true);
    expect(contract.y + contract.headerHeight / 2).toBe(create.y);
    expect(last(g, "RentCar.create")).toEqual({ x: contract.x, y: create.y });
    expect(by(g.lifelines, "RentCar.garage").y).toBeLessThan(contract.y);
    // The destroyed lifeline ends at the row of its delete message, with an X.
    expect(contract.destroyed).toBe(true);
    expect(contract.bottom).toBe(last(g, "RentCar.destroy").y);
    // `height` is a minimum length: customer is 600 long, never shorter than its events.
    const customer = by(g.lifelines, "RentCar.customer");
    expect(customer.bottom - customer.y).toBeGreaterThanOrEqual(600);
    for (const l of g.lifelines) expect(l.bottom).toBeLessThanOrEqual(g.height);
    expect(by(g.lifelines, "RentCar.car").bottom).toBeGreaterThan(last(g, "RentCar.rent-2").y);
  });

  it("messages: rows in temporal order, send and receive share a row, shapes by sort and kind", async () => {
    const g = sequenceGeometry(await view(GARAGE, "rent-car"));
    const order = [
      "RentCar.rent",
      "RentCar.create",
      "RentCar.start",
      "RentCar.canDrive",
      "RentCar.log",
      "RentCar.destroy",
      "RentCar.rent-2",
    ];
    const ys = order.map((id) => first(g, id).y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(new Set(ys).size).toBe(ys.length);
    for (const id of ["RentCar.rent", "RentCar.start", "RentCar.rent-2"])
      expect(last(g, id).y).toBe(first(g, id).y);
    expect(by(g.messages, "RentCar.rent")).toMatchObject({
      label: "rent(customer)",
      line: "solid",
      head: "filled",
      lost: false,
      found: false,
    });
    expect(by(g.messages, "RentCar.rent-2")).toMatchObject({ line: "dashed", head: "open" });
    expect(by(g.messages, "RentCar.create")).toMatchObject({ line: "dashed", head: "open" });
    expect(by(g.messages, "RentCar.destroy")).toMatchObject({ line: "solid", head: "open" });
    // Arrows go left to right or right to left between the lifeline lines (or their executions).
    expect(first(g, "RentCar.rent").x).toBeLessThan(last(g, "RentCar.rent").x);
    expect(first(g, "RentCar.rent-2").x).toBeGreaterThan(last(g, "RentCar.rent-2").x);
    // A self-message loops to the right over two rows.
    const self = by(g.messages, "RentCar.canDrive").points;
    expect(self).toHaveLength(4);
    expect(self[1]?.x).toBeGreaterThan(cx(g, "RentCar.car"));
    expect(self[3]?.y).toBeGreaterThan(self[0]?.y ?? Infinity);
    // A lost message ends in a filled circle to the right of its sender.
    const log = by(g.messages, "RentCar.log");
    expect(log).toMatchObject({ lost: true, found: false });
    expect(log.points).toHaveLength(2);
    expect(last(g, "RentCar.log").x).toBeGreaterThan(cx(g, "RentCar.garage"));
  });

  it("executions: from start to finish row, nested ones shifted; arrows end at their edges", async () => {
    const g = sequenceGeometry(await view(GARAGE, "rent-car"));
    const garage = by(g.executions, "RentCar.rent.receive.exec");
    expect(garage).toMatchObject({ lifeline: "RentCar.garage", depth: 0 });
    expect(garage.y).toBe(first(g, "RentCar.rent").y);
    expect(garage.y + garage.height).toBe(first(g, "RentCar.rent-2").y);
    expect(garage.x + garage.width / 2).toBe(cx(g, "RentCar.garage"));
    // The rent call arrives at the left edge of garage's execution.
    expect(last(g, "RentCar.rent").x).toBe(garage.x);
    // A call without reply: car's execution ends at the self call.
    const car = by(g.executions, "RentCar.start.receive.exec");
    expect(car.y).toBe(first(g, "RentCar.start").y);
    expect(car.y + car.height).toBe(last(g, "RentCar.canDrive").y);
    const nested = by(g.executions, "RentCar.canDrive.receive.exec");
    expect(nested.depth).toBe(1);
    expect(nested.x).toBeGreaterThan(car.x);
    expect(nested.y).toBe(last(g, "RentCar.canDrive").y);
    expect(nested.height).toBeGreaterThan(0);
    expect(last(g, "RentCar.canDrive").x).toBe(nested.x + nested.width);
  });

  it("interaction use: a ref box over its covered lifelines with the used interaction's name", async () => {
    const g = sequenceGeometry(await view(GARAGE, "rent-car"));
    const ref = by(g.fragments, "RentCar.ref--CheckFuel");
    expect(ref).toMatchObject({
      type: "interaction_use",
      label: "ref",
      text: "CheckFuel",
      interaction: "CheckFuel",
      operands: [],
    });
    expect(ref.x).toBeLessThan(cx(g, "RentCar.garage"));
    expect(ref.x + ref.width).toBeGreaterThan(cx(g, "RentCar.car"));
    expect(ref.x).toBeGreaterThan(cx(g, "RentCar.customer"));
    expect(ref.y).toBeGreaterThan(first(g, "RentCar.create").y);
    expect(ref.y + ref.height).toBeLessThan(first(g, "RentCar.start").y);
  });
});

describe("sequence geometry: check-fuel (nested fragments, found, unknown)", () => {
  it("nests alt inside opt with indentation, operands with guards, found and lost-less stubs", async () => {
    const g = sequenceGeometry(await view(GARAGE, "check-fuel"));
    const opt = by(g.fragments, "CheckFuel.opt");
    const alt = by(g.fragments, "CheckFuel.alt");
    expect(opt).toMatchObject({ type: "combined_fragment", label: "opt", depth: 0 });
    expect(alt).toMatchObject({ label: "alt", depth: 1 });
    expect(opt.operands.map((o) => o.guard)).toEqual(["[fuel < 10%]"]);
    expect(alt.operands.map((o) => o.guard)).toEqual(["[fuel == Electric]", "[else]"]);
    expect(opt.x).toBeLessThan(alt.x);
    expect(opt.x + opt.width).toBeGreaterThan(alt.x + alt.width);
    expect(opt.y).toBeLessThan(alt.y);
    expect(opt.y + opt.height).toBeGreaterThan(alt.y + alt.height);
    // Second operand: separator between the charge and the refuel rows.
    const sep = alt.operands[1]?.y ?? NaN;
    expect(sep).toBeGreaterThan(first(g, "CheckFuel.charge").y);
    expect(sep).toBeLessThan(first(g, "CheckFuel.refuel").y);
    expect(first(g, "CheckFuel.charge").y).toBeGreaterThan(alt.y);
    expect(by(g.messages, "CheckFuel.alarm")).toMatchObject({ found: true, lost: false });
    expect(first(g, "CheckFuel.alarm").x).toBeLessThan(cx(g, "CheckFuel.garage"));
    expect(by(g.messages, "CheckFuel.ping")).toMatchObject({ found: false, lost: false });
    expect(by(g.messages, "CheckFuel.fuelLevel")).toMatchObject({ line: "solid", head: "open" });
    expect(g.executions).toEqual([]);
    // Without a layout, lifelines follow the array order.
    expect(cx(g, "CheckFuel.garage")).toBeLessThan(cx(g, "CheckFuel.car"));
  });
});

describe("sequence geometry: canonical sequence (opt around a receive, ref, lost reply)", () => {
  it("draws a message whose events are in different rows as a slanted line", async () => {
    const g = sequenceGeometry(await view(CANONICAL, "order-flow"));
    expect(first(g, "Order.place").y).toBeLessThan(last(g, "Order.place").y);
    const opt = by(g.fragments, "Order.opt");
    expect(last(g, "Order.place").y).toBeGreaterThan(opt.y);
    expect(last(g, "Order.place").y).toBeLessThan(opt.y + opt.height);
    expect(by(g.fragments, "Order.ref--Pay")).toMatchObject({ text: "Pay" });
    expect(by(g.messages, "Order.ack")).toMatchObject({ lost: true, line: "dashed" });
    expect(by(g.executions, "Order.place.receive.exec").height).toBeGreaterThan(0);
    expect(by(g.executions, "Order.place.send.exec").height).toBeGreaterThan(0);
  });
});

describe("sequence auto-layout (DEC-018)", () => {
  it("is deterministic, canonical and without header overlaps; keeps styles and explicit sizes", async () => {
    const v = await view(GARAGE, "rent-car");
    const a = autoLayoutSequence(v);
    expect(autoLayoutSequence(structuredClone(v))).toEqual(a);
    const text = serialize("layout", a);
    expect(JSON.parse(text)).toEqual(a);
    expect(
      parseDocument("layout/rent-car.json", "layout", new TextEncoder().encode(text)).status,
    ).toBe("writable");
    const nodes = a.nodes ?? {};
    expect(Object.keys(nodes)).toEqual(Object.keys(nodes).sort());
    expect(Object.keys(nodes)).toHaveLength(4);
    expect(nodes["RentCar.customer"]).toMatchObject({ width: 120, height: 600 });
    expect(nodes["RentCar.garage"]).toMatchObject({ width: 120 });
    expect(a.edges).toBeUndefined();
    const g = sequenceGeometry({ ...v, layout: a });
    expect(overlaps(headers(g))).toEqual([]);
    // y is derived: the header top, or the create row for a created lifeline.
    for (const l of g.lifelines) expect(nodes[l.id]?.y).toBe(l.y);
    // Messages between neighbours have room for their labels.
    const rent = by(g.messages, "RentCar.rent");
    expect(last(g, "RentCar.rent").x - first(g, "RentCar.rent").x).toBeGreaterThan(
      rent.label.length * 7.5,
    );
  });

  it("orders lifelines by their current x, drops orphan entries and keeps only edge styles", async () => {
    const v = await view(GARAGE, "rent-car");
    const layout: Layout = {
      format_version: "1.0",
      diagram: { idref: "rent-car" },
      nodes: {
        "RentCar.car": { x: 0, y: 500, style: { fill: "#ffeeee" } },
        "RentCar.customer": { x: 300, y: 20 },
        Nope: { x: 1, y: 1 },
      },
      edges: { "RentCar.rent": { vertices: [{ x: 1, y: 2 }], style: { stroke: "#ff0000" } } },
    };
    const a = autoLayoutSequence({ ...v, layout });
    expect(Object.keys(a.nodes ?? {})).not.toContain("Nope");
    expect(a.edges).toEqual({ "RentCar.rent": { style: { stroke: "#ff0000" } } });
    const g = sequenceGeometry({ ...v, layout: a });
    expect([...g.lifelines].sort((p, q) => p.x - q.x).map((l) => l.id)).toEqual([
      "RentCar.car",
      "RentCar.customer",
      "RentCar.garage",
      "RentCar.contract",
    ]);
    expect(a.nodes?.["RentCar.car"]).toMatchObject({ style: { fill: "#ffeeee" } });
    expect(overlaps(headers(g))).toEqual([]);
  });

  it("with keep, lifelines with a position keep it and the others go to their right", async () => {
    const v = await view(GARAGE, "rent-car");
    const layout: Layout = {
      format_version: "1.0",
      diagram: { idref: "rent-car" },
      nodes: { "RentCar.garage": { x: 500, y: 0 } },
    };
    const a = autoLayoutSequence({ ...v, layout }, { keep: true });
    expect(a.nodes?.["RentCar.garage"]?.x).toBe(500);
    for (const id of ["RentCar.customer", "RentCar.car", "RentCar.contract"])
      expect(a.nodes?.[id]?.x).toBeGreaterThan(500);
    expect(overlaps(headers(sequenceGeometry({ ...v, layout: a })))).toEqual([]);
  });

  it("with keep, existing entries stay as they are (orphans included); only new lifelines are added", async () => {
    const v = await view(GARAGE, "rent-car");
    const layout: Layout = {
      format_version: "1.0",
      diagram: { idref: "rent-car" },
      nodes: {
        "RentCar.contract": { x: 640, y: 120 },
        "RentCar.garage": { x: 240, y: 7, width: 130, style: { fill: "#eeeeee" } },
        Gone: { x: 1, y: 2, height: 50 },
      },
      edges: {
        "RentCar.rent": { style: { stroke: "#ff0000" } },
        Old: { style: { stroke: "#00ff00" } },
      },
    };
    const a = autoLayoutSequence({ ...v, layout: structuredClone(layout) }, { keep: true });
    const nodes = a.nodes ?? {};
    for (const [id, entry] of Object.entries(layout.nodes ?? {})) expect(nodes[id]).toEqual(entry);
    expect(a.edges).toEqual(layout.edges);
    expect(Object.keys(nodes)).toEqual([
      "Gone",
      "RentCar.car",
      "RentCar.contract",
      "RentCar.customer",
      "RentCar.garage",
    ]);
    // New entries: x to the right of the placed ones and the derived header y.
    const g = sequenceGeometry({ ...v, layout: a });
    for (const id of ["RentCar.car", "RentCar.customer"]) {
      expect(nodes[id]).toEqual({ x: by(g.lifelines, id).x, y: by(g.lifelines, id).y });
      expect(nodes[id]?.x).toBeGreaterThan(640);
    }
  });

  it("chained executions on a lifeline (finish of one = start of the next) are not nested", async () => {
    const v = structuredClone(await view(GARAGE, "rent-car"));
    const inter = v.elements.find((e) => e.type === "interaction")?.node as Record<string, unknown>;
    const exec = (id: string, start: string, finish: string): Record<string, unknown> => ({
      id,
      covered: { idref: "RentCar.car" },
      start: { idref: start },
      finish: { idref: finish },
    });
    inter.executions = [
      exec("A", "RentCar.start.receive", "RentCar.canDrive.send"),
      exec("B", "RentCar.canDrive.send", "RentCar.canDrive.receive"),
    ];
    const g = sequenceGeometry(v);
    const a = by(g.executions, "A");
    const b = by(g.executions, "B");
    expect(a.y + a.height).toBe(b.y);
    expect([a.depth, b.depth]).toEqual([0, 0]);
    expect(b.x).toBe(a.x);
  });

  it("an interaction without lifelines has finite fragment geometry", () => {
    const g = sequenceGeometry(
      seq({
        id: "I",
        fragments: [
          {
            id: "I.opt",
            type: "combined_fragment",
            operator: "opt",
            operands: [{ id: "I.opt.op1", guard: "x", fragments: [] }],
          },
        ],
      }),
    );
    const f = by(g.fragments, "I.opt");
    for (const n of [f.x, f.y, f.width, f.height, g.width, g.height])
      expect(Number.isFinite(n)).toBe(true);
  });

  it("a lifeline with ID __proto__ keeps its layout entry, with and without keep", () => {
    const v = seq({
      id: "I",
      lifelines: [
        { id: "__proto__", name: "p" },
        { id: "I.b", name: "b" },
      ],
      fragments: [],
    });
    const a = autoLayoutSequence(v);
    expect(Object.hasOwn(a.nodes ?? {}, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(a.nodes)).toBe(Object.prototype);
    expect(serialize("layout", a)).toContain('"__proto__"');
    const prev = JSON.parse('{"__proto__": {"x": 300, "y": 20}}') as Record<string, never>;
    const layout: Layout = { format_version: "1.0", diagram: { idref: "d" }, nodes: prev };
    const k = autoLayoutSequence({ ...v, layout }, { keep: true });
    expect(Object.hasOwn(k.nodes ?? {}, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(k.nodes, "__proto__")?.value).toEqual({ x: 300, y: 20 });
    expect(Object.keys(k.nodes ?? {})).toEqual(["I.b", "__proto__"]);
  });

  it("a diagram that is not a sequence diagram has an empty geometry", async () => {
    const g = sequenceGeometry(await view(GARAGE, "overview"));
    expect(g).toMatchObject({ lifelines: [], messages: [], executions: [], fragments: [] });
  });
});
