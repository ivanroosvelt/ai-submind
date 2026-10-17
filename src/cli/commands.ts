// Subcommands of the `ai-submind` CLI (API-003, REQ-001, REQ-002, REQ-037, REQ-043, DEC-014). Logs go to stderr:
// stdout is reserved for command output (and for the stdio MCP proxy).
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { MANIFEST } from "../engine/edit.js";
import { Engine } from "../engine/engine.js";
import { validateKnowledgeDir } from "../format/knowledge.js";
import { SUPPORTED_VERSION } from "../format/schema.js";
import { ensureLocalDir, resolveProject, type Project } from "../daemon/project.js";
import { isAlive, liveRuntime, readRuntime, releaseLock, request } from "../daemon/runtime.js";
import { startDaemon } from "../daemon/server.js";
import { proxy } from "./proxy.js";

const USAGE = `usage: ai-submind [command] [options]

commands:
  serve      start the project daemon (default)   [--knowledge <dir>] [--port <n>] [--idle <minutes>]
  status     show the daemon status                [--knowledge <dir>]
  stop       stop the daemon                       [--knowledge <dir>]
  init       create knowledge/ with its manifest   [--knowledge <dir>]
  validate   validate knowledge/ (exit 1 on error) [--knowledge <dir>]
  migrate    upgrade format 1.0 documents to the current format [--knowledge <dir>] [--dry-run]
  mcp        stdio MCP server for agents, proxied to the daemon (started if needed) [--knowledge <dir>]
`;

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};
const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const withToken = (url: string, token: string): string => `${url}?token=${token}`;

function integer(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0)
    throw new UsageError(`--${name} must be a non-negative integer`);
  return n;
}

class UsageError extends Error {}

async function serve(project: Project, port?: number, idle?: number): Promise<number> {
  const options: { port?: number; idleMs?: number } = {};
  if (port !== undefined) options.port = port;
  if (idle !== undefined) options.idleMs = idle * 60_000;
  const result = await startDaemon(project, options);
  if (result.status === "running") {
    log(
      `ai-submind is already running for ${project.knowledge} (pid ${String(result.runtime.pid)})`,
    );
    log(withToken(result.runtime.url, result.runtime.token));
    return 0;
  }
  const { daemon } = result;
  const status = daemon.engine.status();
  const invalid = new Set(status.findings.filter((f) => f.severity === "error").map((f) => f.file));
  log(`knowledge: ${project.knowledge}`);
  log(`documents: ${String(status.documents.length)} loaded, ${String(invalid.size)} invalid`);
  log(`ai-submind listening on ${withToken(daemon.url, daemon.token)}`);
  const stop = (): void => void daemon.close();
  process.once("SIGINT", stop).once("SIGTERM", stop);
  await daemon.closed;
  log("ai-submind stopped");
  process.exit(0); // nothing else should keep the process alive; make sure of it
}

async function status(project: Project): Promise<number> {
  const runtime = await liveRuntime(project);
  if (runtime === undefined) {
    out(`not running (${project.knowledge})`);
    return 1;
  }
  const s = (await (await request(runtime, "/api/status")).json()) as {
    engine: { documents: number; errors: number };
  };
  out(`running pid ${String(runtime.pid)} ${runtime.url}`);
  out(`documents ${String(s.engine.documents)}, errors ${String(s.engine.errors)}`);
  return 0;
}

async function stop(project: Project): Promise<number> {
  const runtime = await readRuntime(project);
  if (runtime === undefined || !isAlive(runtime.pid)) {
    await releaseLock(project, runtime?.pid ?? -1); // stale files of a dead daemon
    out("not running");
    return 0;
  }
  try {
    await (await request(runtime, "/api/stop", "POST")).body?.cancel();
  } catch (e) {
    log(
      `cannot reach the daemon (pid ${String(runtime.pid)}): ${e instanceof Error ? e.message : String(e)}`,
    );
    return 1;
  }
  for (const deadline = Date.now() + 5000; Date.now() < deadline;) {
    if (!isAlive(runtime.pid)) {
      out(`stopped (pid ${String(runtime.pid)})`);
      return 0;
    }
    await sleep(50);
  }
  log(`the daemon (pid ${String(runtime.pid)}) did not exit within 5 s`);
  return 1;
}

/**
 * Init and migrate run their own engine, and Engine.open cleans .ai-submind/tmp under a running daemon's
 * writes: refuse while one is alive (`instead` says what to do). True when refused.
 */
