// Engine (PLAN-002 S5): loading, transactions, optimistic control, confinement, rename and reload.
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serialize, type Layout, type Model } from "../../src/format/index.js";
import {
  Engine,
  EngineError,
  revisionOf,
  type ChangeEvent,
  type EngineErrorCode,
} from "../../src/engine/index.js";

const GARAGE = new URL("../../spec/format/examples/valid/garage/knowledge/", import.meta.url)
  .pathname;

let dir: string;
let root: string;
const engines: Engine[] = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-submind-engine-"));
  root = join(dir, "knowledge");
  await cp(GARAGE, root, { recursive: true });
});

afterEach(async () => {
  for (const e of engines.splice(0)) e.close();
  await rm(dir, { recursive: true, force: true });
});

async function open(options: Parameters<typeof Engine.open>[1] = {}): Promise<Engine> {
  const e = await Engine.open(root, options);
  engines.push(e);
  return e;
}

const text = (rel: string): Promise<string> => readFile(join(root, rel), "utf8");
const json = async <T>(rel: string): Promise<T> => JSON.parse(await text(rel)) as T;

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
      else out[r] = await text(r);
    }
  };
  await walk("");
  return out;
}

/** Waits for the next `change` event that satisfies `pred`. */
function nextChange(
  e: Engine,
  pred: (c: ChangeEvent) => boolean = () => true,
): Promise<ChangeEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("no change event"));
    }, 5000);
    const on = (c: ChangeEvent): void => {
      if (!pred(c)) return;
      clearTimeout(timeout);
      e.off("change", on);
      resolve(c);
    };
    e.on("change", on);
  });
}

/**
 * Repeats `write` until a matching `change` arrives (at most `nextChange`'s 5 s). On macOS the recursive
 * watcher (FSEvents) starts asynchronously with no ready signal, so writes right after `open` can be missed.
 */
async function writeUntilChange(
  e: Engine,
  write: () => Promise<void>,
  pred?: (c: ChangeEvent) => boolean,
): Promise<ChangeEvent> {
  const change = nextChange(e, pred);
  const settled = change.then(
    () => true,
    () => true,
  );
  do await write();
  while (!(await Promise.race([settled, new Promise<boolean>((r) => setTimeout(r, 500, false))])));
  return change;
}

describe("loading (REQ-006, REQ-022)", () => {
  it("loads the garage corpus with indexes and inverse references", async () => {
    const e = await open();
    const s = e.status();
    expect(s.state).toBe("ok");
    expect(s.findings).toEqual([]);
    expect(s.documents.map((d) => d.path)).toEqual([
      "ai-submind.json",
      "layout/overview.json",
      "layout/rent-car.json",
      "models/garage.json",
      "models/types.json",
    ]);
    expect(e.get("Car")[0]?.type).toBe("class");
    expect(e.get("Car.start()")[0]?.type).toBe("operation");
    const refs = e.referencesTo("Car").map((r) => `${r.file}#${r.pointer}`);
    expect(refs).toContain("models/garage.json#/elements/generalizations/0/general");
  });

  it("stays degraded with invalid files and keeps the valid ones", async () => {
    await writeFile(join(root, "models/broken.json"), "<<<<<<< HEAD\n{}\n");
    await writeFile(join(root, "notes.txt"), "x");
    const e = await open();
    const s = e.status();
    expect(s.state).toBe("degraded");
    expect(s.documents.find((d) => d.path === "models/broken.json")?.status).toBe("conflicted");
    expect(s.findings.map((f) => f.code)).toEqual(["UNKNOWN_FILE", "MERGE_CONFLICT"].sort());
    expect(e.get("Car")).toHaveLength(1);
  });

  it("removes temporary files left by an interrupted write", async () => {
    await mkdir(join(root, ".ai-submind/tmp"), { recursive: true });
    await writeFile(join(root, ".ai-submind/tmp/x.tmp"), "partial");
    await open();
    await expect(readdir(join(root, ".ai-submind/tmp"))).rejects.toThrow();
  });
});

