// Structural queries (PLAN-002 S6): models, diagrams, get, find, relations, impact, paths and the
// facade's lexical search with incremental updates.
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { serialize, type Model } from "../../src/format/index.js";
import { Engine } from "../../src/engine/index.js";
import {
  createQuery,
  LexicalIndex,
  QueryError,
  type GraphPath,
  type Query,
  type QueryErrorCode,
} from "../../src/query/index.js";

const GARAGE = new URL("../../spec/format/examples/valid/garage/knowledge/", import.meta.url)
  .pathname;

const dirs: string[] = [];
const engines: Engine[] = [];

/** Engine and query over a fresh copy of the garage corpus. */
async function setup(
  prepare?: (root: string) => Promise<void>,
): Promise<{ engine: Engine; q: Query; root: string }> {
  const dir = await mkdtemp(join(tmpdir(), "ai-submind-query-"));
  dirs.push(dir);
  const root = join(dir, "knowledge");
  await cp(GARAGE, root, { recursive: true });
  if (prepare) await prepare(root);
  const engine = await Engine.open(root);
  engines.push(engine);
  return { engine, q: createQuery(engine), root };
}

async function cleanup(): Promise<void> {
  for (const e of engines.splice(0)) e.close();
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
}

function fails(fn: () => unknown, code: QueryErrorCode): QueryError {
  let error: unknown;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(QueryError);
  expect((error as QueryError).code).toBe(code);
  return error as QueryError;
}

const readModel = async (root: string, rel: string): Promise<Model> =>
  JSON.parse(await readFile(join(root, rel), "utf8")) as Model;

const route = (p: GraphPath): string => p.nodes.join(" > ");

