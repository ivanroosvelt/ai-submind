// UI HTTP API of the daemon (PLAN-002 S9; API-002, REQ-028..REQ-033, NFR-004, DEC-017): static UI behind the
// token, read routes, layout writes with revision control and validation, rejection of every other write,
// and the SSE change stream. In-process daemon on port 0 over a copy of the garage corpus.
import { fileURLToPath } from "node:url";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveProject } from "../../src/daemon/project.js";
import { startDaemon, type DaemonHandle } from "../../src/daemon/server.js";
import { edit } from "../../src/engine/index.js";
import { serialize } from "../../src/format/canonical.js";
import { autoLayout, type DiagramInput } from "../../src/layout/class-layout.js";
import { autoLayoutSequence, sequenceGeometry } from "../../src/layout/sequence-layout.js";

const GARAGE = fileURLToPath(
  new URL("../../spec/format/examples/valid/garage/knowledge/", import.meta.url),
);

let dir: string;
let d: DaemonHandle;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-submind-ui-"));
  await cp(GARAGE, join(dir, "knowledge"), { recursive: true });
  const r = await startDaemon(await resolveProject(dir), { port: 0 });
  if (r.status !== "started") throw new Error("expected a new daemon");
  d = r.daemon;
});

afterEach(async () => {
  await d.close();
  await rm(dir, { recursive: true, force: true });
});