describe("transactions (REQ-005, REQ-008, REQ-011, REQ-026)", () => {
  it("writes canonical JSON and returns the new revision", async () => {
    const e = await open();
    const m = await json<Model>("models/types.json");
    m.name = "Shared types";
    const shuffled = Object.fromEntries(Object.entries(m).reverse());
    const r = await e.transact([
      {
        op: "put",
        path: "models/types.json",
        data: shuffled,
        expectedRevision: e.revision("models/types.json"),
      },
    ]);
    const written = await text("models/types.json");
    expect(written).toBe(serialize("model", m));
    expect(r.revisions["models/types.json"]).toBe(revisionOf(new TextEncoder().encode(written)));
    expect(r.diff.changed).toContain("types");
    expect(await readdir(join(root, ".ai-submind/tmp"))).toEqual([]);
  });

  it("creates a document only if it does not exist (expectedRevision null)", async () => {
    const e = await open();
    const data = { format_version: "1.0", id: "extra", name: "Extra" };
    await e.transact([{ op: "put", path: "models/extra.json", data, expectedRevision: null }]);
    expect(e.get("extra")[0]?.file).toBe("models/extra.json");
    await rejects(
      e.transact([{ op: "put", path: "models/extra.json", data, expectedRevision: null }]),
      "REVISION_CONFLICT",
    );
  });

  it("rejects the whole batch if one operation is invalid and writes nothing", async () => {
    const e = await open();
    const before = await snapshot();
    const types = await json<Model>("models/types.json");
    types.name = "changed";
    const err = await rejects(
      e.transact([
        { op: "put", path: "models/types.json", data: types },
        { op: "delete", path: "models/garage.json" },
      ]),
      "VALIDATION_FAILED",
    );
    expect(err.details.findings?.some((f) => f.code === "REF_UNRESOLVED")).toBe(true);
    expect(await snapshot()).toEqual(before);
    expect(e.get("garage")).toHaveLength(1);
  });

  it("validates the schema before serializing: unknown keys are rejected, not dropped", async () => {
    const e = await open();
    const m = await json<Model>("models/types.json");
    const err = await rejects(
      e.transact([{ op: "put", path: "models/types.json", data: { ...m, colour: "red" } }]),
      "VALIDATION_FAILED",
    );
    expect(err.details.findings?.[0]?.code).toBe("SCHEMA_VIOLATION");
  });

  it("rejects writing a version other than the supported one", async () => {
    const e = await open();
    const m = await json<Model>("models/types.json");
    await rejects(
      e.transact([{ op: "put", path: "models/types.json", data: { ...m, format_version: "1.1" } }]),
      "VALIDATION_FAILED",
    );
  });

  it("accepts a batch on a degraded knowledge/ if it introduces no new errors", async () => {
    const garage = await json<Model>("models/garage.json");
    garage.diagrams = (garage.diagrams ?? []).map((d) =>
      d.id === "overview" ? { ...d, elements: [...(d.elements ?? []), { idref: "Ghost" }] } : d,
    );
    await writeFile(join(root, "models/garage.json"), serialize("model", garage));
    const e = await open();
    expect(e.status().state).toBe("degraded");
    const types = await json<Model>("models/types.json");
    await e.transact([{ op: "put", path: "models/types.json", data: { ...types, name: "T" } }]);
    // Fixing the error is also accepted.
    garage.diagrams = (garage.diagrams ?? []).map((d) => ({
      ...d,
      elements: (d.elements ?? []).filter((r) => r.idref !== "Ghost"),
    }));
    await e.transact([{ op: "put", path: "models/garage.json", data: garage }]);
    expect(e.status().state).toBe("ok");
  });

  it("rejects paths that are not documents or leave knowledge/", async () => {
    const e = await open();
    const data = { format_version: "1.0", id: "x", name: "x" };
    await rejects(e.transact([{ op: "put", path: "../x.json", data }]), "PATH_OUTSIDE_KNOWLEDGE");
    await rejects(e.transact([{ op: "put", path: "/tmp/x.json", data }]), "PATH_OUTSIDE_KNOWLEDGE");
    await rejects(e.transact([{ op: "put", path: "notes/x.json", data }]), "INVALID_PATH");
    await rejects(
      e.transact([
        { op: "put", path: "models/x.json", data },
        { op: "put", path: "models/x.json", data },
      ]),
      "INVALID_BATCH",
    );
    await rejects(e.transact([{ op: "delete", path: "models/nope.json" }]), "NOT_FOUND");
  });

  it("never writes through a symbolic link", async () => {
    const outside = join(dir, "outside");
    await mkdir(outside);
    await rm(join(root, "layout"), { recursive: true });
    await symlink(outside, join(root, "layout"));
    const e = await open();
    const layout: Layout = { format_version: "1.0", diagram: { idref: "overview" } };
    await rejects(
      e.transact([{ op: "put", path: "layout/overview.json", data: layout }]),
      "PATH_OUTSIDE_KNOWLEDGE",
    );
    expect(await readdir(outside)).toEqual([]);
  });

  it("blocks writes to documents that are not writable (REQ-022)", async () => {
    await writeFile(join(root, "models/broken.json"), "{");
    const e = await open();
    const err = await rejects(
      e.transact([
        {
          op: "put",
          path: "models/broken.json",
          data: { format_version: "1.0", id: "broken", name: "b" },
        },
      ]),
      "DOCUMENT_INVALID",
    );
    expect(err.details.status).toBe("invalid_parse");
  });

  it("blocks writes to read-only documents of another version", async () => {
    const m = await json<Model>("models/types.json");
    await writeFile(
      join(root, "models/types.json"),
      JSON.stringify({ ...m, format_version: "2.0" }),
    );
    const e = await open();
    expect(e.document("models/types.json")?.status).toBe("read_only");
    await rejects(
      e.transact([{ op: "put", path: "models/types.json", data: m }]),
      "DOCUMENT_INVALID",
    );
  });
});

