// Element-level edits (PLAN-002 S8; REQ-021, REQ-023..REQ-027, DEC-015, DEC-016): creation with derived IDs,
// merge-patch updates, delete with cascade, diagram membership, batches, implicit init and dry run.
import { fileURLToPath } from "node:url";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Layout, Model } from "../../src/format/index.js";
import { edit, Engine, EngineError, type EngineErrorCode } from "../../src/engine/index.js";
import { serialize } from "../../src/format/canonical.js";

const GARAGE = fileURLToPath(
  new URL("../../spec/format/examples/valid/garage/knowledge/", import.meta.url),
);

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
    expect(await json("ai-submind.json")).toEqual({ format_version: "1.1" });
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
    // One real write per element of the garage corpus: its cost grows with the corpus.
  }, 30_000);

  it("cascade on a message deletes its occurrences that nothing else uses", async () => {
    const e = await open();
    const r = await edit(e, [{ op: "delete", id: "RentCar.create", cascade: true }]);
    expect(r.diff.removed).toEqual(
      expect.arrayContaining(["RentCar.create", "RentCar.create.send", "RentCar.create.receive"]),
    );
    const deleted = r.affected.filter((a) => a.action === "deleted").map((a) => a.id);
    expect(deleted).toEqual(
      expect.arrayContaining(["RentCar.create", "RentCar.create.send", "RentCar.create.receive"]),
    );
    expect(e.status().findings.filter((f) => f.code === "OCCURRENCE_UNUSED")).toEqual([]);
  });

  it("executions (DEC-018): derived ID, cascade from lifelines and occurrences", async () => {
    const e = await open();
    const data = {
      covered: { idref: "RentCar.customer" },
      start: { idref: "RentCar.rent.send" },
      finish: { idref: "RentCar.rent-2.receive" },
    };
    const c = await edit(e, [
      { op: "create", type: "execution", parent: "RentCar", data },
      { op: "create", type: "execution", parent: "RentCar", data },
    ]);
    expect(c.created).toEqual(["RentCar.rent.send.exec", "RentCar.rent.send.exec-2"]);
    expect(e.status().findings).toEqual([]);
    // An occurrence a message and an execution share: the execution cannot exist without it.
    const o = await edit(e, [{ op: "delete", id: "RentCar.rent-2.send", cascade: true }], {
      dryRun: true,
    });
    expect(o.diff.removed).toEqual(
      expect.arrayContaining(["RentCar.rent-2", "RentCar.rent.receive.exec"]),
    );
    const l = await edit(e, [{ op: "delete", id: "RentCar.car", cascade: true }]);
    expect(l.diff.removed).toEqual(
      expect.arrayContaining(["RentCar.start.receive.exec", "RentCar.canDrive.receive.exec"]),
    );
    expect(e.status().findings.filter((f) => f.severity === "error")).toEqual([]);
  });

  it("cascade on a message keeps an occurrence an execution still uses", async () => {
    const e = await open();
    const r = await edit(e, [{ op: "delete", id: "RentCar.start", cascade: true }]);
    expect(r.diff.removed).toContain("RentCar.start.send");
    expect(r.diff.removed).not.toContain("RentCar.start.receive");
    expect(e.get("RentCar.start.receive.exec")).toHaveLength(1);
    expect(e.status().findings).toEqual([]);
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
    // rent-car is a link target in the corpus (DEC-020): cascade removes those links.
    const r = await edit(e, [{ op: "delete", id: "rent-car", cascade: true }]);
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

describe("behavior and links (REQ-041, DEC-020)", () => {
  it("create and update set behavior and links on elements, models and diagrams", async () => {
    const e = await open();
    const r = await edit(e, [
      {
        op: "create",
        type: "operation",
        parent: "Garage",
        data: {
          name: "refuel",
          visibility: "public",
          behavior: { idref: "CheckFuel" },
          links: [{ idref: "check-fuel" }],
        },
      },
      { op: "update", id: "types", patch: { links: [{ idref: "overview" }, { idref: "garage" }] } },
      { op: "update", id: "check-fuel", patch: { links: [{ idref: "rent-car" }] } },
      { op: "update", id: "Car", patch: { links: [{ idref: "RentCar" }] } },
    ]);
    expect(r.created).toEqual(["Garage.refuel()"]);
    expect(node(e, "Garage.refuel()")).toMatchObject({
      behavior: { idref: "CheckFuel" },
      links: [{ idref: "check-fuel" }],
    });
    // A set: written sorted by idref.
    expect((await json<Model>("models/types.json")).links).toEqual([
      { idref: "garage" },
      { idref: "overview" },
    ]);
    expect(node(e, "check-fuel").links).toEqual([{ idref: "rent-car" }]);
    expect(node(e, "Car").links).toEqual([{ idref: "RentCar" }]);
    expect(e.status().findings).toEqual([]);
    await rejects(
      edit(e, [{ op: "update", id: "Car.start()", patch: { behavior: { idref: "Car" } } }]),
      "VALIDATION_FAILED",
    );
  });

  it("without cascade, a behavior or links target is REFERENCED", async () => {
    const e = await open();
    const fuel = await rejects(edit(e, [{ op: "delete", id: "check-fuel" }]), "REFERENCED");
    expect(fuel.details.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "RentCar.car", idref: "check-fuel" }),
        expect.objectContaining({ source: "overview", idref: "check-fuel" }),
      ]),
    );
    const rent = await rejects(edit(e, [{ op: "delete", id: "Garage.rent()" }]), "REFERENCED");
    expect(rent.details.references).toContainEqual(
      expect.objectContaining({ source: "overview", idref: "Garage.rent()" }),
    );
  });

  it("cascade unsets behavior and removes only the deleted entry from links", async () => {
    const e = await open();
    const r = await edit(e, [{ op: "delete", id: "RentCar", cascade: true }]);
    expect(node(e, "Garage.rent()")).not.toHaveProperty("behavior");
    expect(r.affected).toContainEqual(
      expect.objectContaining({ action: "unset", id: "Garage.rent()" }),
    );
    const d = await edit(e, [{ op: "delete", id: "check-fuel", cascade: true }]);
    expect(node(e, "overview").links).toEqual([{ idref: "Garage.rent()" }]);
    expect(d.affected).toContainEqual(
      expect.objectContaining({ action: "removed_ref", id: "overview" }),
    );
    expect(e.status().findings.filter((f) => f.severity === "error")).toEqual([]);
  });

  it("deleting a whole model removes the links to it", async () => {
    const e = await open();
    const r = await edit(e, [{ op: "delete", id: "types", cascade: true }]);
    expect(r.revisions["models/types.json"]).toBeNull();
    // An empty set is not written (canonical form).
    expect(await json<Model>("models/garage.json")).not.toHaveProperty("links");
    expect(r.affected).toContainEqual({
      action: "removed_ref",
      file: "models/garage.json",
      pointer: "/links/0",
      id: "garage",
    });
    expect(e.status().findings.filter((f) => f.severity === "error")).toEqual([]);
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

describe("duplicated IDs (REQ-035, DEC-016)", () => {
  const money = { id: "Money", name: "Money", visibility: "public", kind: "real" } as const;

  /** Money in types.json and in a new billing.json (as after a merge); Car.price already uses it. */
  async function openDuplicated(): Promise<Engine> {
    const put = async (rel: string, change: (m: Model) => void): Promise<void> => {
      const m = await json<Model>(rel);
      change(m);
      await writeFile(join(root, rel), serialize("model", m));
    };
    await put("models/types.json", (m) => m.elements?.primitive_types?.push(money));
    await put("models/garage.json", (m) =>
      m.elements?.classes
        ?.find((c) => c.id === "Car")
        ?.attributes?.push({
          id: "Car.price",
          name: "price",
          visibility: "private",
          type: { idref: "Money" },
        }),
    );
    await writeFile(
      join(root, "models", "billing.json"),
      serialize("model", {
        format_version: "1.1",
        id: "billing",
        name: "Billing",
        elements: { primitive_types: [money] },
      }),
    );
    return open();
  }

  it("a write that adds a reference to a duplicated ID fails with AMBIGUOUS_ID", async () => {
    const e = await openDuplicated();
    const before = await snapshot();
    const attr = { name: "cost", visibility: "private", type: { idref: "Money" } };
    const price = node(e, "Car").attributes as unknown[];
    await rejects(
      edit(e, [{ op: "update", id: "Car", patch: { attributes: [...price, attr] } }]),
      "AMBIGUOUS_ID",
    );
    await rejects(
      edit(e, [{ op: "create", type: "attribute", parent: "Car", data: attr }]),
      "AMBIGUOUS_ID",
    );
    await rejects(
      edit(e, [{ op: "edit_diagram", id: "overview", add: ["Money"] }]),
      "AMBIGUOUS_ID",
    );
    expect(await snapshot()).toEqual(before);
    // References that already existed do not block other edits of the same document.
    await edit(e, [{ op: "update", id: "Car", patch: { documentation: "A car." } }]);
    expect(node(e, "Car").documentation).toBe("A car.");
  });

  it("a reference moved to another holder in the same document is a new one (R1)", async () => {
    const e = await openDuplicated();
    const attrs = (node(e, "Car").attributes as { id?: string }[]).filter(
      (a) => a.id !== "Car.price",
    );
    const cost = { name: "cost", visibility: "private", type: { idref: "Money" } };
    await rejects(
      edit(e, [{ op: "update", id: "Car", patch: { attributes: [...attrs, cost] } }]),
      "AMBIGUOUS_ID",
    );
  });

  it("a reference to an ID whose other copy the same batch deletes is allowed", async () => {
    const e = await openDuplicated();
    const cost = { name: "cost", visibility: "private", type: { idref: "Money" } };
    await edit(e, [
      { op: "delete", id: "billing", cascade: true },
      { op: "create", type: "attribute", parent: "Car", data: cost },
    ]);
    expect(node(e, "Car.cost").type).toEqual({ idref: "Money" });
  });

  it("deleting one copy keeps the references to the copy that remains", async () => {
    const e = await openDuplicated();
    const r = await edit(e, [{ op: "delete", id: "billing", cascade: true }]);
    expect(r.affected).toEqual([
      { action: "deleted", file: "models/billing.json", pointer: "", id: "billing" },
    ]);
    expect(node(e, "Car.price").type).toEqual({ idref: "Money" });
    expect(e.get("Money")).toHaveLength(1);
  });
});

describe("documents not loaded as writable (REQ-034)", () => {
  it("block every write that adds IDs, while other edits go on", async () => {
    const types = join(root, "models", "types.json");
    await writeFile(
      types,
      `<<<<<<< ours\n${await readFile(types, "utf8")}=======\n>>>>>>> theirs\n`,
    );
    const e = await open();
    const before = await snapshot();
    const string = { id: "String", name: "String", visibility: "public", kind: "string" };
    const err = await rejects(
      edit(e, [{ op: "create", type: "primitive_type", parent: "garage", data: string }]),
      "CREATE_BLOCKED",
    );
    expect(err.details.paths).toEqual(["models/types.json"]);
    await rejects(
      edit(e, [
        {
          op: "create",
          type: "attribute",
          parent: "Car",
          data: { name: "x", visibility: "private" },
        },
      ]),
      "CREATE_BLOCKED",
    );
    expect(await snapshot()).toEqual(before);
    await edit(e, [{ op: "update", id: "Car", patch: { documentation: "A car." } }]);
    expect(node(e, "Car").documentation).toBe("A car.");
  });
});