describe("queries over the garage corpus", () => {
  let q: Query;
  beforeAll(async () => {
    ({ q } = await setup());
  });
  afterAll(cleanup);

  const ids = (f: Parameters<Query["find"]>[0]): string[] => q.find(f).data.items.map((x) => x.id);

  it("lists models with counts, validity and clean metadata", () => {
    const r = q.listModels();
    expect(r.meta).toMatchObject({ state: "ok", excluded: [], readOnly: [] });
    expect(r.data.items).toEqual([
      {
        id: "garage",
        name: "Garage",
        file: "models/garage.json",
        status: "writable",
        loaded: true,
        valid: true,
        errors: 0,
        warnings: 0,
        elements: 89,
        diagrams: 3,
      },
      {
        id: "types",
        name: "Types",
        file: "models/types.json",
        status: "writable",
        loaded: true,
        valid: true,
        errors: 0,
        warnings: 0,
        elements: 4,
        diagrams: 0,
      },
    ]);
    expect(r.data).toMatchObject({ total: 2, offset: 0, limit: 100, nextOffset: null });
  });

  it("lists diagrams with kind, layout and element count", () => {
    const items = q.listDiagrams().data.items;
    expect(items.map((d) => [d.id, d.kind, d.layout?.path ?? null])).toEqual([
      ["check-fuel", "sequence", null],
      ["overview", "class", "layout/overview.json"],
      ["rent-car", "sequence", "layout/rent-car.json"],
    ]);
    expect(items.find((d) => d.id === "overview")).toMatchObject({
      model: "garage",
      valid: true,
      elements: 19,
      layout: { path: "layout/overview.json", status: "writable" },
    });
    expect(q.listDiagrams({ kind: "class" }).data.items.map((d) => d.id)).toEqual(["overview"]);
    expect(q.listDiagrams({ model: "types" }).data.total).toBe(0);
    fails(() => q.listDiagrams({ model: "Nope" }), "NOT_FOUND");
    fails(() => q.listDiagrams({ kind: "state" as "class" }), "INVALID_ARGUMENT");
  });

  it("gets an element with location, parent, package and children", () => {
    expect(q.get("Car.refuel().liters").data).toMatchObject({
      id: "Car.refuel().liters",
      type: "parameter",
      name: "liters",
      parent: "Car.refuel()",
      model: "garage",
      file: "models/garage.json",
      pointer: "/elements/classes/0/operations/1/parameters/0",
      children: [],
      readOnly: false,
    });
    const car = q.get("Car").data;
    expect(car.package).toBe("Fleet");
    expect(car.parent).toBe("garage");
    expect(car.children).toEqual([
      "Car.canDrive()",
      "Car.fuel",
      "Car.mileage",
      "Car.refuel()",
      "Car.registration",
      "Car.start()",
      "Car.yearOfProduction",
    ]);
    expect(q.get("Car--Engine.end2").data.name).toBe("engine");
    expect(q.get("garage").data.model).toBe("garage");
    expect(fails(() => q.get("Nope"), "NOT_FOUND").details.id).toBe("Nope");
  });

  it("finds by type, package, model, tags, stereotypes and code references", () => {
    expect(ids({ type: "class" })).toEqual([
      "Car",
      "Contract",
      "Engine",
      "EngineFailure",
      "Garage",
      "Mechanic",
      "Truck",
    ]);
    expect(ids({ type: "class", package: "Fleet" })).toEqual(["Car", "Engine", "Truck"]);
    expect(ids({ model: "types" })).toEqual(["Boolean", "Integer", "Real", "String"]);
    expect(ids({ tags: ["core"] })).toEqual(["Car"]);
    expect(ids({ stereotypes: ["entity"] })).toEqual(["Car"]);
    expect(ids({ hasCodeRef: true })).toEqual(["Car"]);
    expect(ids({ codeRefPath: "src/fleet" })).toEqual(["Car"]);
    expect(ids({ codeRefPath: "src/fle" })).toEqual([]);
    expect(ids({ owner: "Car.refuel()" })).toEqual(["Car.refuel().liters"]);
    expect(ids({ type: "lifeline", interaction: "RentCar" })).toEqual([
      "RentCar.car",
      "RentCar.contract",
      "RentCar.customer",
      "RentCar.garage",
    ]);
    expect(ids({ type: "class", visibility: "package" })).toEqual(["Mechanic"]);
    expect(ids({ type: "model", hasDocumentation: true })).toEqual(["garage", "types"]);
  });

  it("finds by folded name with exact, contains and prefix matching", () => {
    expect(ids({ name: "rent", match: "exact" })).toEqual([
      "Garage.rent()",
      "RentCar.rent",
      "RentCar.rent-2",
    ]);
    expect(ids({ name: "RENT" })).toEqual([
      "Garage.rent()",
      "RentCar",
      "RentCar.rent",
      "RentCar.rent-2",
      "rent-car",
    ]);
    expect(ids({ name: "eng", match: "prefix", type: "class" })).toEqual([
      "Engine",
      "EngineFailure",
    ]);
  });

  it("finds what a diagram shows, including owned elements", () => {
    expect(ids({ diagram: "check-fuel", type: "lifeline" })).toEqual([
      "CheckFuel.car",
      "CheckFuel.garage",
    ]);
    expect(ids({ diagram: "overview", type: "parameter" })).toContain("Car.refuel().liters");
  });

  it("paginates with offset and nextOffset", () => {
    const first = q.find({ type: "occurrence", limit: 10 }).data;
    expect(first).toMatchObject({ total: 21, offset: 0, limit: 10, nextOffset: 10 });
    expect(first.items).toHaveLength(10);
    const last = q.find({ type: "occurrence", limit: 10, offset: 20 }).data;
    expect(last.items).toHaveLength(1);
    expect(last.nextOffset).toBeNull();
  });

  it("rejects unknown references and out-of-range arguments", () => {
    fails(() => q.find({ package: "Nope" }), "NOT_FOUND");
    fails(() => q.find({ package: "Car" }), "INVALID_ARGUMENT");
    fails(() => q.find({ limit: 501 }), "INVALID_ARGUMENT");
    fails(() => q.find({ limit: 0 }), "INVALID_ARGUMENT");
    fails(() => q.find({ offset: -1 }), "INVALID_ARGUMENT");
    fails(() => q.find({ type: "widget" as "class" }), "INVALID_ARGUMENT");
    fails(() => q.find({ name: " " }), "INVALID_ARGUMENT");
    fails(() => q.find({ match: "regex" as "exact", name: "x" }), "INVALID_ARGUMENT");
    fails(() => q.relations("Car", { kinds: ["likes" as "owns"] }), "INVALID_ARGUMENT");
    fails(() => q.impact("Car", { maxDepth: 0 }), "INVALID_ARGUMENT");
    fails(() => q.impact("Car", { limit: 5001 }), "INVALID_ARGUMENT");
    fails(() => q.paths("Car", "Engine", { maxLength: 13 }), "INVALID_ARGUMENT");
    fails(() => q.paths("Car", "Engine", { maxPaths: 101 }), "INVALID_ARGUMENT");
    fails(() => q.paths("Car", "Nope"), "NOT_FOUND");
  });

  it("lists the relations of Car in both directions", () => {
    const rel = q.relations("Car").data.items;
    const out = rel.filter((r) => r.direction === "out");
    const inc = rel.filter((r) => r.direction === "in");
    expect(out).toHaveLength(9);
    expect(out.filter((r) => r.kind === "owns")).toHaveLength(7);
    expect(out.find((r) => r.kind === "association")).toMatchObject({
      to: "Engine",
      via: "Car--Engine",
      directed: true,
      resolved: true,
    });
    expect(out.find((r) => r.kind === "realization")).toMatchObject({
      to: "Drivable",
      via: "Car--implements--Drivable",
    });
    expect(inc.map((r) => [r.kind, r.from, r.key ?? r.via ?? null])).toEqual([
      ["owns", "garage", null],
      ["member", "Fleet", "members"],
      ["shows", "overview", "elements"],
      ["reference", "Car--Engine.end1", "element"],
      ["reference", "Car--implements--Drivable", "client"],
      ["reference", "CheckFuel.car", "represents"],
      ["reference", "Garage--Car.end2", "element"],
      ["reference", "Mechanic.repair().car", "type"],
      ["reference", "RentCar.car", "represents"],
      ["reference", "Truck--extends--Car", "general"],
      ["association", "Garage", "Garage--Car"],
      ["generalization", "Truck", "Truck--extends--Car"],
    ]);
    expect(inc.find((r) => r.kind === "association")?.directed).toBe(false);
  });

  it("filters relations by group, kind, key and direction", () => {
    const from = (args: Parameters<Query["relations"]>[1]): string[] =>
      q.relations("Car", args).data.items.map((r) => (r.direction === "in" ? r.from : r.to));
    expect(from({ direction: "in", groups: ["sequence"] })).toEqual([
      "CheckFuel.car",
      "RentCar.car",
    ]);
    expect(from({ direction: "in", groups: ["generalization"] })).toEqual([
      "Truck--extends--Car",
      "Truck",
    ]);
    expect(from({ direction: "in", groups: ["association"] })).toEqual([
      "Car--Engine.end1",
      "Garage--Car.end2",
      "Garage",
    ]);
    expect(from({ direction: "in", groups: ["ownership"] })).toEqual(["garage", "Fleet"]);
    expect(from({ direction: "in", groups: ["diagram"] })).toEqual(["overview"]);
    expect(from({ direction: "in", groups: ["typing"] })).toEqual(["Mechanic.repair().car"]);
    expect(from({ direction: "out", kinds: ["realization"] })).toEqual(["Drivable"]);
    expect(from({ keys: ["represents"] })).toEqual(["CheckFuel.car", "RentCar.car"]);
    expect(q.relations("Integer", { groups: ["typing"] }).data.total).toBe(3);
  });

  it("computes impact with kinds, depth and the files involved", () => {
    const refs = q.impact("Integer", { kinds: ["reference"] }).data;
    expect(refs.items.map((x) => [x.id, x.depth])).toEqual([
      ["Car.mileage", 1],
      ["Car.yearOfProduction", 1],
      ["Engine.power", 1],
    ]);
    expect(refs.truncated).toBe(false);

    const two = q.impact("Integer", { maxDepth: 2 }).data;
    expect(two.items.map((x) => [x.id, x.depth])).toEqual([
      ["Car.mileage", 1],
      ["Car.yearOfProduction", 1],
      ["Engine.power", 1],
      ["overview", 1],
      ["types", 1],
      ["Car", 2],
      ["Engine", 2],
      ["garage", 2],
    ]);
    expect(two.files).toEqual(["layout/overview.json", "models/garage.json", "models/types.json"]);
    expect(two).toMatchObject({ truncated: true, truncatedBy: "maxDepth" });
    expect(two.items[0]?.via).toMatchObject({ kind: "reference", key: "type", to: "Integer" });

    const fuel = (maxDepth: number): string[] =>
      q.impact("FuelType", { maxDepth }).data.items.map((x) => x.id);
    expect(fuel(1)).toEqual(["Car.fuel", "Fleet", "garage", "overview"]);
    expect(fuel(2)).toEqual(["Car.fuel", "Fleet", "garage", "overview", "Car"]);
    const car = q.impact("FuelType", { maxDepth: 2 }).data.items.find((x) => x.id === "Car");
    expect(car?.via).toMatchObject({ kind: "owns", from: "Car", to: "Car.fuel" });

    expect(
      q.impact("Truck", { direction: "dependencies", maxDepth: 1 }).data.items.map((x) => x.id),
    ).toEqual(["Car", "Truck.capacity"]);
  });

  it("terminates on cycles, excludes the root and never repeats an element", () => {
    const all = q.impact("Car", { direction: "both" }).data;
    const seen = all.items.map((x) => x.id);
    expect(seen).not.toContain("Car");
    expect(new Set(seen).size).toBe(seen.length);
    expect(all.truncated).toBe(false);
    const depths = all.items.map((x) => x.depth);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
    const limited = q.impact("Car", { direction: "both", limit: 3 }).data;
    expect(limited).toMatchObject({ truncated: true, truncatedBy: "limit" });
    expect(limited.items).toHaveLength(3);
  });

  it("finds shortest simple paths, directed or not", () => {
    expect(q.paths("Truck", "Engine").data.paths.map(route)).toEqual([
      "Truck > Car > Engine",
      "Truck > Fleet > Engine",
    ]);
    const directed = q.paths("Truck", "Engine", { directed: true }).data.paths;
    expect(directed.map(route)).toEqual(["Truck > Car > Engine"]);
    expect(directed[0]?.edges.map((e) => e.kind)).toEqual(["generalization", "association"]);
    expect(q.paths("Truck", "Engine", { maxLength: 1 }).data).toEqual({
      paths: [],
      truncated: false,
    });
    expect(q.paths("Car", "Car").data.paths).toEqual([{ nodes: ["Car"], edges: [] }]);
  });

  it("enumerates all simple paths in non-decreasing length", () => {
    const r = q.paths("Truck", "Engine", { mode: "all", maxLength: 3, maxPaths: 100 }).data;
    const lengths = r.paths.map((p) => p.edges.length);
    expect(lengths.length).toBeGreaterThan(2);
    expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(3);
    for (const p of r.paths) {
      expect(new Set(p.nodes).size).toBe(p.nodes.length);
      expect(p.nodes.slice(1, -1).some((n) => ["garage", "types", "overview"].includes(n))).toBe(
        false,
      );
    }
    const hubs = q.paths("Truck", "Engine", { mode: "all", maxLength: 2, throughHubs: true });
    expect(hubs.data.paths.map(route)).toContain("Truck > overview > Engine");
  });

  it("searches with folding, prefixes and filters applied after ranking", () => {
    const search = (text: string, args: Parameters<Query["search"]>[1] = {}): string[] =>
      q.search(text, args).data.items.map((h) => h.id);
    expect(search("vehiculo")).toEqual(["Car"]);
    expect(search("VEHÍCULO")).toEqual(["Car"]);
    // The design expected [Car, garage]; by BM25F the short garage documentation outranks Car's tag.
    expect(search("rental")).toEqual(["garage", "Car"]);
    expect(search("entity")).toEqual(["Car"]);
    const refuel = q.search("refuel").data;
    expect(refuel.total).toBe(5);
    expect(refuel.items.slice(0, 2).map((h) => h.id)).toEqual(["Car.refuel()", "CheckFuel.refuel"]);
    expect(search("fuel")[0]).toBe("Car.fuel");
    // Mode `any`: FuelType ranks first; "enumeration" is not indexed (types are not a lexical field).
    expect(search("fuel type enumeration")[0]).toBe("FuelType");
    expect(search("fuel type enumeration", { mode: "all" })).toEqual([]);
    expect(search("veh")).toEqual(["Car"]);
    expect(search("veh", { prefix: false })).toEqual([]);
    expect(q.search("zzz").data.total).toBe(0);
    expect(search("refuel", { type: "message" })).toEqual(["CheckFuel.refuel"]);
    expect(search("rental", { type: "model" })).toEqual(["garage"]);
    const hit = q.search("vehiculo").data.items[0];
    expect(hit).toMatchObject({ type: "class", model: "garage", fields: ["documentation"] });
    expect(hit?.score).toBeGreaterThan(0);
    fails(() => q.search("  "), "INVALID_ARGUMENT");
    fails(() => q.search("car", { limit: 201 }), "INVALID_ARGUMENT");
    fails(() => q.search("car", { mode: "some" as "any" }), "INVALID_ARGUMENT");
  });
});

