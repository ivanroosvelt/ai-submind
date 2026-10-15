// Element-level edits (PLAN-002 S8; REQ-021, REQ-023..REQ-027, DEC-015, DEC-016): creation with derived IDs,
// merge-patch updates, delete with cascade, diagram membership, batches, implicit init and dry run.
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Layout, Model } from "../../src/format/index.js";
import { edit, Engine, EngineError, type EngineErrorCode } from "../../src/engine/index.js";

const GARAGE = new URL("../../spec/format/examples/valid/garage/knowledge/", import.meta.url)
  .pathname;

let dir: string;
let root: string;
const engines: Engine[] = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-submind-edit-"));
  root = join(dir, "knowledge");
  await cp(GARAGE, root, { recursive: true });
});

afterEach(async () => {
  for (const e of engines.splice(0)) e.close();
  await rm(dir, { recursive: true, force: true });
});

async function open(): Promise<Engine> {
  const e = await Engine.open(root);
  engines.push(e);
  return e;
}

/** Engine over an empty knowledge/ (no manifest). */
async function openEmpty(): Promise<Engine> {
  await rm(root, { recursive: true, force: true });
  await mkdir(root);
  return open();
}

const json = async <T>(rel: string): Promise<T> =>
  JSON.parse(await readFile(join(root, rel), "utf8")) as T;

async function rejects(p: Promise<unknown>, code: EngineErrorCode): Promise<EngineError> {
  const e: unknown = await p.then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(EngineError);
  expect((e as EngineError).code).toBe(code);
  return e as EngineError;
}

async function snapshot(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (rel: string): Promise<void> => {
    for (const d of await readdir(join(root, rel), { withFileTypes: true })) {
      const r = rel === "" ? d.name : `${rel}/${d.name}`;
      if (d.isDirectory()) await walk(r);
      else out[r] = await readFile(join(root, r), "utf8");
    }
  };
  await walk("");
  return out;
}

const node = (e: Engine, id: string): Record<string, unknown> =>
  e.get(id)[0]?.node as Record<string, unknown>;

