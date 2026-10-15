// MCP tools and resources in process (PLAN-002 S8; API-001, DEC-016): tool list and schemas, results as
// structured content, typed errors, and resources, through the SDK client over an in-memory transport.
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Engine } from "../../src/engine/index.js";
import { createMcpServer } from "../../src/mcp/tools.js";
import { createQuery } from "../../src/query/index.js";

const GARAGE = new URL("../../spec/format/examples/valid/garage/knowledge/", import.meta.url)
  .pathname;

let dir: string;
let engine: Engine;
let client: Client;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-submind-mcp-"));
  await cp(GARAGE, join(dir, "knowledge"), { recursive: true });
  engine = await Engine.open(join(dir, "knowledge"));
  const server = createMcpServer(engine, createQuery(engine), "0.0.0-test");
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  client = new Client({ name: "test", version: "0" });
  await client.connect(b);
});

afterEach(async () => {
  await client.close();
  engine.close();
  await rm(dir, { recursive: true, force: true });
});

type Call = Awaited<ReturnType<Client["callTool"]>>;
const call = (name: string, args: Record<string, unknown> = {}): Promise<Call> =>
  client.callTool({ name, arguments: args });
const errorOf = (r: Call): { code: string; details: Record<string, unknown> } =>
  (r.structuredContent as { error: { code: string; details: Record<string, unknown> } }).error;

describe("tools", () => {
  it("lists every tool with an input schema; reads are annotated read-only", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "apply_batch",
        "create_element",
        "delete_element",
        "edit_diagram",
        "find_elements",
        "get_element",
        "impact",
        "list_diagrams",
        "list_models",
        "paths",
        "relations",
        "rename",
        "search",
        "update_element",
        "validate",
      ].sort(),
    );
    const get = tools.find((t) => t.name === "get_element");
    expect(get?.inputSchema.required).toEqual(["id"]);
    expect(get?.annotations?.readOnlyHint).toBe(true);
    const del = tools.find((t) => t.name === "delete_element");
    expect(del?.inputSchema.properties).toHaveProperty("cascade");
    expect(del?.annotations?.destructiveHint).toBe(true);
    // Every write but create can remove or overwrite data (H3 of the S8 review).
    const destructive = tools.filter((t) => t.annotations?.destructiveHint).map((t) => t.name);
    expect(destructive.sort()).toEqual(
      ["apply_batch", "delete_element", "edit_diagram", "rename", "update_element"].sort(),
    );
    expect(tools.find((t) => t.name === "create_element")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
  });

  it("returns query results as structured content", async () => {
    const r = await call("get_element", { id: "Car" });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ data: { id: "Car", type: "class" } });
    expect(JSON.parse((r.content[0] as { text: string }).text)).toEqual(r.structuredContent);
    const s = await call("search", { text: "engine", limit: 1 });
    expect((s.structuredContent as { data: { items: unknown[] } }).data.items).toHaveLength(1);
    const v = await call("validate");
    expect(v.structuredContent).toMatchObject({ state: "ok", errors: 0, warnings: 0 });
  });

  it("maps engine and query errors to typed tool errors", async () => {
    const nf = await call("get_element", { id: "Nope" });
    expect(nf.isError).toBe(true);
    expect(errorOf(nf).code).toBe("NOT_FOUND");
    expect((nf.content[0] as { text: string }).text).toMatch(/^NOT_FOUND: /);

    const invalid = await call("create_element", {
      type: "class",
      parent: "garage",
      data: { name: "Bus" },
    });
    expect(errorOf(invalid).code).toBe("VALIDATION_FAILED");
    expect(errorOf(invalid).details.findings).toBeDefined();

    const referenced = await call("delete_element", { id: "Truck" });
    expect(errorOf(referenced).code).toBe("REFERENCED");
    expect(errorOf(referenced).details.references).toBeDefined();
  });

  it("rejects unknown arguments", async () => {
    const r = await call("get_element", { id: "Car", extra: 1 });
    expect(r.isError).toBe(true);
  });

  it("writes through edit tools, honours dryRun and renames", async () => {
    const dry = await call("update_element", { id: "Car", patch: { name: "X" }, dryRun: true });
    expect(dry.structuredContent).toMatchObject({
      dryRun: true,
      diff: { changed: expect.arrayContaining(["Car"]) as unknown },
    });
    expect((engine.get("Car")[0]?.node as { name: string }).name).toBe("Car");
    const batch = await call("apply_batch", {
      operations: [
        {
          op: "create",
          type: "class",
          parent: "garage",
          data: { name: "Bus", visibility: "public" },
        },
        { op: "edit_diagram", id: "overview", add: ["Bus"] },
      ],
    });
    expect(batch.structuredContent).toMatchObject({ created: ["Bus"] });
    const ren = await call("rename", { id: "Bus", newId: "Coach" });
    expect(ren.structuredContent).toMatchObject({ renamed: [["Bus", "Coach"]] });
  });
});

describe("path confinement (NFR-006)", () => {
  it("IDs that would escape knowledge/ are typed errors and write nothing outside", async () => {
    const before = (await readdir(dir, { recursive: true })).sort();
    const attempts: [string, Record<string, unknown>, string][] = [
      [
        "create_element",
        { type: "model", data: { id: "../../evil", name: "Evil" } },
        "PATH_OUTSIDE_KNOWLEDGE",
      ],
      ["create_element", { type: "model", data: { id: "a/b", name: "Evil" } }, "INVALID_PATH"],
      [
        "create_element",
        { type: "diagram", parent: "garage", data: { id: "../../evil", name: "E", kind: "class" } },
        "VALIDATION_FAILED", // the schema's ID pattern; no layout is written for a new diagram
      ],
      ["rename", { id: "garage", newId: "../x" }, "INVALID_ID"],
      ["rename", { id: "overview", newId: "../../evil" }, "INVALID_ID"],
    ];
    for (const [name, args, code] of attempts) {
      const r = await call(name, args);
      expect(r.isError, `${name} ${JSON.stringify(args)}`).toBe(true);
      expect(errorOf(r).code).toBe(code);
    }
    expect((await readdir(dir, { recursive: true })).sort()).toEqual(before);
    expect(await readdir(join(dir, ".."))).not.toContain("evil.json");
  });
});

describe("resources", () => {
  it("lists models and diagrams and reads them and the format schemas", async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain("ai-submind://model/garage");
    expect(uris).toContain("ai-submind://diagram/overview");
    expect(uris).toContain("ai-submind://schema/model");
    const text = async (uri: string): Promise<unknown> => {
      const r = await client.readResource({ uri });
      return JSON.parse((r.contents[0] as { text: string }).text);
    };
    expect(await text("ai-submind://model/types")).toMatchObject({ id: "types" });
    expect(await text("ai-submind://diagram/overview")).toMatchObject({
      diagram: { id: "overview" },
      layout: { diagram: { idref: "overview" } },
    });
    expect(await text("ai-submind://diagram/check-fuel")).toMatchObject({ layout: null });
    expect(await text("ai-submind://schema/defs")).toHaveProperty("$id");
  });
});