describe("optimistic control (NFR-005, REQ-007 criterion 2, REQ-023 criterion 4)", () => {
  it("rejects a stale expected revision", async () => {
    const e = await open();
    const m = await json<Model>("models/types.json");
    const rev = e.revision("models/types.json");
    await e.transact([
      { op: "put", path: "models/types.json", data: { ...m, name: "A" }, expectedRevision: rev },
    ]);
    const err = await rejects(
      e.transact([
        { op: "put", path: "models/types.json", data: { ...m, name: "B" }, expectedRevision: rev },
      ]),
      "REVISION_CONFLICT",
    );
    expect(err.details.expected).toBe(rev);
    expect(await json<Model>("models/types.json")).toMatchObject({ name: "A" });
  });

  it("rejects a write over an external change that was not reloaded yet", async () => {
    const e = await open();
    const m = await json<Model>("models/types.json");
    await writeFile(
      join(root, "models/types.json"),
      serialize("model", { ...m, name: "external" }),
    );
    await rejects(
      e.transact([{ op: "put", path: "models/types.json", data: { ...m, name: "mine" } }]),
      "REVISION_CONFLICT",
    );
    expect(await json<Model>("models/types.json")).toMatchObject({ name: "external" });
  });

  it("serializes concurrent transactions: the second one sees the first", async () => {
    const e = await open();
    const m = await json<Model>("models/types.json");
    const rev = e.revision("models/types.json");
    const results = await Promise.allSettled([
      e.transact([
        { op: "put", path: "models/types.json", data: { ...m, name: "1" }, expectedRevision: rev },
      ]),
      e.transact([
        { op: "put", path: "models/types.json", data: { ...m, name: "2" }, expectedRevision: rev },
      ]),
    ]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  });
});

describe("rename (REQ-039, spec §3.2)", () => {
  it("renames an element, its prefixed IDs and every reference in models, diagrams and layout", async () => {
    const e = await open();
    const r = await e.rename("Car", "Vehicle");
    expect(r.renamed).toContainEqual(["Car", "Vehicle"]);
    expect(r.renamed).toContainEqual(["Car.refuel().liters", "Vehicle.refuel().liters"]);
    expect(e.get("Car")).toEqual([]);
    expect(e.get("Vehicle.start()")).toHaveLength(1);
    // Derived relationship IDs are opaque after creation.
    expect(e.get("Truck--extends--Car")).toHaveLength(1);
    const garage = await text("models/garage.json");
    expect(garage).not.toMatch(/"(id|idref)": "Car(\.|")/);
    const layout = await json<Layout>("layout/overview.json");
    expect(Object.keys(layout.nodes ?? {})).toContain("Vehicle");
    expect(Object.keys(layout.nodes ?? {})).not.toContain("Car");
    expect(e.status().findings).toEqual([]);
    // Files that do not mention the ID are not rewritten.
    expect(Object.keys(r.revisions).sort()).toEqual(["layout/overview.json", "models/garage.json"]);
  });

  it("moves the files of a renamed model and of the layout of a renamed diagram", async () => {
    const e = await open();
    await e.rename("garage", "fleet");
    await e.rename("overview", "main");
    const files = await snapshot();
    expect(Object.keys(files).sort()).toEqual([
      "ai-submind.json",
      "layout/main.json",
      "layout/rent-car.json",
      "models/fleet.json",
      "models/types.json",
    ]);
    expect(await json<Layout>("layout/main.json")).toMatchObject({ diagram: { idref: "main" } });
    expect(e.status().findings).toEqual([]);
  });

  it("fails on collision, invalid IDs, unknown IDs and blocked knowledge/ without writing", async () => {
    const e = await open();
    // IDs are opaque: an attribute may have an ID that does not start with its owner's.
    const ship = {
      format_version: "1.0",
      id: "ships",
      name: "Ships",
      elements: {
        classes: [
          {
            id: "Ship",
            name: "Ship",
            visibility: "public",
            attributes: [{ id: "Hull.power", name: "power", visibility: "public" }],
          },
        ],
      },
    };
    await e.transact([{ op: "put", path: "models/ships.json", data: ship }]);
    const before = await snapshot();
    await rejects(e.rename("Car", "Truck"), "RENAME_COLLISION");
    const err = await rejects(e.rename("Engine", "Hull"), "RENAME_COLLISION");
    expect(err.details.ids).toEqual(["Hull.power"]);
    await rejects(e.rename("Car", "has space"), "INVALID_ID");
    await rejects(e.rename("garage", "Fleet"), "INVALID_ID");
    await rejects(e.rename("Nope", "Other"), "NOT_FOUND");
    expect(await snapshot()).toEqual(before);
    await writeFile(join(root, "models/broken.json"), "{");
    await e.reload();
    await rejects(e.rename("Car", "Vehicle"), "RENAME_BLOCKED");
  });

  it("does not count pre-existing errors that only change name with the rename", async () => {
    const garage = await json<Model>("models/garage.json");
    garage.diagrams = (garage.diagrams ?? []).map((d) =>
      d.id === "overview" ? { ...d, elements: [...(d.elements ?? []), { idref: "Car.ghost" }] } : d,
    );
    await writeFile(join(root, "models/garage.json"), serialize("model", garage));
    const e = await open();
    await e.rename("Car", "Vehicle");
    expect(e.status().findings.map((f) => f.message)).toEqual([
      "reference to Vehicle.ghost, which does not exist",
    ]);
  });
});

