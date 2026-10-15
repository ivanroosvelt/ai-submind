// HTTP daemon of a project (REQ-001, REQ-037, NFR-004, DEC-005, DEC-014): loopback only, Host/Origin
// checks, per-start token (Bearer or cookie), single instance through the lockfile, idle shutdown, and the
// stateless MCP route `/mcp` (API-001, DEC-016) and the UI and its API (API-002, DEC-017).
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import { Engine } from "../engine/engine.js";
import { mcpRoutes } from "../mcp/http.js";
import { createQuery } from "../query/query.js";
import { ensureLocalDir, type Project } from "./project.js";
import { uiRoutes } from "./ui-api.js";
import {
  acquireLock,
  releaseLock,
  VERSION,
  waitForRuntime,
  writeRuntime,
  type Runtime,
} from "./runtime.js";

export const DEFAULT_PORT = 7777;
export const DEFAULT_IDLE_MS = 30 * 60_000;

export interface DaemonOptions {
  /** Explicit port (0 = any free one); fails if busy. Default: 7777, falling back to a free port. */
  port?: number;
  /** Shutdown after this long without authenticated activity, in ms; 0 disables. Default: 30 min. */
  idleMs?: number;
}

/** Route handler; the request is already authenticated. */
export type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export interface DaemonHandle {
  port: number;
  token: string;
  /** Base URL without the token. */
  url: string;
  engine: Engine;
  /** Routes by `"METHOD /path"`; `"GET /assets/*"` serves every path under `/assets/`. */
  routes: Map<string, Handler>;
  /** Graceful shutdown; idempotent. */
  close(): Promise<void>;
  /** Settles once the daemon has shut down for any reason (stop, idle, close). */
  closed: Promise<void>;
}

/** `started`: this process owns the daemon. `running`: another live daemon serves the project. */
export type StartResult =
  { status: "started"; daemon: DaemonHandle } | { status: "running"; runtime: Runtime };

const sameSecret = (given: string | undefined, token: string): boolean => {
  if (given === undefined) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};

