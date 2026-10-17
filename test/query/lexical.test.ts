// Lexical index (PLAN-002 S6): BM25F ranking on the garage corpus, prefix expansion, modes and
// incremental update equivalent to a rebuild.
import { fileURLToPath } from "node:url";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Engine, type SemanticDiff } from "../../src/engine/index.js";
import { serialize, type Model } from "../../src/format/index.js";
import { LexicalIndex, type LexicalOptions } from "../../src/query/lexical.js";

const GARAGE = fileURLToPath(
  new URL("../../spec/format/examples/valid/garage/knowledge/", import.meta.url),
);

const entries = (e: Engine): [string, ReturnType<Engine["get"]>][] =>
  [...e.ids()].map((id) => [id, e.get(id)]);

function build(e: Engine): LexicalIndex {
  const index = new LexicalIndex();
  index.rebuild(entries(e));
  return index;
}

describe("search on the garage corpus", () => {
  let engine: Engine;
  let index: LexicalIndex;
  const ids = (text: string, options?: LexicalOptions): string[] =>
    index.search(text, options).map((h) => h.id);

  beforeAll(async () => {
    engine = await Engine.open(GARAGE);
    index = build(engine);
  });
  afterAll(() => {
    engine.close();
  });

  it("indexes every ID once: models, diagrams and elements", () => {
    expect(index.size).toBe([...engine.ids()].length);
    expect(ids("garage")).toContain("garage");
    expect(ids("overview")).toContain("overview");
  });

  it("ignores accents and case", () => {
    expect(index.search("vehiculo")).toEqual([
      {
        id: "Car",
        score: expect.any(Number) as number,
        fields: ["documentation"],
        terms: ["vehiculo"],
      },
    ]);
    expect(index.search("VEHÍCULO")).toEqual(index.search("vehiculo"));
  });

  it("searches tags, stereotypes and documentation", () => {
    // garage's documentation ("Car rental. ...") is shorter than Car's tag field is weighted for.
    expect(ids("rental")).toEqual(["garage", "Car"]);
    expect(index.search("rental").find((h) => h.id === "Car")?.fields).toEqual(["tags"]);
    expect(index.search("entity")).toEqual([
      {
        id: "Car",
        score: expect.any(Number) as number,
        fields: ["stereotypes"],
        terms: ["entity"],
      },
    ]);
  });

  it("ranks names and IDs", () => {
    expect(ids("refuel")).toEqual([
      "Car.refuel()",
      "CheckFuel.refuel",
      "Car.refuel().liters",
      "CheckFuel.refuel.receive",
      "CheckFuel.refuel.send",
    ]);
    expect(index.search("refuel")[0]?.fields).toEqual(["name", "id"]);
    expect(ids("fuel")[0]).toBe("Car.fuel");
    expect(ids("fuel type")[0]).toBe("FuelType");
  });

  it("orders by score descending, then by ID, with scores rounded to 6 decimals", () => {
    const hits = index.search("fuel");
    for (let i = 1; i < hits.length; i++) {
      const [a, b] = [hits[i - 1], hits[i]];
      if (!a || !b) continue;
      expect(a.score > b.score || (a.score === b.score && a.id < b.id)).toBe(true);
    }
    for (const h of hits) expect(Math.round(h.score * 1e6) / 1e6).toBe(h.score);
  });

  it("expands query terms of 3+ characters as prefixes unless disabled", () => {
    expect(index.search("veh")).toEqual([
      {
        id: "Car",
        score: expect.any(Number) as number,
        fields: ["documentation"],
        terms: ["vehicle"],
      },
    ]);
    expect(ids("veh", { prefix: false })).toEqual([]);
    expect(ids("ve")).toEqual([]);
    // An exact match is preferred to the expansions of the same term ("fuel" over "fueltype").
    expect(index.search("fuel").find((h) => h.id === "FuelType")?.terms).toEqual(["fuel"]);
    // Expansions score half: the exact term ranks first.
    const exact = index.search("liters")[0]?.score ?? 0;
    expect(index.search("liter")[0]?.score).toBeCloseTo(exact / 2, 5);
  });

  it("returns nothing for unknown terms or text without terms", () => {
    expect(index.search("zzz")).toEqual([]);
    expect(index.search("  ")).toEqual([]);
    expect(index.search("«»")).toEqual([]);
  });

  it("mode all requires every query term", () => {
    const any = ids("car rental");
    expect(any.length).toBeGreaterThan(2);
    expect(ids("car rental", { mode: "all" })).toEqual(["Car", "garage"]);
    expect(index.search("car rental", { mode: "all" })[0]?.terms).toEqual(["car", "rental"]);
    expect(ids("car zzz", { mode: "all" })).toEqual([]);
  });

  it("rebuild replaces the previous content", () => {
    const other = build(engine);
    other.rebuild([]);
    expect(other.size).toBe(0);
    expect(other.search("car")).toEqual([]);
    other.rebuild(entries(engine));
    expect(other.search("fuel")).toEqual(index.search("fuel"));
  });
});

