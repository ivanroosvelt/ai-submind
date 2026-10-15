// MCP over the daemon's HTTP route (PLAN-002 S8; API-001, FEAT-001, NFR-004, DEC-014, DEC-016): an
// agent flow from an empty project, dry run, and the daemon's auth/Host/Origin checks in front of /mcp.
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveProject } from "../../src/daemon/project.js";
import { startDaemon, type DaemonHandle } from "../../src/daemon/server.js";

const REPO = fileURLToPath(new URL("../../", import.meta.url));

let dir: string;
let daemon: DaemonHandle;
let client: Client;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-submind-mcp-http-"));
  const r = await startDaemon(await resolveProject(dir), { port: 0 });
  if (r.status !== "started") throw new Error("expected a new daemon");
  daemon = r.daemon;
  client = new Client({ name: "test", version: "0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("mcp", daemon.url), {
      requestInit: { headers: { authorization: `Bearer ${daemon.token}` } },
    }),
  );
});

afterEach(async () => {
  await client.close();
  await daemon.close();
  await rm(dir, { recursive: true, force: true });
});

const call = async (name: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError === true) throw new Error(JSON.stringify(r.content));
  return r.structuredContent;
};

const files = async (): Promise<string[]> =>
  (await readdir(join(dir, "knowledge"), { recursive: true })).filter(
    (f) => !f.startsWith(".ai-submind"),
  );

function post(headers: Record<string, string>): Promise<number> {
  return new Promise((ok, fail) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port: daemon.port,
        path: "/mcp",
        method: "POST",
        headers: {
          host: `127.0.0.1:${String(daemon.port)}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...headers,
        },
      },
      (res) => {
        res.resume();
        ok(res.statusCode ?? 0);
      },
    );
    req.on("error", fail).end(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
  });
}

describe("MCP over HTTP", () => {
  it("builds a model from an empty project and finds it again", async () => {
    expect(await files()).toEqual([]);
    expect(await call("create_element", { type: "model", data: { name: "Shop" } })).toMatchObject({
      initialized: true,
      created: ["shop"],
    });
    await call("apply_batch", {
      operations: [
        {
          op: "create",
          type: "class",
          parent: "shop",
          data: { name: "Order", visibility: "public", documentation: "A customer order." },
        },
        {
          op: "create",
          type: "diagram",
          parent: "shop",
          data: { name: "Main", kind: "class", elements: [{ idref: "Order" }] },
        },
      ],
    });
    const hits = (await call("search", { text: "customer order" })) as {
      data: { items: { id: string }[] };
    };
    expect(hits.data.items[0]?.id).toBe("Order");
    expect(await call("get_element", { id: "main" })).toMatchObject({
      data: { type: "diagram", model: "shop" },
    });
    expect(await call("validate")).toMatchObject({ state: "ok", errors: 0 });
    expect((await files()).sort()).toEqual(["ai-submind.json", "models", "models/shop.json"]);
  });

  it("a dry run on an empty project validates but writes nothing (REQ-027)", async () => {
    const r = await call("create_element", {
      type: "model",
      data: { name: "Shop" },
      dryRun: true,
    });
    expect(r).toMatchObject({ dryRun: true, initialized: true, created: ["shop"] });
    expect(await files()).toEqual([]);
  });

  it("/mcp is behind the daemon's token, Host and Origin checks", async () => {
    expect(await post({})).toBe(401);
    expect(await post({ authorization: "Bearer wrong" })).toBe(401);
    const auth = { authorization: `Bearer ${daemon.token}` };
    expect(await post({ ...auth, host: "evil.example" })).toBe(403);
    expect(await post({ ...auth, origin: "http://evil.example" })).toBe(403);
  });
});

describe("module rules", () => {
  it("src/mcp may not import src/daemon (negative control of the dependency rule)", async () => {
    const probe = await mkdtemp(join(tmpdir(), "ai-submind-depcruise-"));
    try {
      await mkdir(join(probe, "src", "mcp"), { recursive: true });
      await mkdir(join(probe, "src", "daemon"), { recursive: true });
      await writeFile(join(probe, "src", "daemon", "b.ts"), "export const b = 1;\n");
      await writeFile(
        join(probe, "src", "mcp", "a.ts"),
        'import { b } from "../daemon/b.js";\nexport const a = b;\n',
      );
      await cp(join(REPO, "tsconfig.json"), join(probe, "tsconfig.json"));
      await cp(join(REPO, ".dependency-cruiser.cjs"), join(probe, ".dependency-cruiser.cjs"));
      const out = await new Promise<{ code: number; text: string }>((ok) => {
        execFile(
          join(REPO, "node_modules", ".bin", "depcruise"),
          ["src", "--config", ".dependency-cruiser.cjs"],
          { cwd: probe },
          (error, stdout, stderr) => {
            ok({ code: error ? Number(error.code ?? 1) : 0, text: stdout + stderr });
          },
        );
      });
      expect(out.code).not.toBe(0);
      expect(out.text).toContain("mcp-on-format-engine-query");
    } finally {
      await rm(probe, { recursive: true, force: true });
    }
  }, 30_000);
});