describe("create and update (REQ-021, REQ-023)", () => {
  it("derives readable IDs, also for inline children, with collision suffixes", async () => {
    const e = await openEmpty();
    const model = await edit(e, [{ op: "create", type: "model", data: { name: "Fleet Ops" } }]);
    expect(model.created).toEqual(["fleet-ops"]);
    const r = await edit(e, [
      {
        op: "create",
        type: "class",
        parent: "fleet-ops",
        data: {
          name: "Car",
          visibility: "public",
          attributes: [{ name: "speed", visibility: "private" }],
          operations: [{ name: "start", visibility: "public", parameters: [{ name: "gear" }] }],
        },
      },
      {
        op: "create",
        type: "class",
        parent: "fleet-ops",
        data: { name: "Car", visibility: "public" },
      },
    ]);
    expect(r.created).toEqual(["Car", "Car-2"]);
    expect(e.get("Car.speed")[0]?.type).toBe("attribute");
    expect(e.get("Car.start().gear")[0]?.type).toBe("parameter");
    expect(e.status().findings).toEqual([]);
  });

  it("derives association, end and generalization IDs from their ends", async () => {
    const e = await open();
    const r = await edit(e, [
      {
        op: "create",
        type: "association",
        parent: "garage",
        data: {
          type: "association",
          direction: "undirected",
          end1: { element: { idref: "Customer" } },
          end2: { element: { idref: "Contract" } },
        },
      },
      {
        op: "create",
        type: "generalization",
        parent: "garage",
        data: { specific: { idref: "Contract" }, general: { idref: "Car" } },
      },
    ]);
    expect(r.created).toEqual(["Customer--Contract", "Contract--extends--Car"]);
    expect(e.get("Customer--Contract.end2")[0]?.type).toBe("association_end");
  });

  it("keeps the ID when the name changes; null in a patch removes the field", async () => {
    const e = await open();
    await edit(e, [
      { op: "update", id: "Car", patch: { name: "Automobile", documentation: null } },
    ]);
    expect(node(e, "Car").name).toBe("Automobile");
    expect(node(e, "Car")).not.toHaveProperty("documentation");
    expect(node(e, "Car").attributes).toHaveLength(4);
    await rejects(edit(e, [{ op: "update", id: "Car", patch: { id: "X" } }]), "INVALID_ARGUMENT");
  });

  it("rejects a stale expectedRevision (REQ-023 criterion 4)", async () => {
    const e = await open();
    await rejects(
      edit(e, [
        { op: "update", id: "Car", patch: { name: "X" }, expectedRevision: "0".repeat(64) },
      ]),
      "REVISION_CONFLICT",
    );
    const rev = e.revision("models/garage.json") ?? "";
    await edit(e, [{ op: "update", id: "Car", patch: { name: "X" }, expectedRevision: rev }]);
  });

  it("rejects __proto__, constructor and prototype keys without polluting prototypes", async () => {
    const e = await open();
    for (const key of ["__proto__", "constructor", "prototype"]) {
      const evil = JSON.parse(`{"${key}":{"polluted":"yes"}}`) as Record<string, unknown>;
      await rejects(edit(e, [{ op: "update", id: "Car", patch: evil }]), "INVALID_ARGUMENT");
      await rejects(
        edit(e, [{ op: "update", id: "Car", patch: { documentation: "x", nested: evil } }]),
        "INVALID_ARGUMENT",
      );
      await rejects(
        edit(e, [{ op: "create", type: "class", parent: "garage", data: { name: "B", ...evil } }]),
        "INVALID_ARGUMENT",
      );
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects unknown IDs and parents of the wrong type", async () => {
    const e = await open();
    await rejects(edit(e, [{ op: "update", id: "Nope", patch: {} }]), "NOT_FOUND");
    await rejects(
      edit(e, [{ op: "create", type: "attribute", parent: "garage", data: { name: "x" } }]),
      "INVALID_ARGUMENT",
    );
  });

  it("the first write initializes knowledge/; a dry run creates nothing (DEC-015)", async () => {
    const e = await openEmpty();
    const op = { op: "create" as const, type: "model" as const, data: { name: "M" } };
    const dry = await edit(e, [op], { dryRun: true });
    expect(dry).toMatchObject({ dryRun: true, initialized: true, created: ["m"] });
    expect(await readdir(root)).toEqual([]);
    const real = await edit(e, [op]);
    expect(real).toMatchObject({ dryRun: false, initialized: true });
    expect(real.diff).toEqual(dry.diff);
    expect(real.revisions).toEqual(dry.revisions);
    expect(await json("ai-submind.json")).toEqual({ format_version: "1.0" });
    expect((await edit(e, [{ op: "update", id: "m", patch: { name: "N" } }])).initialized).toBe(
      false,
    );
  });
});

describe("delete, cascade and diagrams (REQ-024, REQ-025, DEC-016)", () => {
  it("without cascade, a referenced element fails with REFERENCED and the references", async () => {
    const e = await open();
    const err = await rejects(edit(e, [{ op: "delete", id: "Truck" }]), "REFERENCED");
    expect(err.details.references).toContainEqual({
      idref: "Truck",
      file: "models/garage.json",
      pointer: "/elements/generalizations/0/specific",
      source: "Truck--extends--Car",
    });
  });

  it("an unreferenced element is deleted", async () => {
    const e = await open();
    await edit(e, [
      {
        op: "create",
        type: "class",
        parent: "garage",
        data: { name: "Bus", visibility: "public" },
      },
    ]);
    const r = await edit(e, [{ op: "delete", id: "Bus" }]);
    expect(r.diff.removed).toEqual(["Bus"]);
    expect(r.affected).toEqual([
      { action: "deleted", file: "models/garage.json", pointer: "/elements/classes/0", id: "Bus" },
    ]);
  });

  it("cascade removes and unsets references and deletes dependent elements", async () => {
    const e = await open();
    const before = await json<Layout>("layout/overview.json");
    expect(before.nodes).toHaveProperty("Car");
    const r = await edit(e, [{ op: "delete", id: "Car", cascade: true }]);
    expect(e.status().findings.filter((f) => f.severity === "error")).toEqual([]);
    // Dependent relations are gone; optional references are unset; lists lose the item.
    for (const id of [
      "Car",
      "Car.start()",
      "Truck--extends--Car",
      "Car--Engine",
      "Car--Engine.end1",
      "Garage--Car",
      "Car--implements--Drivable",
    ]) {
      expect(r.diff.removed).toContain(id);
    }
    expect(node(e, "Truck")).toBeDefined();
    expect(node(e, "Mechanic.repair().car")).not.toHaveProperty("type");
    expect(node(e, "CheckFuel.car")).not.toHaveProperty("represents");
    expect(node(e, "Fleet").members).not.toContainEqual({ idref: "Car" });
    expect(node(e, "Fleet").members).not.toContainEqual({ idref: "Car--Engine" });
    const layout = await json<Layout>("layout/overview.json");
    expect(layout.nodes).not.toHaveProperty("Car");
    expect(layout.edges ?? {}).not.toHaveProperty("Car--Engine");
    const actions = new Set(r.affected.map((a) => `${a.action} ${a.id}`));
    expect(actions).toContain("deleted Truck--extends--Car");
    expect(actions).toContain("deleted Garage--Car");
    expect(actions).toContain("unset Mechanic.repair().car");
    expect(actions).toContain("removed_ref Fleet");
    expect(actions).toContain("removed_ref overview");
  });

  it("cascade-deleting any element of the garage corpus adds no error and no new warning", async () => {
    const warnings = (e: Engine): Set<string> =>
      new Set(
        e
          .status()
          .findings.filter((f) => f.severity === "warning")
          .map((f) => `${f.code} ${(f.subjects ?? []).join(",")} ${f.message}`),
      );
    const base = await open();
    const before = warnings(base);
    const ids = [...base.ids()].filter((id) => base.get(id)[0]?.type !== "association_end");
    const ends = [...base.ids()].filter((id) => base.get(id)[0]?.type === "association_end");
    // An end is part of its association (exactly two ends): deleting it alone is rejected.
    for (const id of ends) {
      await rejects(edit(base, [{ op: "delete", id, cascade: true }]), "INVALID_ARGUMENT");
    }
    const failures: string[] = [];
    for (const [i, id] of ids.entries()) {
      // A fresh copy per delete: the real write, so that the warnings after it can be compared.
      const copy = join(dir, `k${String(i)}`);
      await cp(GARAGE, copy, { recursive: true });
      const e = await Engine.open(copy);
      engines.push(e);
      try {
        await edit(e, [{ op: "delete", id, cascade: true }]);
        const added = [...warnings(e)].filter((w) => !before.has(w));
        if (added.length > 0) failures.push(`${id}: ${added.join("; ")}`);
      } catch (x) {
        failures.push(`${id}: ${String(x)}`);
      }
      e.close();
    }
    expect(failures).toEqual([]);
  });

  it("cascade on a message deletes its occurrences that no other message uses", async () => {
    const e = await open();
    const r = await edit(e, [{ op: "delete", id: "RentCar.rent", cascade: true }]);
    expect(r.diff.removed).toEqual(
      expect.arrayContaining(["RentCar.rent", "RentCar.rent.send", "RentCar.rent.receive"]),
    );
    const deleted = r.affected.filter((a) => a.action === "deleted").map((a) => a.id);
    expect(deleted).toEqual(
      expect.arrayContaining(["RentCar.rent", "RentCar.rent.send", "RentCar.rent.receive"]),
    );
    expect(e.status().findings.filter((f) => f.code === "OCCURRENCE_UNUSED")).toEqual([]);
  });

  it("cascade on an interaction deletes the sequence diagram left empty and its layout", async () => {
    const e = await open();
    const r = await edit(e, [{ op: "delete", id: "RentCar", cascade: true }]);
    expect(r.diff.removed).toContain("rent-car");
    expect(e.revision("layout/rent-car.json")).toBeNull();
    const actions = r.affected.map((a) => `${a.action} ${a.file} ${a.id}`);
    expect(actions).toContain("deleted models/garage.json rent-car");
    expect(actions).toContain("deleted layout/rent-car.json rent-car");
  });

  it("cascade on a lifeline deletes its occurrences and the messages that need them", async () => {
    const e = await open();
    const messages = (node(e, "RentCar").messages as { id: string }[]).map((m) => m.id);
    const r = await edit(e, [{ op: "delete", id: "RentCar.customer", cascade: true }]);
    expect(e.status().findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(r.diff.removed.filter((id) => messages.includes(id)).length).toBeGreaterThan(0);
  });

  it("deleting a diagram deletes its layout; deleting a model deletes its file", async () => {
    const e = await open();
    const r = await edit(e, [{ op: "delete", id: "rent-car" }]);
    expect(r.revisions["layout/rent-car.json"]).toBeNull();
    expect(e.revision("layout/rent-car.json")).toBeNull();
    const m = await edit(e, [{ op: "create", type: "model", data: { name: "Tmp" } }]);
    await edit(e, [{ op: "delete", id: m.created[0] ?? "" }]);
    expect(e.revision("models/tmp.json")).toBeNull();
  });

  it("edit_diagram adds and removes elements; interactions are not allowed in class diagrams", async () => {
    const e = await open();
    await edit(e, [{ op: "edit_diagram", id: "overview", remove: ["Car"] }]);
    expect(node(e, "overview").elements).not.toContainEqual({ idref: "Car" });
    expect((await json<Layout>("layout/overview.json")).nodes).not.toHaveProperty("Car");
    await edit(e, [{ op: "edit_diagram", id: "overview", add: ["Car"] }]);
    expect(node(e, "overview").elements).toContainEqual({ idref: "Car" });
    const err = await rejects(
      edit(e, [{ op: "edit_diagram", id: "overview", add: ["RentCar"] }]),
      "VALIDATION_FAILED",
    );
    expect(err.details.findings?.map((f) => f.code)).toEqual(["DIAGRAM_ELEMENT_NOT_ALLOWED"]);
  });
});

describe("batches (REQ-026)", () => {
  it("a batch with one invalid operation writes nothing", async () => {
    const e = await open();
    const before = await snapshot();
    await rejects(
      edit(e, [
        { op: "update", id: "Car", patch: { name: "Vehicle" } },
        { op: "create", type: "class", parent: "garage", data: { name: "Bus" } }, // no visibility
      ]),
      "VALIDATION_FAILED",
    );
    expect(await snapshot()).toEqual(before);
  });

  it("IDs created earlier in the batch can be referenced and edited", async () => {
    const e = await open();
    const r = await edit(e, [
      { op: "create", type: "model", data: { name: "Shop" } },
      {
        op: "create",
        type: "class",
        parent: "shop",
        data: { name: "Order", visibility: "public" },
      },
      {
        op: "create",
        type: "diagram",
        parent: "shop",
        data: { name: "Main", kind: "class", elements: [{ idref: "Order" }] },
      },
      { op: "update", id: "Order", patch: { documentation: "An order." } },
    ]);
    expect(r.created).toEqual(["shop", "Order", "main"]);
    expect(node(e, "Order").documentation).toBe("An order.");
    expect((await json<Model>("models/shop.json")).diagrams?.[0]?.elements).toEqual([
      { idref: "Order" },
    ]);
  });
});