describe("incremental update", () => {
  let dir: string;
  let root: string;
  let engine: Engine;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "ai-submind-lexical-"));
    root = join(dir, "knowledge");
    await cp(GARAGE, root, { recursive: true });
    engine = await Engine.open(root);
  });
  afterAll(async () => {
    engine.close();
    await rm(dir, { recursive: true, force: true });
  });

  const QUERIES: [string, LexicalOptions?][] = [
    ["car"],
    ["auto"],
    ["bicycle"],
    ["vehicle"],
    ["veh"],
    ["vehiculo"],
    ["rental"],
    ["rent", { prefix: false }],
    ["fuel"],
    ["refuel"],
    ["type"],
    ["decimal number"],
    ["car rental", { mode: "all" }],
    ["two wheeled bike", { mode: "all" }],
    ["entity core"],
  ];

  function expectSame(incremental: LexicalIndex): void {
    const fresh = build(engine);
    expect(incremental.size).toBe(fresh.size);
    for (const [text, options] of QUERIES) {
      expect(incremental.search(text, options), text).toEqual(fresh.search(text, options));
    }
  }

  it("matches a rebuild after transactions, renames and external edits", async () => {
    const stepwise = build(engine);
    const batched = build(engine);
    const pending: SemanticDiff[] = [];
    const all: SemanticDiff[] = [];
    engine.on("change", (c) => {
      pending.push(c.diff);
      all.push(c.diff);
    });
    const sync = (): void => {
      for (const d of pending.splice(0)) stepwise.update(d, (id) => engine.get(id));
      expectSame(stepwise);
    };

    expect(stepwise.search("bicycle")).toEqual([]);
    const bikes = {
      format_version: "1.1",
      id: "bikes",
      name: "Bikes",
      elements: {
        classes: [
          {
            id: "Bicycle",
            name: "Bicycle",
            visibility: "public",
            is_abstract: false,
            tags: ["rental"],
            documentation: "Two-wheeled vehicle.",
          },
        ],
      },
    };
    await engine.transact([{ op: "put", path: "models/bikes.json", data: bikes }]);
    sync();
    expect(stepwise.search("bicycle").map((h) => h.id)).toEqual(["Bicycle"]);

    await engine.rename("Car", "Auto");
    sync();
    expect(stepwise.search("auto").map((h) => h.id)).toContain("Auto");
    expect(stepwise.search("car", { prefix: false }).map((h) => h.id)).not.toContain("Car");

    const types = JSON.parse(await readFile(join(root, "models/types.json"), "utf8")) as Model;
    types.documentation = "Shared primitive types, including a decimal number.";
    types.elements?.primitive_types?.push({
      id: "Decimal",
      name: "Decimal",
      visibility: "public",
      kind: "real",
    });
    await writeFile(join(root, "models/types.json"), serialize("model", types));
    await engine.reload();
    sync();
    expect(stepwise.search("decimal").map((h) => h.id)).toEqual(["Decimal", "types"]);

    // A duplicated ID is one document with the fields of every occurrence.
    const dup = { format_version: "1.1", id: "dup", name: "Dup" } as Model;
    dup.elements = {
      classes: [{ id: "Auto", name: "Automobile", visibility: "public", is_abstract: false }],
    };
    await writeFile(join(root, "models/dup.json"), serialize("model", dup));
    await engine.reload();
    sync();
    expect(engine.get("Auto")).toHaveLength(2);
    expect(stepwise.search("automobile").map((h) => h.id)).toEqual(["Auto"]);

    await engine.transact([
      { op: "delete", path: "models/bikes.json" },
      { op: "delete", path: "models/dup.json" },
    ]);
    sync();
    expect(stepwise.search("bicycle")).toEqual([]);

    // All the diffs applied at once, against the final state, give the same result.
    for (const d of all) batched.update(d, (id) => engine.get(id));
    expectSame(batched);
  });
});