describe("queries over a modified corpus", () => {
  afterEach(cleanup);

  it("reports AMBIGUOUS_ID with sorted locations and a degraded state", async () => {
    const { q } = await setup(async (root) => {
      const types = await readModel(root, "models/types.json");
      types.elements = {
        ...types.elements,
        classes: [{ id: "Car", name: "Car", visibility: "public" }],
      };
      await writeFile(join(root, "models/types.json"), serialize("model", types));
    });
    const e = fails(() => q.get("Car"), "AMBIGUOUS_ID");
    expect(e.details.locations).toEqual([
      { file: "models/garage.json", pointer: "/elements/classes/0", type: "class" },
      { file: "models/types.json", pointer: "/elements/classes/0", type: "class" },
    ]);
    expect(q.listModels().meta.state).toBe("degraded");
    const cars = q.find({ name: "car", match: "exact", type: "class" }).data.items;
    expect(cars.map((c) => [c.file, c.ambiguous])).toEqual([
      ["models/garage.json", true],
      ["models/types.json", true],
    ]);
    fails(() => q.relations("Car"), "AMBIGUOUS_ID");
  });

  it("excludes documents that cannot be loaded and still lists them", async () => {
    const { q } = await setup(async (root) => {
      await writeFile(join(root, "models/broken.json"), "{");
    });
    const r = q.listModels();
    expect(r.meta.excluded).toEqual([
      { path: "models/broken.json", kind: "model", status: "invalid_parse", codes: ["JSON_PARSE"] },
    ]);
    expect(r.meta.state).toBe("degraded");
    expect(r.data.items.find((m) => m.id === "broken")).toMatchObject({
      file: "models/broken.json",
      status: "invalid_parse",
      loaded: false,
      valid: false,
      errors: 1,
      elements: 0,
    });
    expect(q.get("Car").data.type).toBe("class");
  });

  it("reports read-only documents and maps pointers to the file as read", async () => {
    const { q } = await setup(async (root) => {
      const types = await readModel(root, "models/types.json");
      const prims = types.elements?.primitive_types ?? [];
      // An item without a recognizable shape is dropped by tolerant reading: indices shift.
      types.elements = { primitive_types: [{ bogus: true } as never, ...prims] };
      await writeFile(
        join(root, "models/types.json"),
        JSON.stringify({ ...types, format_version: "1.1" }),
      );
    });
    const r = q.get("Boolean");
    expect(r.meta.readOnly).toEqual(["models/types.json"]);
    expect(r.data).toMatchObject({ readOnly: true, pointer: "/elements/primitive_types/1" });
    const via = q.relations("Integer", { direction: "in", kinds: ["owns"] }).data.items[0];
    expect(via).toMatchObject({ from: "types", pointer: "/elements/primitive_types/2" });
  });

  it("keeps search up to date after transact, rename and reload", async () => {
    const { engine, q, root } = await setup();
    const fresh = (): string[] => {
      const ix = new LexicalIndex();
      ix.rebuild(
        [...engine.ids()].map((id): [string, ReturnType<Engine["get"]>] => [id, engine.get(id)]),
      );
      return ix.search("auto bicycle vehicle").map((h) => `${h.id}:${String(h.score)}`);
    };
    const facade = (): string[] =>
      q
        .search("auto bicycle vehicle", { limit: 200 })
        .data.items.map((h) => `${h.id}:${String(h.score)}`);

    expect(q.search("bicycle").data.total).toBe(0);
    const garage = await readModel(root, "models/garage.json");
    garage.elements?.classes?.push({ id: "Bicycle", name: "Bicycle", visibility: "public" });
    await engine.transact([{ op: "put", path: "models/garage.json", data: garage }]);
    expect(q.search("bicycle").data.items.map((h) => h.id)).toEqual(["Bicycle"]);
    expect(facade()).toEqual(fresh());

    await engine.rename("Car", "Auto");
    expect(q.search("auto").data.items.map((h) => h.id)).toContain("Auto");
    fails(() => q.get("Car"), "NOT_FOUND");
    expect(q.get("Auto.fuel").data.parent).toBe("Auto");
    expect(facade()).toEqual(fresh());

    const after = await readModel(root, "models/garage.json");
    const auto = after.elements?.classes?.find((c) => c.id === "Auto");
    if (auto) auto.documentation = "Motor vehicle for rent.";
    await writeFile(join(root, "models/garage.json"), serialize("model", after));
    await engine.reload();
    expect(q.search("motor").data.items.map((h) => h.id)).toEqual(["Auto"]);
    expect(facade()).toEqual(fresh());
  });

  it("rebuilds the lexical index after a generation gap", async () => {
    const { engine, root } = await setup();
    const q = createQuery(engine);
    expect(q.search("car").data.total).toBeGreaterThan(0);
    q.dispose(); // events are missed from now on
    const garage = await readModel(root, "models/garage.json");
    garage.elements?.classes?.push({ id: "Bicycle", name: "Bicycle", visibility: "public" });
    await engine.transact([{ op: "put", path: "models/garage.json", data: garage }]);
    expect(q.search("bicycle").data.items.map((h) => h.id)).toEqual(["Bicycle"]);
    expect(q.find({ name: "bicycle" }).meta.generation).toBe(engine.generation);
  });

  it("increments the engine generation on every change", async () => {
    const { engine, root } = await setup();
    const g0 = engine.generation;
    await engine.reload();
    expect(engine.generation).toBe(g0);
    const types = await readModel(root, "models/types.json");
    await engine.transact([
      { op: "put", path: "models/types.json", data: { ...types, name: "T" } },
    ]);
    expect(engine.generation).toBe(g0 + 1);
    await writeFile(join(root, "models/types.json"), serialize("model", types));
    await engine.reload();
    expect(engine.generation).toBe(g0 + 2);
  });
});

