// Runtime files of the project daemon (REQ-037, DEC-005, DEC-014): exclusive lockfile with the pid,
// runtime.json (mode 0600, atomic write), health check and `ensureDaemon` for clients such as the MCP proxy.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, fchmodSync, openSync } from "node:fs";
import { link, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { ensureLocalDir, type Project } from "./project.js";

export interface Runtime {
  pid: number;
  port: number;
  token: string;
  /** Base URL without the token, e.g. `http://127.0.0.1:7777/`. */
  url: string;
  version: string;
  startedAt: string;
}

/** Package version, read from package.json (two levels up from both src/daemon and dist/daemon). */
export const VERSION = (
  JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

export const lockPath = (p: Project): string => join(p.local, "daemon.lock");
export const runtimePath = (p: Project): string => join(p.local, "runtime.json");

const code = (e: unknown): string | undefined => (e as NodeJS.ErrnoException).code;

/** Whether `pid` is a live process. ponytail: a reused pid looks alive until that process ends (DEC-014). */
export function isAlive(pid: number): boolean {
  if (pid <= 0) return false; // 0 and negatives would signal process groups
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return code(e) === "EPERM"; // exists but belongs to another user
  }
}

/** Pid stored in a lock file: `undefined` if the file is missing, 0 if its content is not a pid. */
async function readPid(path: string): Promise<number | undefined> {
  try {
    const pid = Number(await readFile(path, "utf8"));
    return Number.isInteger(pid) && pid > 0 ? pid : 0;
  } catch (e) {
    if (code(e) === "ENOENT") return undefined;
    throw e;
  }
}

/** Creates `path` holding our pid, atomically (never seen empty); `false` if it already exists. */
async function publish(path: string): Promise<boolean> {
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, String(process.pid));
  try {
    await link(tmp, path);
    return true;
  } catch (e) {
    if (code(e) === "EEXIST") return false;
    throw e;
  } finally {
    await rm(tmp, { force: true });
  }
}

/**
 * Removes the lock if it still holds `dead`. Serialized by `daemon.lock.recover` so that a slow recoverer
 * cannot delete the fresh lock of a faster one.
 */
async function recover(p: Project, dead: number): Promise<void> {
  const guard = `${lockPath(p)}.recover`;
  if (!(await publish(guard))) {
    const owner = await readPid(guard);
    // ponytail: two processes removing the same stale guard at once can both enter; it only goes stale if
    // a process dies inside these few milliseconds.
    if (owner !== undefined && !isAlive(owner)) await rm(guard, { force: true });
    else await sleep(20);
    return;
  }
  try {
    if ((await readPid(lockPath(p))) === dead) await rm(lockPath(p), { force: true });
  } finally {
    await rm(guard, { force: true });
  }
}

/**
 * Takes the lock for this process. Returns `undefined` when acquired, or the pid of the live process that
 * owns it. A lock whose pid is dead (or unreadable) is recovered and the creation retried.
 */
export async function acquireLock(p: Project): Promise<number | undefined> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    if (await publish(lockPath(p))) return undefined;
    const pid = await readPid(lockPath(p));
    if (pid !== undefined && isAlive(pid)) return pid;
    if (Date.now() > deadline)
      throw new Error(`cannot take ${lockPath(p)}: stale lock keeps reappearing`);
    if (pid !== undefined) await recover(p, pid);
  }
}

/** Removes runtime.json and the lock, only if the lock belongs to `pid` (or `pid` is dead). */
export async function releaseLock(p: Project, pid = process.pid): Promise<void> {
  const owner = await readPid(lockPath(p));
  if (owner !== undefined && owner !== pid && isAlive(owner)) return;
  await rm(runtimePath(p), { force: true });
  await rm(lockPath(p), { force: true });
}

export async function writeRuntime(p: Project, runtime: Runtime): Promise<void> {
  const tmp = join(p.local, `runtime.${randomUUID()}.tmp`);
  await writeFile(tmp, `${JSON.stringify(runtime, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await rename(tmp, runtimePath(p));
}

export async function readRuntime(p: Project): Promise<Runtime | undefined> {
  try {
    return JSON.parse(await readFile(runtimePath(p), "utf8")) as Runtime;
  } catch {
    return undefined; // missing or half-written by a crashed daemon
  }
}

/** Authenticated request to the daemon described by `runtime`. */
export function request(runtime: Runtime, path: string, method = "GET"): Promise<Response> {
  return fetch(new URL(path, runtime.url), {
    method,
    headers: { authorization: `Bearer ${runtime.token}` },
    signal: AbortSignal.timeout(2000),
  });
}

/** The runtime of a live, healthy daemon for the project, if there is one. */
export async function liveRuntime(p: Project): Promise<Runtime | undefined> {
  const runtime = await readRuntime(p);
  if (runtime === undefined || !isAlive(runtime.pid)) return undefined;
  try {
    const res = await request(runtime, "/api/status");
    await res.body?.cancel();
    return res.ok ? runtime : undefined;
  } catch {
    return undefined;
  }
}

/** Waits up to `ms` for a healthy daemon (e.g. the one that holds the lock while it starts). */
export async function waitForRuntime(p: Project, ms = 10_000): Promise<Runtime | undefined> {
  const deadline = Date.now() + ms;
  for (;;) {
    const runtime = await liveRuntime(p);
    if (runtime !== undefined || Date.now() >= deadline) return runtime;
    await sleep(100);
  }
}

/**
 * Returns the healthy daemon of the project, starting it in the background if needed (DEC-005: used by
 * the stdio MCP proxy). Its stderr is appended to knowledge/.ai-submind/daemon.log.
 */
export async function ensureDaemon(p: Project): Promise<Runtime> {
  const running = await liveRuntime(p);
  if (running !== undefined) return running;
  await ensureLocalDir(p);
  // The log may contain the token URL: owner-only, even if it already existed.
  const log = openSync(join(p.local, "daemon.log"), "a", 0o600);
  try {
    fchmodSync(log, 0o600);
    const cli = fileURLToPath(new URL("../cli/main.js", import.meta.url));
    spawn(process.execPath, [cli, "serve", "--knowledge", p.knowledge], {
      cwd: p.root,
      detached: true,
      stdio: ["ignore", "ignore", log],
    }).unref();
  } finally {
    closeSync(log);
  }
  const runtime = await waitForRuntime(p);
  if (runtime === undefined) {
    throw new Error(`the daemon did not start within 10 s; see ${join(p.local, "daemon.log")}`);
  }
  return runtime;
}