describe("reload (REQ-007)", () => {
  it("reloads external changes with a semantic diff and ignores its own writes", async () => {
    const e = await open();
    const events: ChangeEvent[] = [];
    e.on("change", (c) => events.push(c));
    const m = await json<Model>("models/types.json");
    await e.transact([{ op: "put", path: "models/types.json", data: { ...m, name: "mine" } }]);
    expect(await e.reload()).toBeUndefined();
    await writeFile(
      join(root, "models/extra.json"),
      serialize("model", { format_version: "1.0", id: "extra", name: "Extra" }),
    );
    const diff = await e.reload();
    expect(diff?.added).toEqual(["extra"]);
    expect(diff?.documents).toEqual(["models/extra.json"]);
    expect(events.map((x) => x.source)).toEqual(["engine", "external"]);
  });

  it("watches knowledge/ and batches a burst of changes into one reload", async () => {
    const e = await open({ watch: true, debounceMs: 150 });
    const c = await writeUntilChange(
      e,
      async () => {
        for (const id of ["a", "b", "c"]) {
          await writeFile(
            join(root, `models/${id}.json`),
            serialize("model", { format_version: "1.0", id, name: id }),
          );
        }
      },
      (x) => x.source === "external",
    );
    expect(c.diff.added).toEqual(["a", "b", "c"]);
  });

  it("reports a file that becomes invalid and recovers when it is fixed", async () => {
    const e = await open({ watch: true, debounceMs: 50 });
    const original = await text("models/types.json");
    await writeUntilChange(e, () => writeFile(join(root, "models/types.json"), "<<<<<<< ours\n"));
    expect(e.status().state).toBe("degraded");
    await writeUntilChange(e, () => writeFile(join(root, "models/types.json"), original));
    expect(e.status().state).toBe("ok");
  });
});