async function refuseUnderDaemon(project: Project, instead: string): Promise<boolean> {
  const runtime = await liveRuntime(project);
  if (runtime === undefined) return false;
  log(`ai-submind: the daemon is running (pid ${String(runtime.pid)}); ${instead}`);
  return true;
}

async function init(project: Project): Promise<number> {
  await mkdir(project.knowledge, { recursive: true });
  await ensureLocalDir(project);
  if (existsSync(join(project.knowledge, "ai-submind.json"))) {
    out(`${join(project.knowledge, "ai-submind.json")} already exists; nothing overwritten`);
    return 0;
  }
  if (
    await refuseUnderDaemon(
      project,
      "stop it first (`ai-submind stop`), or let its first MCP write create knowledge/",
    )
  )
    return 1;
  const engine = await Engine.open(project.knowledge);
  await engine.transact([
    { op: "put", path: "ai-submind.json", data: MANIFEST, expectedRevision: null },
  ]);
  out(`initialized ${project.knowledge}`);
  return 0;
}

async function migrate(project: Project, dryRun: boolean): Promise<number> {
  if (await refuseUnderDaemon(project, "use the MCP `migrate` tool or stop it (`ai-submind stop`)"))
    return 1;
  const engine = await Engine.open(project.knowledge);
  const { migrated } = await engine.migrate({ dryRun });
  for (const path of migrated) out(path);
  log(
    `${dryRun ? "would migrate" : "migrated"} ${String(migrated.length)} documents to format ${SUPPORTED_VERSION} (${project.knowledge})`,
  );
  return 0;
}

// Read-only on purpose: Engine.open would clean .ai-submind/tmp under a running daemon's feet.
async function validate(project: Project, explicit: boolean): Promise<number> {
  if (!existsSync(project.knowledge)) {
    if (explicit) {
      log(`ai-submind: ${project.knowledge} does not exist`);
      return 2;
    }
    log(`no knowledge/ directory (${project.knowledge}): 0 findings`);
    return 0;
  }
  const { findings } = await validateKnowledgeDir(project.knowledge, {
    codeRefExists: (path) => existsSync(join(project.root, path)),
  });
  for (const f of findings) {
    out(
      `${f.severity} ${f.code} ${f.file}#${f.pointer} [${(f.subjects ?? []).join(",")}] ${f.message}`,
    );
  }
  const errors = findings.filter((f) => f.severity === "error").length;
  log(
    `${String(errors)} errors, ${String(findings.length - errors)} warnings (${project.knowledge})`,
  );
  return errors > 0 ? 1 : 0;
}

/** Runs the CLI with `argv` (without node and the script); returns the exit code. */
export async function run(argv: string[]): Promise<number> {
  const [first] = argv;
  const command = first === undefined || first.startsWith("-") ? "serve" : first;
  const rest = command === first ? argv.slice(1) : argv;
  if (command === "help" || rest.includes("--help") || rest.includes("-h")) {
    process.stderr.write(USAGE);
    return 0;
  }
  try {
    if (!["serve", "status", "stop", "init", "validate", "migrate", "mcp"].includes(command)) {
      throw new UsageError(`unknown command: ${command}`);
    }
    const { values } = parseArgs({
      args: rest,
      strict: true,
      options: {
        knowledge: { type: "string" },
        ...(command === "serve" && { port: { type: "string" }, idle: { type: "string" } }),
        ...(command === "migrate" && { "dry-run": { type: "boolean" } }),
      },
    }) as { values: { knowledge?: string; port?: string; idle?: string; "dry-run"?: boolean } };
    const port = integer("port", values.port);
    const idle = integer("idle", values.idle);
    const project = await resolveProject(process.cwd(), values.knowledge);
    switch (command) {
      case "serve":
        return await serve(project, port, idle);
      case "status":
        return await status(project);
      case "stop":
        return await stop(project);
      case "init":
        return await init(project);
      case "migrate":
        return await migrate(project, values["dry-run"] === true);
      case "mcp":
        return await proxy(project);
      default:
        return await validate(project, values.knowledge !== undefined);
    }
  } catch (e) {
    const usage =
      e instanceof UsageError || (e as { code?: string }).code?.startsWith("ERR_PARSE_ARGS");
    log(`ai-submind: ${e instanceof Error ? e.message : String(e)}`);
    if (usage) process.stderr.write(USAGE);
    return usage === true ? 2 : 1;
  }
}
