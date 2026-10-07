import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FloFolder } from "./folder.js";
import { createServer } from "./tools.js";

const node = (id: string, extra: string[] = []): string =>
  ["---", `id: ${id}`, `title: Nodo ${id}`, "memory_type: long_term", ...extra, "---", "Cuerpo.", ""].join("\n");

const FILES: Record<string, string> = {
  "catalogo.flo": "entity api\n",
  "kb/a.md": node("a", ["type_tags: [decision]", 'use: ["../catalogo.flo"]', "relations:", "  - target: api", "    type: affects"]),
  "kb/c.md": node("c", ['use: ["./a.md"]', "relations:", "  - target: a", "    type: affects"]),
};

/** Los tests de mayúsculas solo tienen sentido en un FS case-insensitive (macOS/Windows). */
const CASE_INSENSITIVE_FS = ((): boolean => {
  const dir = mkdtempSync(join(tmpdir(), "tejo-case-"));
  writeFileSync(join(dir, "case.txt"), "");
  const insensitive = existsSync(join(dir, "CASE.txt"));
  rmSync(dir, { recursive: true, force: true });
  return insensitive;
})();

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const undo of cleanup.splice(0)) undo();
});

async function connect(files: Record<string, string> = FILES): Promise<{ folder: FloFolder; client: Client; call: (name: string, args?: Record<string, unknown>) => Promise<{ isError: boolean; value: any }> }> {
  const root = mkdtempSync(join(tmpdir(), "tejo-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const folder = new FloFolder(root);
  folder.load();
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await createServer(folder).connect(serverSide);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientSide);
  cleanup.push(() => void client.close());
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = text;
    }
    return { isError: result.isError === true, value };
  };
  return { folder, client, call };
}