describe("review S5 (H1-H10)", () => {
  it("H1: validates against external changes not yet reloaded in other documents", async () => {
    const e = await open();
    const types = await json<Model>("models/types.json");
    const real = types.elements?.primitive_types?.[0]?.id ?? "";
    types.elements = {
      ...types.elements,
      primitive_types: (types.elements?.primitive_types ?? []).filter((t) => t.id !== real),
    };
    await writeFile(join(root, "models/types.json"), serialize("model", types));
    // The batch adds a reference to the type that was removed outside the engine.
    const garage = await json<Model>("models/garage.json");
    const g = garage.elements?.classes?.find((c) => c.id === "Garage");
    if (!g) throw new Error("Garage not found");
    g.attributes = [
      ...(g.attributes ?? []),
      { id: "Garage.extra", name: "extra", visibility: "public", type: { idref: real } },
    ];
    const err = await rejects(
      e.transact([{ op: "put", path: "models/garage.json", data: garage }]),
      "VALIDATION_FAILED",
    );
    expect(err.details.findings?.some((f) => f.code === "REF_UNRESOLVED")).toBe(true);
  });

  it("H2: an automatic reload error without listener is reported in status, not thrown", async () => {
    const e = await open({ watch: true, debounceMs: 20 });
    // Wait until the watcher is live (see writeUntilChange) before removing the root.
    await writeUntilChange(e, () =>
      writeFile(
        join(root, "models/live.json"),
        serialize("model", { format_version: "1.0", id: "live", name: "live" }),
      ),
    );
    await rm(root, { recursive: true, force: true });
    await expect.poll(() => e.status().watchError, { timeout: 4000 }).toBeDefined();
  });

  it("H3: pre-existing errors are compared by subject, not by words of the message", async () => {
    const garage = await json<Model>("models/garage.json");
    garage.diagrams = [...(garage.diagrams ?? []), { id: "diagram", kind: "class", name: "d" }];
    await writeFile(join(root, "models/garage.json"), serialize("model", garage));
    const layout = { format_version: "1.0", diagram: { idref: "diagram" } };
    await writeFile(join(root, "layout/other.json"), serialize("layout", layout));
    const e = await open();
    expect(e.status().findings.map((f) => f.code)).toEqual(["FILE_ID_MISMATCH"]);
    await e.rename("diagram", "d2");
    expect(e.status().findings.map((f) => [f.code, f.subjects])).toEqual([
      ["FILE_ID_MISMATCH", ["d2"]],
    ]);
  });

  it("H4: a file is moved only when it is named after its own ID", async () => {
    await writeFile(
      join(root, "models/car.json"),
      serialize("model", { format_version: "1.0", id: "other", name: "o" }),
    );
    const e = await open();
    await e.rename("Car", "car");
    await e.rename("car", "auto");
    expect(Object.keys(await snapshot())).toContain("models/car.json");
  });

  it("H5: an unread document path (link outside knowledge/) blocks rename", async () => {
    const outside = join(dir, "ext.json");
    await writeFile(outside, "{}");
    await symlink(outside, join(root, "models/ext.json"));
    const e = await open();
    const err = await rejects(e.rename("Car", "Vehicle"), "RENAME_BLOCKED");
    expect(err.details.paths).toEqual(["models/ext.json"]);
  });

  it("H8: a broken local directory does not prevent opening; writes fail confined", async () => {
    await writeFile(join(root, ".ai-submind"), "not a directory");
    const e = await open();
    expect(e.status().state).toBe("ok");
    expect(e.status().localError).toMatch(/\.ai-submind/);
    const m = await json<Model>("models/types.json");
    await rejects(
      e.transact([{ op: "put", path: "models/types.json", data: { ...m, name: "x" } }]),
      "PATH_OUTSIDE_KNOWLEDGE",
    );
  });

  it("H9: non-JSON data and invalid resulting IDs are typed errors", async () => {
    const e = await open();
    await rejects(
      e.transact([{ op: "put", path: "models/x.json", data: { id: 1n } }]),
      "VALIDATION_FAILED",
    );
    const err = await rejects(e.rename("Car", "V".repeat(250)), "INVALID_ID");
    expect(err.details.ids?.length).toBeGreaterThan(0);
  });

  it("H10: an empty batch writes nothing and emits no event", async () => {
    const e = await open();
    const events: ChangeEvent[] = [];
    e.on("change", (c) => events.push(c));
    expect((await e.transact([])).revisions).toEqual({});
    expect(events).toEqual([]);
  });

  it("H10: continuous writes do not postpone the reload beyond maxWaitMs", async () => {
    const e = await open({ watch: true, debounceMs: 200, maxWaitMs: 400 });
    const change = nextChange(e, (c) => c.source === "external");
    const start = Date.now();
    const ctl = { stop: false };
    void (async () => {
      for (let i = 0; !ctl.stop; i++) {
        await writeFile(join(root, "notes.txt"), String(i));
        await new Promise((r) => setTimeout(r, 50));
      }
    })();
    await change;
    ctl.stop = true;
    expect(Date.now() - start).toBeLessThan(1500);
  });
});

