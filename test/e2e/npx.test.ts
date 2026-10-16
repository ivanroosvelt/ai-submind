// End to end from the real tarball (PLAN-002 S12; REQ-001, API-003, NFR-001, NFR-009, DEC-001): `npm pack` →
// install into a fresh git repository → `npx ai-submind init` → `serve` → an MCP client over `ai-submind mcp`
// creates a diagram → the UI HTTP API shows it → git sees readable JSON in knowledge/ → `stop`.
import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
// Outer `npm test` leaks npm_* config into the environment; the nested npm must see a clean one.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.toLowerCase().startsWith("npm_")),
) as Record<string, string>;

let root = "";
let serving: ChildProcess | undefined;
let transport: StdioClientTransport | undefined;

// Sync calls block the event loop, so Vitest's timeout cannot stop a hung npm: each call carries its own.
const run = (cwd: string, cmd: string, ...args: string[]): string =>
  execFileSync(cmd, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
// `--no`: never fetch `ai-submind` from the registry; only the locally installed tarball may answer.
const npx = (cwd: string, ...args: string[]): string =>
  run(cwd, "npx", "--no", "ai-submind", ...args);

async function until(check: () => boolean, what: () => string, ms: number): Promise<void> {
  for (const deadline = Date.now() + ms; !check();) {
    if (Date.now() > deadline) throw new Error(what());
    await sleep(50);
  }
}

afterAll(async () => {
  // Never leave a daemon or a proxy behind, whatever failed.
  await transport?.close().catch(() => undefined);
  if (root !== "")
    spawnSync("npx", ["--no", "ai-submind", "stop"], {
      cwd: join(root, "repo"),
      env,
      timeout: 15_000,
    });
  if (serving?.exitCode === null) serving.kill("SIGKILL");
  if (root !== "") await rm(root, { recursive: true, force: true });
});

describe("npx ai-submind from the packed tarball", () => {
  it("init → serve → MCP creates a diagram → UI API shows it → readable git diff → stop", async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "ai-submind-e2e-")));
    const repo = join(root, "repo");
    await mkdir(repo);

    // dist/ is fresh: test/build-dist.ts built it. No prepack script, so `npm pack` does not rebuild it.
    const [packed] = JSON.parse(run(REPO, "npm", "pack", "--json", "--pack-destination", root)) as {
      filename: string;
      files: { path: string }[];
    }[];
    if (packed === undefined) throw new Error("npm pack printed nothing");
    const files = packed.files.map((f) => f.path);
    expect(files).toEqual(
      expect.arrayContaining([
        "dist/cli/main.js",
        "dist/ui/index.html",
        "dist/ui/THIRD-PARTY-LICENSES.md",
        "spec/format/schema/1.0/model.schema.json",
      ]),
    );
    expect(files.filter((f) => f.startsWith("test/") || f.startsWith("src/"))).toEqual([]);

    run(repo, "git", "init", "-q");
    run(repo, "git", "config", "user.email", "e2e@example.invalid");
    run(repo, "git", "config", "user.name", "e2e");
    await writeFile(join(repo, ".gitignore"), "node_modules/\n");
    // Dependencies come from the npm cache (npm ci ran before the suite); the network is only a fallback.
    run(
      repo,
      "npm",
      "install",
      join(root, packed.filename),
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
    );
    const notices = await readFile(
      join(repo, "node_modules", "ai-submind", "dist", "ui", "THIRD-PARTY-LICENSES.md"),
      "utf8",
    );
    expect(notices).toMatch(/^## @joint\/core - [\d.]+ \(MPL-2\.0\)$/m);

    expect(npx(repo, "init")).toMatch(/^initialized /);
    run(repo, "git", "add", "-A");
    run(repo, "git", "commit", "-q", "-m", "init");

    serving = spawn("npx", ["--no", "ai-submind", "serve", "--port", "0"], { cwd: repo, env });
    let log = "";
    serving.stderr?.on("data", (c: Buffer) => (log += c.toString()));
    await until(
      () => log.includes("listening on "),
      () => `serve did not start:\n${log}`,
      20_000,
    );
    const runtime = JSON.parse(
      await readFile(join(repo, "knowledge", ".ai-submind", "runtime.json"), "utf8"),
    ) as { url: string; token: string };
    const get = async (path: string): Promise<Response> =>
      fetch(new URL(path, runtime.url), { headers: { authorization: `Bearer ${runtime.token}` } });

    transport = new StdioClientTransport({
      command: "npx",
      args: ["--no", "ai-submind", "mcp"],
      cwd: repo,
      env,
      stderr: "pipe",
    });
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(transport);
    const call = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      const r = await client.callTool({ name, arguments: args });
      if (r.isError === true) throw new Error(`${name}: ${JSON.stringify(r.content)}`);
      return r.structuredContent;
    };
    expect(await call("create_element", { type: "model", data: { name: "Shop" } })).toMatchObject({
      created: ["shop"],
    });
    await call("create_element", {
      type: "class",
      parent: "shop",
      data: { name: "Product", visibility: "public" },
    });
    await call("create_element", {
      type: "diagram",
      parent: "shop",
      data: { id: "catalog", name: "Catalog", kind: "class" },
    });
    await call("edit_diagram", { id: "catalog", add: ["Product"] });

    const listed = (await (await get("api/diagrams")).json()) as { diagrams: { id: string }[] };
    expect(listed.diagrams.map((d) => d.id)).toContain("catalog");
    const view = await get("api/diagram?id=catalog");
    expect(view.status).toBe(200);
    expect(await view.text()).toContain('"Product"');
    const page = await get("/");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<title>ai-submind</title>");

    // git sees the new model as readable, indented JSON; the local .ai-submind/ stays ignored.
    const status = run(repo, "git", "status", "--porcelain", "--untracked-files=all");
    expect(status).toContain("knowledge/models/shop.json");
    expect(status).not.toContain(".ai-submind");
    run(repo, "git", "add", "-A");
    const diff = run(repo, "git", "diff", "--cached", "--", "knowledge");
    expect(diff).toMatch(/^\+\s+"name": "Product",?$/m);
    expect(diff).toMatch(/^\+\s+"kind": "class",?$/m);

    await transport.close();
    expect(npx(repo, "stop")).toMatch(/^stopped \(pid \d+\)/);
    const server = serving;
    await until(
      () => server.exitCode !== null,
      () => "serve did not exit after stop",
      10_000,
    );
  }, 180_000);
});