describe("tejo mcp tools", () => {
  it("reports the version from package.json", async () => {
    const { client } = await connect();
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(client.getServerVersion()?.version).toBe(pkg.version);
  });

  it("sends instructions whose example note is valid", async () => {
    const { client, call } = await connect({ ...FILES, "decisiones/pkce.md": node("decision_pkce") });
    const instructions = client.getInstructions() ?? "";
    for (const tool of ["query", "get_node", "list_tags", "check", "write_node"]) expect(instructions).toContain(tool);
    const example = /```markdown\n([\s\S]*?)```/.exec(instructions)?.[1];
    expect(example).toBeDefined();
    expect(await call("write_node", { path: "notas/ejemplo.md", content: example })).toEqual({ isError: false, value: { ok: true, uri: "notas/ejemplo.md" } });
  });

  it("lists the five tools", async () => {
    const { client } = await connect();
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(["query", "get_node", "list_tags", "check", "write_node"]);
  });

  it("query runs the core query", async () => {
    const { call } = await connect();
    const { isError, value } = await call("query", { where: { typeTag: "decision" }, depth: 1 });
    expect(isError).toBe(false);
    expect(value.nodes.map((n: { id: string }) => n.id)).toEqual(["a", "api", "c"]);
    expect(value.edges).toEqual([
      { from: "a", to: "api", type: "affects" },
      { from: "c", to: "a", type: "affects" },
    ]);
  });

  it("query rejects malformed options before reaching the core", async () => {
    const { call } = await connect();
    for (const args of [
      { where: { type_tag: "decision" } },
      { where: {} },
      { where: { and: { text: "x" } } },
      { where: { text: 3 } },
      { depth: -1 },
      { depth: 1.5 },
      { project: "todo" },
      { from: "a" },
      { bogus: 1 },
    ]) {
      const { isError, value } = await call("query", args);
      expect(isError, JSON.stringify(args)).toBe(true);
      expect(value).toMatch(/Input validation error/);
    }
  });

  it("get_node returns the node with its outgoing and incoming relations", async () => {
    const { call } = await connect();
    const a = await call("get_node", { id: "a", project: "full" });
    expect(a.value.node).toMatchObject({ id: "a", distance: 0, body: "Cuerpo.\n" });
    expect(a.value.outgoing).toEqual([{ type: "affects", target: "api", resolved: { kind: "entity", id: "api" } }]);
    expect(a.value.incoming).toEqual([{ from: "c", type: "affects", target: "a" }]);
    const missing = await call("get_node", { id: "nada" });
    expect(missing).toEqual({ isError: true, value: { error: "no existe la entidad 'nada'" } });
  });

  it("list_tags returns the tag catalog", async () => {
    const { call } = await connect();
    expect((await call("list_tags")).value).toEqual({ typeTags: ["decision"], contextTags: [], customTags: {}, relationTypes: ["affects"] });
  });

  it("rejects unknown arguments to list_tags", async () => {
    const { call } = await connect();
    expect((await call("list_tags", { extra: 1 })).isError).toBe(true);
  });

  it("reports an error thrown inside a tool as JSON", async () => {
    const { folder, call } = await connect();
    vi.spyOn(folder, "link").mockImplementation(() => {
      throw new Error("se rompió el link");
    });
    for (const name of ["query", "list_tags", "check"]) {
      expect(await call(name), name).toEqual({ isError: true, value: { error: "se rompió el link" } });
    }
  });

  it("check returns the workspace or one file's diagnostics", async () => {
    const { call } = await connect();
    expect(await call("check")).toEqual({ isError: false, value: {} });
    expect(await call("check", { path: "kb/a.md" })).toEqual({ isError: false, value: { "kb/a.md": [] } });
    expect(await call("check", { path: "../fuera.md" })).toEqual({ isError: true, value: { error: "'../fuera.md' no es un documento del workspace" } });
  });

  it.runIf(CASE_INSENSITIVE_FS)("check canonizes a case-variant path like write_node", async () => {
    const { call } = await connect();
    expect(await call("check", { path: "KB/a.md" })).toEqual({ isError: false, value: { "kb/a.md": [] } });
  });

  it("write_node rejects invalid content and path escapes, and writes valid content", async () => {
    const { call } = await connect();
    const invalid = await call("write_node", { path: "kb/m.md", content: node("m").replace("long_term", "forever") });
    expect(invalid.isError).toBe(true);
    expect(invalid.value.diagnostics).toEqual([expect.objectContaining({ uri: "kb/m.md", code: "E064" })]);
    const outside = await call("write_node", { path: "../m.md", content: node("m") });
    expect(outside).toMatchObject({ isError: true, value: { ok: false, error: expect.stringMatching(/sale de la carpeta raíz/) } });
    expect(await call("write_node", { path: "kb/m.md", content: node("m") })).toEqual({ isError: false, value: { ok: true, uri: "kb/m.md" } });
    expect((await call("query", { from: ["m"] })).value.nodes).toHaveLength(1);
  });

  it("write_node accepts a new type_tag and relation type, and list_tags lists them", async () => {
    const { call } = await connect();
    const content = node("m", ["type_tags: [nuevo_tag]", 'use: ["../catalogo.flo"]', "relations:", "  - target: api", "    type: inventada"]);
    expect(await call("write_node", { path: "kb/m.md", content })).toEqual({ isError: false, value: { ok: true, uri: "kb/m.md" } });
    const tags = (await call("list_tags")).value;
    expect(tags.typeTags).toContain("nuevo_tag");
    expect(tags.relationTypes).toContain("inventada");
  });

  it("a change on disk shows up in the next query", async () => {
    const { folder, call } = await connect();
    const watcher = folder.watch();
    cleanup.push(() => watcher.close());
    // fs.watch no avisa cuándo está listo: lo escrito enseguida puede perderse mientras arranca.
    await new Promise((done) => setTimeout(done, 200));
    writeFileSync(join(folder.root, "kb/w.md"), node("w", ["type_tags: [decision]"]));
    await vi.waitFor(
      async () => expect((await call("query", { where: { typeTag: "decision" } })).value.nodes.map((n: { id: string }) => n.id)).toEqual(["a", "w"]),
      { timeout: 5000, interval: 50 }
    );
  }, 15000);
});