describe("dry run and builders (PLAN-002 S8; REQ-027, DEC-015)", () => {
  it("a dry run validates and returns the real write's diff, but writes nothing", async () => {
    const e = await open();
    const before = await snapshot();
    const m = await json<Model>("models/types.json");
    const ops = [{ op: "put" as const, path: "models/types.json", data: { ...m, name: "T" } }];
    const events: ChangeEvent[] = [];
    e.on("change", (c) => events.push(c));
    const gen = e.generation;
    const dry = await e.transact(ops, { dryRun: true });
    expect(await snapshot()).toEqual(before);
    expect(e.generation).toBe(gen);
    expect(events).toEqual([]);
    const real = await e.transact(ops);
    expect(dry).toEqual(real);
  });

  it("a dry run still fails validation like the real write", async () => {
    const e = await open();
    await rejects(
      e.transact([{ op: "delete", path: "models/types.json" }], { dryRun: true }),
      "VALIDATION_FAILED",
    );
  });

  it("a dry rename plans the same revisions without touching disk", async () => {
    const e = await open();
    const before = await snapshot();
    const dry = await e.rename("Car", "Vehicle", { dryRun: true });
    expect(await snapshot()).toEqual(before);
    expect(e.get("Car")).toHaveLength(1);
    expect(dry).toEqual(await e.rename("Car", "Vehicle"));
  });

  it("a builder runs after pending external changes are loaded", async () => {
    const e = await open();
    const m = await json<Model>("models/types.json");
    await writeFile(join(root, "models/types.json"), serialize("model", { ...m, name: "Ext" }));
    const r = await e.transact(() => {
      const cur = e.document("models/types.json")?.data as Model;
      expect(cur.name).toBe("Ext");
      return [
        {
          op: "put",
          path: "models/types.json",
          data: { ...cur, name: "Mine" },
          expectedRevision: e.revision("models/types.json"),
        },
      ];
    });
    expect(Object.keys(r.revisions)).toEqual(["models/types.json"]);
    expect((await json<Model>("models/types.json")).name).toBe("Mine");
  });
});