function cookie(req: IncomingMessage, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

function send(res: ServerResponse, status: number, body: string, type = "text/plain"): void {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8` }).end(body);
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((ok, fail) => {
    server.once("error", fail).listen(port, "127.0.0.1", () => {
      server.off("error", fail);
      ok();
    });
  });
}

/**
 * Starts the daemon of `project`, or reports the live one that already owns it (waiting up to 10 s while
 * it starts). Installs no signal handlers: the CLI does.
 */
export async function startDaemon(
  project: Project,
  options: DaemonOptions = {},
): Promise<StartResult> {
  await ensureLocalDir(project);
  const owner = await acquireLock(project);
  if (owner !== undefined) {
    const runtime = await waitForRuntime(project);
    if (runtime === undefined) {
      throw new Error(
        `process ${String(owner)} holds ${join(project.local, "daemon.lock")} but no daemon answers; ` +
          "if that process is not ai-submind, remove the lock",
      );
    }
    return { status: "running", runtime };
  }

  let engine: Engine | undefined;
  const server = createServer();
  try {
    engine = await Engine.open(project.knowledge, {
      watch: true,
      codeRefExists: (path) => existsSync(join(project.root, path)),
    });
    try {
      await listen(server, options.port ?? DEFAULT_PORT);
    } catch (e) {
      if (options.port !== undefined || (e as NodeJS.ErrnoException).code !== "EADDRINUSE") throw e;
      await listen(server, 0);
    }
  } catch (e) {
    engine?.close();
    await releaseLock(project);
    throw e;
  }
  const opened = engine;
  const query = createQuery(opened);
  const mcp = mcpRoutes(opened, query, VERSION);

  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("unexpected server address");
  const port = address.port;
  const token = randomBytes(32).toString("base64url");
  const url = `http://127.0.0.1:${String(port)}/`;
  const hosts = new Set([`127.0.0.1:${String(port)}`, `localhost:${String(port)}`]);
  const origins = new Set([...hosts].map((h) => `http://${h}`));
  const cookieName = `ai-submind-${String(port)}`;

  let inflight = 0;
  let lastActivity = Date.now();
  let closing: Promise<void> | undefined;
  let settle: () => void = () => undefined;
  const closed = new Promise<void>((ok) => (settle = ok));

  // Idle shutdown: no authenticated request in flight and none started during the idle period.
  const idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
  const idleTimer =
    idleMs > 0
      ? setInterval(
          () => {
            if (inflight === 0 && Date.now() - lastActivity >= idleMs) void close();
          },
          Math.min(idleMs, 60_000),
        ).unref()
      : undefined;

  const close = (): Promise<void> =>
    (closing ??= (async () => {
      clearInterval(idleTimer);
      const done = new Promise<void>((ok) => {
        server.close(() => {
          ok();
        });
      });
      server.closeAllConnections();
      await done;
      await mcp.close();
      query.dispose();
      opened.close();
      await releaseLock(project);
      settle();
    })());

  const routes = new Map<string, Handler>([
    ...uiRoutes(opened, query),
    [
      "GET /api/status",
      (_req, res) => {
        const s = opened.status();
        const body = {
          version: VERSION,
          pid: process.pid,
          port,
          root: project.root,
          knowledge: project.knowledge,
          engine: {
            state: s.state,
            documents: s.documents.length,
            errors: s.findings.filter((f) => f.severity === "error").length,
            warnings: s.findings.filter((f) => f.severity === "warning").length,
          },
        };
        send(res, 200, JSON.stringify(body), "application/json");
      },
    ],
    [
      "POST /api/stop",
      (_req, res) => {
        res.on("close", () => void close());
        send(res, 202, "stopping\n");
      },
    ],
    ...mcp.routes,
  ]);

  const fail = (res: ServerResponse, e: unknown): void => {
    process.stderr.write(
      `ai-submind: request failed: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    if (!res.headersSent) send(res, 500, "internal error\n");
    else res.destroy();
  };

  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    // Anti DNS-rebinding: only our own loopback authority, never a foreign Origin. No CORS headers.
    const origin = req.headers.origin;
    if (!hosts.has(req.headers.host ?? "") || (origin !== undefined && !origins.has(origin))) {
      send(res, 403, "forbidden\n");
      return;
    }
    let target: URL;
    try {
      target = new URL(req.url ?? "/", url);
    } catch {
      send(res, 400, "bad request\n");
      return;
    }
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    if (req.method === "GET" && target.pathname === "/" && target.searchParams.has("token")) {
      if (!sameSecret(target.searchParams.get("token") ?? undefined, token)) {
        send(res, 401, "unauthorized\n");
        return;
      }
      res
        .writeHead(303, {
          location: "/",
          "set-cookie": `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/`,
        })
        .end();
      return;
    }
    if (!sameSecret(bearer, token) && !sameSecret(cookie(req, cookieName), token)) {
      send(res, 401, "unauthorized\n");
      return;
    }
    inflight++;
    lastActivity = Date.now();
    res.on("close", () => {
      inflight--;
      lastActivity = Date.now();
    });
    const path = target.pathname.startsWith("/assets/") ? "/assets/*" : target.pathname;
    const handler = routes.get(`${req.method ?? ""} ${path}`);
    if (handler === undefined) {
      // The only writes are layout, MCP and stop (REQ-032): any other method is not allowed.
      if (req.method === "GET") send(res, 404, "not found\n");
      else {
        // Its body is not read: close instead of leaving it for the next request on the connection.
        res.setHeader("connection", "close");
        send(res, 405, "method not allowed\n");
      }
      return;
    }
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((e: unknown) => {
        fail(res, e);
      });
  };

  // A request must never take the daemon down (it would leave the lock and runtime.json behind).
  server.on("request", (req: IncomingMessage, res: ServerResponse) => {
    try {
      handle(req, res);
    } catch (e) {
      fail(res, e);
    }
  });

  try {
    await writeRuntime(project, {
      pid: process.pid,
      port,
      token,
      url,
      version: VERSION,
      startedAt: new Date().toISOString(),
    });
  } catch (e) {
    await close();
    throw e;
  }
  return { status: "started", daemon: { port, token, url, engine: opened, routes, close, closed } };
}