describe("path search limits", () => {
  let q: Query;
  beforeEach(async () => {
    ({ q } = await setup(async (root) => {
      // Dense synthetic model: 12 classes associated pairwise.
      const n = 12;
      const names = Array.from({ length: n }, (_, i) => `K${String(i).padStart(2, "0")}`);
      const associations = names.flatMap((a, i) =>
        names.slice(i + 1).map((b) => ({
          id: `${a}--${b}`,
          type: "association",
          direction: "undirected",
          end1: { id: `${a}--${b}.end1`, element: { idref: a } },
          end2: { id: `${a}--${b}.end2`, element: { idref: b } },
        })),
      );
      const model = {
        format_version: "1.0",
        id: "dense",
        name: "Dense",
        elements: {
          classes: [...names, "Z"].map((id) => ({ id, name: id, visibility: "public" })),
          associations: [
            ...associations,
            {
              id: "K00--Z",
              type: "association",
              direction: "undirected",
              end1: { id: "K00--Z.end1", element: { idref: "K00" } },
              end2: { id: "K00--Z.end2", element: { idref: "Z" } },
            },
          ],
        },
      };
      await writeFile(join(root, "models/dense.json"), serialize("model", model));
    }));
  });
  afterEach(cleanup);

  it("truncates by maxPaths on a dense graph quickly", () => {
    const t0 = performance.now();
    const r = q.paths("K00", "K11", { mode: "all", maxLength: 12, maxPaths: 100 }).data;
    const ms = performance.now() - t0;
    expect(r).toMatchObject({ truncated: true, truncatedBy: "maxPaths" });
    expect(r.paths).toHaveLength(100);
    expect(ms).toBeLessThan(200);
  });

  it("stops at the visit budget when the search space has no more paths", () => {
    // Z hangs only from K00: every walk into the clique is a dead end that still looks promising.
    const t0 = performance.now();
    const r = q.paths("K00", "Z", { mode: "all", maxLength: 12, maxPaths: 100 }).data;
    const ms = performance.now() - t0;
    expect(r).toMatchObject({ truncated: true, truncatedBy: "budget" });
    expect(r.paths.map(route)).toContain("K00 > Z");
    expect(ms).toBeLessThan(1000);
  });
});