interface Reply {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

function call(
  path: string,
  { method = "GET", body, auth = true }: { method?: string; body?: string; auth?: boolean } = {},
): Promise<Reply> {
  return new Promise((ok, fail) => {
    const headers: Record<string, string> = { host: `127.0.0.1:${String(d.port)}` };
    if (auth) headers.authorization = `Bearer ${d.token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const req = httpRequest({ host: "127.0.0.1", port: d.port, path, method, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8").on("data", (c: string) => (text += c));
      res.on("end", () => {
        ok({ status: res.statusCode ?? 0, headers: res.headers, body: text });
      });
    });
    req.on("error", fail).end(body);
  });
}

const json = (r: Reply): unknown => JSON.parse(r.body);
const layoutFile = (): Promise<string> =>
  readFile(join(dir, "knowledge", "layout", "overview.json"), "utf8");
const snapshot = async (): Promise<string[]> => {
  const root = join(dir, "knowledge");
  const files = (await readdir(root, { recursive: true })).filter(
    (f) => f.endsWith(".json") && !f.startsWith(".ai-submind"),
  );
  return Promise.all(
    files.sort().map(async (f) => `${f}\n${await readFile(join(root, f), "utf8")}`),
  );
};

type View = DiagramInput & {
  revision: string;
  diagram: { id: string; kind: string };
  targets: Record<string, { id: string; kind: string }[]>;
};

describe("static UI (DEC-017, NFR-004)", () => {
  it("serves dist/ui behind the token with content types; the ?token= trade is unchanged", async () => {
    const page = await call("/");
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toMatch(/^text\/html/);
    expect(page.headers["x-content-type-options"]).toBe("nosniff");
    expect(page.headers["content-security-policy"]).toMatch(/default-src 'self'/);
    const asset = /\/assets\/[\w.-]+\.js/.exec(page.body)?.[0];
    expect(asset).toBeDefined();
    const js = await call(asset ?? "");
    expect(js.status).toBe(200);
    expect(js.headers["content-type"]).toMatch(/^text\/javascript/);
    expect((await call(asset ?? "", { auth: false })).status).toBe(401);
    expect((await call("/", { auth: false })).status).toBe(401);
    expect((await call(`/?token=${d.token}`, { auth: false })).status).toBe(303);
  });

  it("rejects traversal and unknown assets", async () => {
    for (const path of [
      "/assets/..%2f..%2fpackage.json",
      "/assets/..%2F..%2F..%2Fpackage.json",
      "/assets/%2e%2e/%2e%2e/package.json",
      "/assets/../../package.json",
      "/assets/.hidden",
      "/assets/missing.js",
      "/assets/",
    ]) {
      const r = await call(path);
      expect(r.status, path).toBe(404);
      expect(r.body, path).not.toContain('"name": "ai-submind"');
    }
  });
});

describe("read routes (REQ-028, REQ-031, REQ-033)", () => {
  it("lists the relations that reach an element, with the names of their sources (REQ-031)", async () => {
    const r = await call("/api/relations?id=Car");
    expect(r.status).toBe(200);
    const body = json(r) as { items: { from: string; to: string; kind: string; name?: string }[] };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((e) => e.to === "Car")).toBe(true);
    expect(body.items).toContainEqual(
      expect.objectContaining({ from: "Truck", kind: "generalization", name: "Truck" }) as unknown,
    );
    expect((await call("/api/relations?id=nope")).status).toBe(404);
    expect((await call("/api/relations")).status).toBe(400);
  });

  it("lists models and diagrams", async () => {
    const r = await call("/api/diagrams");
    expect(r.status).toBe(200);
    const body = json(r) as { models: { id: string }[]; diagrams: { id: string; kind: string }[] };
    expect(body.models.map((m) => m.id)).toEqual(["garage", "types"]);
    expect(body.diagrams.map((x) => x.id)).toEqual(["check-fuel", "overview", "rent-car"]);
  });

  it("returns a diagram with resolved elements, names, layout and revision", async () => {
    const r = await call("/api/diagram?id=overview");
    expect(r.status).toBe(200);
    const view = json(r) as View;
    expect(view.diagram.id).toBe("overview");
    expect(view.elements.find((e) => e.id === "Car")).toMatchObject({ type: "class" });
    expect(view.names.Integer).toBe("Integer");
    expect(view.layout?.diagram).toEqual({ idref: "overview" });
    expect(view.revision).toMatch(/^[0-9a-f]{64}:[0-9a-f]{64}$/);
    expect(view.formatVersion).toBe("1.1");
    // Drill-down targets computed by the server (REQ-042), also across models.
    expect(view.targets.Garage).toEqual([{ id: "RentCar", kind: "element" }]);
    expect((await call("/api/diagram?id=nope")).status).toBe(404);
    expect(json(await call("/api/diagram?id=nope"))).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
    expect((await call("/api/diagram?id=Car")).status).toBe(400);
    expect((await call("/api/diagram")).status).toBe(400);
  });

  it("returns the validation findings", async () => {
    await writeFile(join(dir, "knowledge", "layout", "overview.json"), "{");
    await d.engine.reload();
    const r = json(await call("/api/findings")) as {
      state: string;
      findings: { code: string; file: string }[];
    };
    expect(r.state).toBe("degraded");
    expect(r.findings.some((f) => f.file === "layout/overview.json")).toBe(true);
  });
});

describe("layout writes (REQ-029, VAL-005, NFR-005)", () => {
  const view = async (): Promise<View> => json(await call("/api/diagram?id=overview")) as View;
  const put = (body: unknown, diagram = "overview"): Promise<Reply> =>
    call(`/api/layout?diagram=${diagram}`, {
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("writes the layout canonically and returns the new revision", async () => {
    const v = await view();
    const layout = autoLayout(v);
    const r = await put({ layout, revision: v.revision });
    expect(r.status).toBe(200);
    const body = json(r) as { revision: string; generation: number };
    expect(await layoutFile()).toBe(serialize("layout", layout));
    expect(body.revision).toBe((await view()).revision);
    expect(body.revision).not.toBe(v.revision);
    expect(typeof body.generation).toBe("number");
    // A diagram without a layout gets one (revision with an empty layout part).
    const seq = json(await call("/api/diagram?id=check-fuel")) as View;
    expect(seq.revision).toMatch(/:$/);
  });

  it("reordering lifelines of a sequence diagram persists a canonical layout (DEC-018)", async () => {
    const v = json(await call("/api/diagram?id=rent-car")) as View;
    // What the UI saves after dragging car to the far left: the shown layout with car's new x.
    const layout = autoLayoutSequence(v, { keep: true });
    const car = layout.nodes?.["RentCar.car"];
    if (!car) throw new Error("car has no entry");
    car.x = 0;
    const r = await put({ layout, revision: v.revision }, "rent-car");
    expect(r.status).toBe(200);
    const text = await readFile(join(dir, "knowledge", "layout", "rent-car.json"), "utf8");
    expect(text).toBe(serialize("layout", layout));
    const after = json(await call("/api/diagram?id=rent-car")) as View;
    const order = [...sequenceGeometry(after).lifelines].sort((a, b) => a.x - b.x);
    expect(order.map((l) => l.id)).toEqual([
      "RentCar.car",
      "RentCar.customer",
      "RentCar.garage",
      "RentCar.contract",
    ]);
  });

  it("answers 409 REVISION_CONFLICT when the diagram or its layout changed since it was read", async () => {
    const v = await view();
    const before = await layoutFile();
    const stale = await put({ layout: autoLayout(v), revision: "0:0" });
    expect(stale.status).toBe(409);
    expect(json(stale)).toMatchObject({ error: { code: "REVISION_CONFLICT" } });
    // The model changes (e.g. through MCP) after the UI read the diagram.
    await edit(d.engine, [{ op: "update", id: "Car", patch: { documentation: "changed" } }]);
    const r = await put({ layout: autoLayout(v), revision: v.revision });
    expect(r.status).toBe(409);
    expect(await layoutFile()).toBe(before);
  });

  it("answers 400 to invalid layouts and bodies, 404 to unknown diagrams, 413 to huge bodies", async () => {
    const v = await view();
    const before = await snapshot();
    const layout = autoLayout(v);
    const bad: [unknown, string][] = [
      [{ layout: { ...layout, nodes: { Car: { x: 1.5, y: 0 } } }, revision: v.revision }, "x"],
      [{ layout: { ...layout, extra: 1 }, revision: v.revision }, "extra key"],
      [{ layout: { ...layout, diagram: { idref: "rent-car" } }, revision: v.revision }, "other"],
      [{ layout }, "no revision"],
      [{ layout, revision: v.revision, more: 1 }, "extra body key"],
      ["{not json", "json"],
      [[], "array"],
    ];
    for (const [body, why] of bad) {
      const r = await put(body);
      expect(r.status, why).toBe(400);
      expect(json(r), why).toHaveProperty("error.code");
    }
    expect((await put({ layout, revision: v.revision }, "../models/garage")).status).toBe(400);
    const elsewhere = { ...layout, diagram: { idref: "nope" } };
    expect((await put({ layout: elsewhere, revision: v.revision }, "nope")).status).toBe(404);
    // The daemon answers 413 as soon as the limit is known to be passed and closes without reading the
    // rest (H1): from Content-Length, or while reading a body without one. The request is never ended
    // here, so a daemon that kept reading would never answer. Closing at once may reset the connection
    // before the answer is read: either outcome is accepted.
    const oversize = (length: boolean): Promise<number | "reset"> =>
      new Promise((ok, fail) => {
        const headers: Record<string, string> = {
          host: `127.0.0.1:${String(d.port)}`,
          authorization: `Bearer ${d.token}`,
        };
        if (length) headers["content-length"] = String(3_000_000);
        const req = httpRequest(
          {
            host: "127.0.0.1",
            port: d.port,
            path: "/api/layout?diagram=overview",
            method: "PUT",
            headers,
          },
          (res) => {
            res.resume();
            ok(res.statusCode ?? 0);
          },
        );
        req.on("error", () => {
          ok("reset");
        });
        const chunk = "x".repeat(64 * 1024);
        for (let i = 0; i < 40; i++) req.write(chunk); // 2.5 MiB
        setTimeout(() => {
          fail(new Error("no answer before the end of the body"));
          req.destroy();
        }, 3000);
      });
    expect([413, "reset"]).toContain(await oversize(true));
    expect([413, "reset"]).toContain(await oversize(false));
    expect(await snapshot()).toEqual(before);
  });

  it("rejects every write that is not layout (REQ-032)", async () => {
    const before = await snapshot();
    for (const [method, path] of [
      ["PUT", "/api/diagram?id=overview"],
      ["POST", "/api/layout?diagram=overview"],
      ["DELETE", "/api/layout?diagram=overview"],
      ["PATCH", "/api/layout?diagram=overview"],
      ["POST", "/api/element"],
      ["DELETE", "/api/diagram?id=overview"],
      ["PUT", "/"],
    ] as const) {
      const r = await call(path, { method, body: "{}" });
      expect(r.status, `${method} ${path}`).toBe(405);
    }
    expect(await snapshot()).toEqual(before);
  });
});

describe("change events (REQ-030)", () => {
  /** Opens the SSE stream; `next` resolves with the data of the next `change` event. */
  function events(): Promise<{
    headers: IncomingHttpHeaders;
    next: () => Promise<Record<string, unknown>>;
    close: () => void;
  }> {
    return new Promise((ok, fail) => {
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port: d.port,
          path: "/api/events",
          headers: { host: `127.0.0.1:${String(d.port)}`, authorization: `Bearer ${d.token}` },
        },
        (res) => {
          let buffer = "";
          const waiting: ((v: Record<string, unknown>) => void)[] = [];
          const queue: Record<string, unknown>[] = [];
          res.setEncoding("utf8").on("data", (c: string) => {
            buffer += c;
            let i: number;
            while ((i = buffer.indexOf("\n\n")) >= 0) {
              const block = buffer.slice(0, i);
              buffer = buffer.slice(i + 2);
              if (!block.split("\n").includes("event: change")) continue;
              const data = block
                .split("\n")
                .find((l) => l.startsWith("data: "))
                ?.slice(6);
              const value = JSON.parse(data ?? "null") as Record<string, unknown>;
              const w = waiting.shift();
              if (w) w(value);
              else queue.push(value);
            }
          });
          ok({
            headers: res.headers,
            next: () =>
              new Promise((r) => {
                const q = queue.shift();
                if (q) r(q);
                else waiting.push(r);
              }),
            close: () => {
              req.destroy();
            },
          });
        },
      );
      req.on("error", fail).end();
    });
  }

  it("streams engine changes made through edits (MCP) and on disk; requires the token", async () => {
    expect((await call("/api/events", { auth: false })).status).toBe(401);
    const s = await events();
    try {
      expect(s.headers["content-type"]).toMatch(/^text\/event-stream/);
      await edit(d.engine, [{ op: "update", id: "Car", patch: { documentation: "via MCP" } }]);
      expect(await s.next()).toMatchObject({
        source: "engine",
        documents: ["models/garage.json"],
        generation: d.engine.generation,
      });
      // External write: FSEvents may start late (DEC-011), so write until the stream reports it.
      const file = join(dir, "knowledge", "models", "types.json");
      const text = await readFile(file, "utf8");
      const external = s.next();
      let n = 0;
      let got: Record<string, unknown> | undefined;
      while (got === undefined) {
        await writeFile(file, text.replace('"Types"', `"Types ${String(++n)}"`));
        got = await Promise.race([
          external,
          new Promise<undefined>((r) => setTimeout(r, 500, undefined)),
        ]);
      }
      expect(got).toMatchObject({ source: "external" });
    } finally {
      s.close();
    }
  });

  it("an open stream does not keep the listener after it closes nor block stop", async () => {
    const before = d.engine.listenerCount("change");
    const s = await events();
    await expect.poll(() => d.engine.listenerCount("change")).toBe(before + 1);
    s.close();
    await expect.poll(() => d.engine.listenerCount("change")).toBe(before);
    const open = await events();
    await expect.poll(() => d.engine.listenerCount("change")).toBe(before + 1);
    await d.close();
    expect(d.engine.listenerCount("change")).toBe(0);
    open.close();
  });
});
