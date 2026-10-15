// CLI and ensureDaemon as real processes (PLAN-002 S7; API-003, REQ-001, REQ-002, REQ-037). Builds dist/
// once, then runs `node dist/cli/main.js` in temporary projects.
import { execFile, execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const MAIN = join(REPO, "dist", "cli", "main.js");
const EXAMPLES = join(REPO, "spec", "format", "examples");

let dir: string;
/** Every process started by a test; killed afterwards so that a failure cannot leak a daemon. */
const children: ChildProcess[] = [];

beforeAll(() => {
  execFileSync("npm", ["run", "--silent", "build"], { cwd: REPO, stdio: "ignore" });
}, 120_000);

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), "ai-submind-cli-")));
});

afterEach(async () => {
  // Never leave a daemon behind, whatever failed.
  spawnSync(process.execPath, [MAIN, "stop"], { cwd: dir });
  for (const c of children.splice(0))
    if (c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
  await rm(dir, { recursive: true, force: true });
});

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(...args: string[]): Promise<Result> {
  return new Promise((ok) => {
    execFile(process.execPath, [MAIN, ...args], { cwd: dir }, (error, stdout, stderr) => {
      ok({ code: error ? Number(error.code ?? 1) : 0, stdout, stderr });
    });
  });
}

async function until(check: () => boolean, ms = 10_000): Promise<void> {
  for (const deadline = Date.now() + ms; !check();) {
    if (Date.now() > deadline) throw new Error("timed out");
    await sleep(50);
  }
}

const local = (name = ""): string => join(dir, "knowledge", ".ai-submind", name);

interface Served {
  child: ChildProcess;
  stdout: () => string;
  stderr: () => string;
  exited: Promise<number | null>;
}

function serve(cwd: string, ...args: string[]): Served {
  const child = spawn(process.execPath, [MAIN, "serve", ...args], { cwd });
  children.push(child);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c: Buffer) => (stdout += c.toString()));
  child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
  return {
    child,
    stdout: () => stdout,
    stderr: () => stderr,
    exited: new Promise((ok) => child.on("exit", ok)),
  };
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("serve, status and stop", () => {
  it("serve without knowledge/ creates only .ai-submind/; status and stop manage it", async () => {
    const served = serve(dir, "--port", "0");
    const stderr = (): string => served.stderr();
    await until(() => existsSync(local("runtime.json")) && stderr().includes("?token="));

    expect(await readdir(join(dir, "knowledge"))).toEqual([".ai-submind"]);
    expect(await readFile(local(".gitignore"), "utf8")).toBe("*\n");
    expect(stderr()).toContain(`knowledge: ${join(dir, "knowledge")}`);
    expect(stderr()).toMatch(/documents: 0 loaded, 0 invalid/);
    expect(stderr()).toMatch(/http:\/\/127\.0\.0\.1:\d+\/\?token=[\w-]{43}/);

    const again = await cli("serve");
    expect(again.code).toBe(0);
    expect(again.stderr).toMatch(/already running.*\n.*\?token=/);

    const status = await cli("status");
    expect(status.code).toBe(0);
    expect(status.stdout).toMatch(
      new RegExp(`running pid ${String(served.child.pid)} http://127.0.0.1:\\d+/\\n`),
    );
    expect(status.stdout).not.toContain("token");
    expect(status.stdout).toContain("documents 0, errors 0");

    expect((await cli("stop")).code).toBe(0);
    expect(await served.exited).toBe(0);
    expect(served.stdout()).toBe("");
    expect(existsSync(local("runtime.json"))).toBe(false);
    expect((await cli("status")).code).toBe(1);
  }, 30_000);

  it("REQ-002: serving a project without knowledge/ loads nothing and creates only .ai-submind/", async () => {
    serve(dir, "--port", "0");
    await until(() => existsSync(local("runtime.json")));
    const runtime = JSON.parse(await readFile(local("runtime.json"), "utf8")) as {
      url: string;
      token: string;
    };
    const res = await fetch(new URL("/api/status", runtime.url), {
      headers: { authorization: `Bearer ${runtime.token}` },
    });
    expect(((await res.json()) as { engine: unknown }).engine).toEqual({
      state: "ok",
      documents: 0,
      errors: 0,
      warnings: 0,
    });
    expect(await readdir(join(dir, "knowledge"))).toEqual([".ai-submind"]);
    expect((await readdir(local())).sort()).toEqual([".gitignore", "daemon.lock", "runtime.json"]);
  }, 30_000);

  it("stop without a daemon succeeds and cleans stale files", async () => {
    const dead = spawnSync(process.execPath, ["-e", ""]).pid;
    await mkdir(local(), { recursive: true });
    await writeFile(local("daemon.lock"), String(dead));
    await writeFile(
      local("runtime.json"),
      JSON.stringify({ pid: dead, port: 1, token: "x", url: "http://127.0.0.1:1/" }),
    );
    const r = await cli("stop");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("not running");
    expect(existsSync(local("daemon.lock"))).toBe(false);
    expect(existsSync(local("runtime.json"))).toBe(false);
  });

  it("ensureDaemon starts the daemon once and reuses it", async () => {
    const api = (await import(
      join(REPO, "dist", "index.js")
    )) as typeof import("../../src/index.js");
    const project = await api.resolveProject(dir);
    const first = await api.ensureDaemon(project);
    expect(first.pid).not.toBe(process.pid);
    const second = await api.ensureDaemon(project);
    expect(second).toEqual(first);
    expect((await stat(local("daemon.log"))).mode & 0o777).toBe(0o600);
    expect((await stat(local())).mode & 0o777).toBe(0o700);
    expect((await cli("stop")).code).toBe(0);
  }, 30_000);
});

