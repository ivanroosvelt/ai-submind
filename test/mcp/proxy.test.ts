// `ai-submind mcp` as a real process (PLAN-002 S8; API-001, API-003, DEC-005, DEC-016): the stdio proxy starts
// the daemon when absent, keeps stdout for the protocol, and survives a daemon stop by restarting it.
import { execFile, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const MAIN = join(REPO, "dist", "cli", "main.js");

let dir: string;
const proxies: StdioClientTransport[] = [];

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), "ai-submind-proxy-")));
});

afterEach(async () => {
  // Never leave a daemon or a proxy behind, whatever failed.
  for (const t of proxies.splice(0)) {
    const pid = t.pid;
    await t.close().catch(() => undefined);
    if (pid !== null) spawnSync("kill", ["-9", String(pid)]);
  }
  spawnSync(process.execPath, [MAIN, "stop"], { cwd: dir });
  await rm(dir, { recursive: true, force: true });
});

interface Proxy {
  client: Client;
  transport: StdioClientTransport;
  stderr: () => string;
  errors: Error[];
}

async function connect(): Promise<Proxy> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MAIN, "mcp"],
    cwd: dir,
    stderr: "pipe",
  });
  proxies.push(transport);
  let stderr = "";
  transport.stderr?.on("data", (c: Buffer) => (stderr += c.toString()));
  const client = new Client({ name: "test", version: "0" });
  const errors: Error[] = [];
  client.onerror = (e) => errors.push(e);
  await client.connect(transport);
  return { client, transport, stderr: () => stderr, errors };
}

async function call(p: Proxy, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const r = await p.client.callTool({ name, arguments: args });
  if (r.isError === true) throw new Error(JSON.stringify(r.content));
  return r.structuredContent;
}

const runtimePid = async (): Promise<number> =>
  (
    JSON.parse(await readFile(join(dir, "knowledge", ".ai-submind", "runtime.json"), "utf8")) as {
      pid: number;
    }
  ).pid;

function stop(): Promise<{ code: number; stdout: string }> {
  return new Promise((ok) => {
    execFile(process.execPath, [MAIN, "stop"], { cwd: dir }, (error, stdout) => {
      ok({ code: error ? Number(error.code ?? 1) : 0, stdout });
    });
  });
}

describe("ai-submind mcp", () => {
  it("starts the daemon if absent; stdout carries only the protocol, logs go to stderr", async () => {
    expect(existsSync(join(dir, "knowledge"))).toBe(false);
    const p = await connect();
    expect((await p.client.listTools()).tools).toHaveLength(17);
    expect(
      await call(p, "create_element", { type: "model", data: { name: "Shop" } }),
    ).toMatchObject({ initialized: true, created: ["shop"] });
    expect(await call(p, "get_element", { id: "shop" })).toMatchObject({ data: { type: "model" } });
    expect(existsSync(join(dir, "knowledge", "models", "shop.json"))).toBe(true);
    expect(await runtimePid()).toBeGreaterThan(0);
    expect(p.errors).toEqual([]);
    expect(p.stderr()).toMatch(/ai-submind mcp: daemon pid \d+/);
  }, 30_000);

  it("survives `ai-submind stop`: the daemon exits within 5 s and the next call restarts it (R4)", async () => {
    const p = await connect();
    await call(p, "validate");
    const first = await runtimePid();
    const stopped = await stop();
    expect(stopped).toMatchObject({ code: 0, stdout: `stopped (pid ${String(first)})\n` });
    expect(await call(p, "validate")).toMatchObject({ state: "ok" });
    const second = await runtimePid();
    expect(second).not.toBe(first);
    expect(p.stderr()).toMatch(/connection refused; ensuring the daemon/);
    expect(p.errors).toEqual([]);
  }, 30_000);

  it("retries once on 401 when another process restarted the daemon on the same port", async () => {
    // First daemon on an ephemeral port, not the shared default 7777 that other suites may take.
    const serve = (port: number): { stderr: () => string; exited: () => boolean } => {
      let stderr = "";
      let exited = false;
      const child = spawn(process.execPath, [MAIN, "serve", "--port", String(port)], {
        cwd: dir,
        detached: true,
        stdio: ["ignore", "ignore", "pipe"],
      });
      child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
      child.once("exit", () => (exited = true));
      child.unref();
      return { stderr: () => stderr, exited: () => exited };
    };
    const started = async (s: ReturnType<typeof serve>, not?: number): Promise<number> => {
      const deadline = Date.now() + 10_000;
      for (;;) {
        // Published and answering with its own token: the call below cannot race the restart.
        const rt = await readFile(join(dir, "knowledge", ".ai-submind", "runtime.json"), "utf8")
          .then((t) => JSON.parse(t) as { pid: number; url: string; token: string })
          .catch(() => undefined);
        const healthy =
          rt !== undefined &&
          rt.pid !== not &&
          (await fetch(new URL("/api/status", rt.url), {
            headers: { authorization: `Bearer ${rt.token}` },
          })
            .then(async (r) => (await r.body?.cancel(), r.ok))
            .catch(() => false));
        if (healthy) return rt.pid;
        if (s.exited()) throw new Error(`ai-submind serve exited:\n${s.stderr()}`);
        if (Date.now() > deadline)
          throw new Error(`ai-submind serve did not start:\n${s.stderr()}`);
        await sleep(50);
      }
    };
    const first = await started(serve(0));
    const p = await connect();
    await call(p, "validate");
    expect(await runtimePid()).toBe(first); // the proxy uses that daemon
    const { port } = JSON.parse(
      await readFile(join(dir, "knowledge", ".ai-submind", "runtime.json"), "utf8"),
    ) as { port: number };
    expect((await stop()).code).toBe(0);
    // Same URL, new token: the proxy's cached token is now stale (the daemon is stopped in afterEach).
    await started(serve(port), first);
    expect(await call(p, "validate")).toMatchObject({ state: "ok" });
    expect(p.stderr()).toMatch(/token rejected; ensuring the daemon/);
    expect(p.errors).toEqual([]);
  }, 30_000);
});