describe("review S6 (H1-H3, H7)", () => {
  afterEach(cleanup);

  it("H1: pending change events stay bounded without searches, and search stays exact", async () => {
    const { engine, q } = await setup();
    q.search("car");
    for (let i = 0; i < 100; i++) {
      const m = engine.document("models/types.json")?.data as Model;
      await engine.transact([
        { op: "put", path: "models/types.json", data: { ...m, name: `T${String(i)}` } },
      ]);
      expect(q.pendingEvents).toBeLessThanOrEqual(64);
    }
    const fresh = new LexicalIndex();
    fresh.rebuild([...engine.ids()].map((id) => [id, engine.get(id)] as const));
    expect(q.search("car", { limit: 200 }).data.items.map((h) => [h.id, h.score])).toEqual(
      fresh.search("car").map((h) => [h.id, h.score]),
    );
  });

  it("H1: a query that never searched keeps no pending events", async () => {
    const { engine, q } = await setup();
    const m = engine.document("models/types.json")?.data as Model;
    await engine.transact([{ op: "put", path: "models/types.json", data: { ...m, name: "X" } }]);
    expect(q.pendingEvents).toBe(0);
  });

  it("H2: rejects oversized search texts", async () => {
    const { q } = await setup();
    fails(() => q.search("a".repeat(1001)), "INVALID_ARGUMENT");
    // Letters only: digits would split each word into more tokens.
    const words = (n: number): string =>
      Array.from(
        { length: n },
        (_, i) => `w${String.fromCharCode(97 + (i % 26), 97 + Math.floor(i / 26))}`,
      ).join(" ");
    const many = words(33);
    fails(() => q.search(many), "INVALID_ARGUMENT");
    expect(q.search(words(32)).data.total).toBe(0);
  });

  it("H3: rejects non-object arguments and unknown keys in every operation", async () => {
    const { q } = await setup();
    const bad = null as unknown as Record<string, never>;
    const typo = { tag: ["core"] } as unknown as Record<string, never>;
    for (const args of [bad, typo, [] as unknown as Record<string, never>]) {
      fails(() => q.listModels(args), "INVALID_ARGUMENT");
      fails(() => q.listDiagrams(args), "INVALID_ARGUMENT");
      fails(() => q.find(args), "INVALID_ARGUMENT");
      fails(() => q.relations("Car", args), "INVALID_ARGUMENT");
      fails(() => q.impact("Car", args), "INVALID_ARGUMENT");
      fails(() => q.paths("Car", "Engine", args), "INVALID_ARGUMENT");
      fails(() => q.search("car", args), "INVALID_ARGUMENT");
    }
    const e = fails(() => q.find(typo), "INVALID_ARGUMENT");
    expect(e.details.argument).toBe("tag");
  });

  it("H7: an impact truncated by limit is a prefix of the full result", async () => {
    const { q } = await setup();
    for (const root of ["Car", "Integer", "garage"]) {
      const full = q.impact(root, { direction: "both", limit: 5000 }).data.items.map((x) => x.id);
      for (let limit = 1; limit < Math.min(full.length, 40); limit++) {
        const cut = q.impact(root, { direction: "both", limit }).data;
        expect(cut.items.map((x) => x.id)).toEqual(full.slice(0, limit));
        expect(cut.truncatedBy).toBe("limit");
      }
    }
  });
});