describe("init", () => {
  it("creates a valid, canonical manifest and never overwrites it", async () => {
    const r = await cli("init");
    expect(r.code).toBe(0);
    const manifest = join(dir, "knowledge", "ai-submind.json");
    expect(await readFile(manifest, "utf8")).toBe(
      await readFile(join(EXAMPLES, "canonical", "expected", "ai-submind.json"), "utf8"),
    );
    expect(await readFile(local(".gitignore"), "utf8")).toBe("*\n");
    expect((await cli("validate")).code).toBe(0);

    await writeFile(manifest, '{"format_version":"1.0"}');
    const again = await cli("init");
    expect(again.code).toBe(0);
    expect(again.stdout).toContain("already exists");
    expect(await readFile(manifest, "utf8")).toBe('{"format_version":"1.0"}');
  });
});

describe("validate", () => {
  it("exits 0 with a notice without the default knowledge/", async () => {
    const r = await cli("validate");
    expect(r).toMatchObject({ code: 0, stdout: "" });
    expect(r.stderr).toMatch(/no knowledge\/ directory/);
    expect(existsSync(join(dir, "knowledge"))).toBe(false);
  });

  it("exits 2 when an explicit --knowledge does not exist", async () => {
    const r = await cli("validate", "--knowledge", "missing");
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/missing does not exist/);
  });

  it("exits 0 on a valid corpus", async () => {
    await cp(join(EXAMPLES, "valid", "garage", "knowledge"), join(dir, "knowledge"), {
      recursive: true,
    });
    const r = await cli("validate");
    expect(r.code).toBe(0);
    expect(r.stderr).toMatch(/0 errors/);
  });

  it("exits 1 and prints one line per finding on a broken document", async () => {
    await cp(join(EXAMPLES, "invalid", "broken-reference", "knowledge"), join(dir, "kb"), {
      recursive: true,
    });
    const r = await cli("validate", "--knowledge", "kb");
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/^error REF_UNRESOLVED \S+#\/\S* \[[^\]]*\] .+$/m);
  });
});

describe("arguments", () => {
  it("rejects --knowledge outside the root", async () => {
    const r = await cli("validate", "--knowledge", "..");
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/outside the project root/);
  });

  it("unknown command exits 2 with usage; --help exits 0", async () => {
    const r = await cli("frobnicate");
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/unknown command: frobnicate[\s\S]*usage: ai-submind/);
    expect((await cli("--help")).code).toBe(0);
    expect((await cli("serve", "--port", "x")).code).toBe(2);
  });
});

describe("orphan lock under concurrent starts", () => {
  // Each starter imports dist/, waits for a common instant, then calls startDaemon: the processes hit the
  // dead lock within about a millisecond of each other.
  const STARTER = `
    const [dist, root, at] = process.argv.slice(2);
    const { resolveProject, startDaemon } = await import(dist);
    const project = await resolveProject(root);
    while (Date.now() < Number(at)) await new Promise((ok) => setImmediate(ok));
    const r = await startDaemon(project, { port: 0, idleMs: 0 });
    const line = r.status === "started" ? { started: process.pid } : { running: r.runtime.pid };
    process.stdout.write(JSON.stringify(line) + "\\n");
    if (r.status === "started") process.once("SIGTERM", () => r.daemon.close().then(() => process.exit(0)));
  `;

  it("six processes recovering the same dead lock start exactly one daemon (8 rounds)", async () => {
    const dead = spawnSync(process.execPath, ["-e", ""]).pid;
    const script = join(dir, "starter.mjs");
    await writeFile(script, STARTER);
    const dist = pathToFileURL(join(REPO, "dist", "index.js")).href;
    for (let round = 0; round < 8; round++) {
      const root = await realpath(await mkdtemp(join(tmpdir(), "ai-submind-race-")));
      const lock = join(root, "knowledge", ".ai-submind", "daemon.lock");
      try {
        await mkdir(join(root, "knowledge", ".ai-submind"), { recursive: true });
        await writeFile(lock, String(dead));
        const at = String(Date.now() + 1500);
        const lines = await Promise.all(
          Array.from({ length: 6 }, () => {
            const child = spawn(process.execPath, [script, dist, root, at], { cwd: root });
            children.push(child);
            return new Promise<{ started?: number; running?: number }>((ok, fail) => {
              let out = "";
              child.stdout.on("data", (c: Buffer) => {
                out += c.toString();
                if (out.includes("\n"))
                  ok(JSON.parse(out) as { started?: number; running?: number });
              });
              child.on("exit", (code) => {
                fail(new Error(`starter exited with ${String(code)} before reporting`));
              });
            });
          }),
        );
        const winners = lines.flatMap((l) => (l.started === undefined ? [] : [l.started]));
        expect(winners, `round ${String(round)}`).toHaveLength(1);
        const winner = winners[0] ?? 0;
        expect(lines.filter((l) => l.running === winner)).toHaveLength(5);
        expect(await readFile(lock, "utf8")).toBe(String(winner));
        process.kill(winner, "SIGTERM");
        await until(() => !alive(winner));
      } finally {
        for (const c of children)
          if (c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
        await rm(root, { recursive: true, force: true });
      }
    }
  }, 120_000);
});
