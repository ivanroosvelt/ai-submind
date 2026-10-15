// Daemon (PLAN-002 S7; REQ-037, NFR-004, DEC-014): single instance, orphan lock, runtime.json, Host/Origin
// checks, token, loopback binding, port fallback, idle shutdown and stop. In-process, port 0 by default.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import {
  request as httpRequest,
  createServer,
  type IncomingHttpHeaders,
  type Server,
} from "node:http";
import { connect } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveProject, type Project } from "../../src/daemon/project.js";
import { startDaemon, type DaemonHandle, type DaemonOptions } from "../../src/daemon/server.js";

let dir: string;
let project: Project;
const daemons: DaemonHandle[] = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-submind-daemon-"));
  project = await resolveProject(dir);
});

afterEach(async () => {
  for (const d of daemons.splice(0)) await d.close();
  await rm(dir, { recursive: true, force: true });
});

async function start(options: DaemonOptions = { port: 0 }): Promise<DaemonHandle> {
  const r = await startDaemon(project, options);
  if (r.status !== "started") throw new Error("expected a new daemon");
  daemons.push(r.daemon);
  return r.daemon;
}

interface Reply {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

function call(
  d: DaemonHandle,
  path: string,
  headers: Record<string, string> = {},
  method = "GET",
): Promise<Reply> {
  return new Promise((ok, fail) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port: d.port,
        path,
        method,
        headers: { host: `127.0.0.1:${String(d.port)}`, ...headers },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8").on("data", (c: string) => (body += c));
        res.on("end", () => {
          ok({ status: res.statusCode ?? 0, headers: res.headers, body });
        });
      },
    );
    req.on("error", fail).end();
  });
}

/** Sends raw bytes and returns the status line of the answer. */
function raw(d: DaemonHandle, text: string): Promise<string> {
  return new Promise((ok, fail) => {
    let answer = "";
    const s = connect({ host: "127.0.0.1", port: d.port }, () => s.end(text));
    s.setEncoding("utf8")
      .on("data", (c: string) => (answer += c))
      .on("end", () => {
        ok(answer.split("\r\n")[0] ?? "");
      })
      .on("error", fail);
  });
}

const bearer = (d: DaemonHandle): Record<string, string> => ({
  authorization: `Bearer ${d.token}`,
});

const local = (name: string): string => join(project.local, name);

describe("single instance", () => {
  it("two concurrent starts create exactly one daemon; the other reuses it", async () => {
    const results = await Promise.all([
      startDaemon(project, { port: 0 }),
      startDaemon(project, { port: 0 }),
    ]);
    const started = results.flatMap((r) => (r.status === "started" ? [r.daemon] : []));
    const running = results.flatMap((r) => (r.status === "running" ? [r.runtime] : []));
    daemons.push(...started);
    expect(started).toHaveLength(1);
    expect(running).toHaveLength(1);
    expect(running[0]?.port).toBe(started[0]?.port);
    expect(running[0]?.token).toBe(started[0]?.token);
  });

  it("recovers an orphan lock whose pid is dead", async () => {
    const dead = spawnSync(process.execPath, ["-e", ""]).pid;
    expect(dead).toBeGreaterThan(0);
    await mkdir(project.local, { recursive: true });
    await writeFile(local("daemon.lock"), String(dead));
    const d = await start();
    expect(await readFile(local("daemon.lock"), "utf8")).toBe(String(process.pid));
    expect((await call(d, "/api/status", bearer(d))).status).toBe(200);
  });

  it("does not remove a dead lock while another process holds the recovery guard", async () => {
    const dead = spawnSync(process.execPath, ["-e", ""]).pid;
    await mkdir(project.local, { recursive: true });
    await writeFile(local("daemon.lock"), String(dead));
    await writeFile(local("daemon.lock.recover"), String(process.pid)); // live owner
    const pending = startDaemon(project, { port: 0 });
    await sleep(200);
    expect(await readFile(local("daemon.lock"), "utf8")).toBe(String(dead));
    await rm(local("daemon.lock.recover"));
    const r = await pending;
    if (r.status === "started") daemons.push(r.daemon);
    expect(r.status).toBe("started");
  });

  it("recovers a stale recovery guard whose owner is dead", async () => {
    const dead = spawnSync(process.execPath, ["-e", ""]).pid;
    await mkdir(project.local, { recursive: true });
    await writeFile(local("daemon.lock"), String(dead));
    await writeFile(local("daemon.lock.recover"), String(dead));
    await start();
    expect(existsSync(local("daemon.lock.recover"))).toBe(false);
  });

  it("writes runtime.json with mode 0600 and removes it with the lock on close", async () => {
    const d = await start();
    const runtime = JSON.parse(await readFile(local("runtime.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(runtime).toMatchObject({ pid: process.pid, port: d.port, token: d.token, url: d.url });
    expect(typeof runtime.version).toBe("string");
    expect((await stat(local("runtime.json"))).mode & 0o777).toBe(0o600);
    expect(await readFile(local(".gitignore"), "utf8")).toBe("*\n");
    expect((await stat(project.local)).mode & 0o777).toBe(0o700);
    await d.close();
    expect(existsSync(local("runtime.json"))).toBe(false);
    expect(existsSync(local("daemon.lock"))).toBe(false);
  });
});

describe("request security", () => {
  it("rejects a foreign Host with 403", async () => {
    const d = await start();
    expect((await call(d, "/api/status", { ...bearer(d), host: "evil.example:80" })).status).toBe(
      403,
    );
    expect((await call(d, "/api/status", { ...bearer(d), host: "127.0.0.1:1" })).status).toBe(403);
    expect(
      (await call(d, "/api/status", { ...bearer(d), host: `localhost:${String(d.port)}` })).status,
    ).toBe(200);
  });

  it("rejects a missing or non-canonical Host and a null Origin with 403", async () => {
    const d = await start();
    const port = String(d.port);
    expect(
      await raw(d, `GET /api/status HTTP/1.0\r\nAuthorization: Bearer ${d.token}\r\n\r\n`),
    ).toMatch(/ 403 /);
    expect((await call(d, "/api/status", { ...bearer(d), host: `LOCALHOST:${port}` })).status).toBe(
      403,
    );
    expect((await call(d, "/api/status", { ...bearer(d), origin: "null" })).status).toBe(403);
  });

  it("rejects a foreign Origin with 403", async () => {
    const d = await start();
    const port = String(d.port);
    expect(
      (await call(d, "/api/status", { ...bearer(d), origin: "http://evil.example" })).status,
    ).toBe(403);
    expect(
      (await call(d, "/api/status", { ...bearer(d), origin: `https://127.0.0.1:${port}` })).status,
    ).toBe(403);
    expect(
      (await call(d, "/api/status", { ...bearer(d), origin: `http://localhost:${port}` })).status,
    ).toBe(200);
  });

  it("requires the token: missing or wrong → 401, Bearer works, no CORS", async () => {
    const d = await start();
    expect((await call(d, "/api/status")).status).toBe(401);
    expect((await call(d, "/api/status", { authorization: "Bearer nope" })).status).toBe(401);
    expect((await call(d, "/api/status", { authorization: `Bearer ${d.token}x` })).status).toBe(
      401,
    );
    expect((await call(d, "/?token=wrong")).status).toBe(401);
    const ok = await call(d, "/api/status", bearer(d));
    expect(ok.status).toBe(200);
    expect(ok.headers["access-control-allow-origin"]).toBeUndefined();
    expect(JSON.parse(ok.body)).toMatchObject({
      pid: process.pid,
      port: d.port,
      root: project.root,
      knowledge: project.knowledge,
      engine: { state: "ok", documents: 0, errors: 0, warnings: 0 },
    });
    expect((await call(d, "/nowhere", bearer(d))).status).toBe(404);
  });

  it("trades ?token= for an HttpOnly SameSite=Strict cookie that then authenticates", async () => {
    const d = await start();
    const r = await call(d, `/?token=${d.token}`);
    expect(r.status).toBe(303);
    expect(r.headers.location).toBe("/");
    const set = r.headers["set-cookie"]?.[0] ?? "";
    expect(set).toBe(`ai-submind-${String(d.port)}=${d.token}; HttpOnly; SameSite=Strict; Path=/`);
    const cookie = set.split(";")[0] ?? "";
    expect((await call(d, "/", { cookie })).status).toBe(200);
    expect((await call(d, "/api/status", { cookie: `other=1; ${cookie}` })).status).toBe(200);
    expect((await call(d, "/api/status", { cookie: `ai-submind-1=${d.token}` })).status).toBe(401);
  });

  it("listens on 127.0.0.1 only", async () => {
    const d = await start();
    expect(d.url).toBe(`http://127.0.0.1:${String(d.port)}/`);
    const others = Object.values(networkInterfaces())
      .flat()
      .flatMap((a) => (a && !a.internal && a.family === "IPv4" ? [a.address] : []));
    for (const host of ["::1", ...others]) {
      const refused = await new Promise<boolean>((ok) => {
        const s = connect({ host, port: d.port }, () => {
          s.destroy();
          ok(false);
        }).on("error", () => {
          ok(true);
        });
        s.setTimeout(500, () => {
          s.destroy();
          ok(true); // unreachable interface: not served either
        });
      });
      expect(refused, host).toBe(true);
    }
  });
});

describe("robustness", () => {
  it("answers 400 to an unparsable URL and keeps serving", async () => {
    const d = await start();
    const host = `127.0.0.1:${String(d.port)}`;
    expect(
      await raw(d, `GET http://[ HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`),
    ).toMatch(/ 400 /);
    expect((await call(d, "/api/status", bearer(d))).status).toBe(200);
  });

  it("answers 500 when a handler throws, synchronously or not, and keeps serving", async () => {
    const d = await start();
    d.routes.set("GET /boom", () => {
      throw new Error("boom");
    });
    d.routes.set("GET /reject", () => Promise.reject(new Error("later")));
    expect((await call(d, "/boom", bearer(d))).status).toBe(500);
    expect((await call(d, "/reject", bearer(d))).status).toBe(500);
    expect((await call(d, "/api/status", bearer(d))).status).toBe(200);
  });
});

describe("port", () => {
  const occupy = (port: number): Promise<Server | undefined> =>
    new Promise((ok) => {
      const s = createServer();
      s.once("error", () => {
        ok(undefined);
      }).listen(port, "127.0.0.1", () => {
        ok(s);
      });
    });

  it("falls back to a free port when 7777 is busy", async () => {
    const blocker = await occupy(7777); // undefined: something else already holds 7777
    try {
      const d = await start({});
      expect(d.port).not.toBe(7777);
      expect((await call(d, "/api/status", bearer(d))).status).toBe(200);
    } finally {
      blocker?.close();
    }
  });

  it("fails when an explicit port is busy, leaving no lock", async () => {
    const blocker = await occupy(0);
    const address = blocker?.address();
    if (!address || typeof address === "string") throw new Error("no port");
    try {
      await expect(startDaemon(project, { port: address.port })).rejects.toMatchObject({
        code: "EADDRINUSE",
      });
      expect(existsSync(local("daemon.lock"))).toBe(false);
    } finally {
      blocker?.close();
    }
  });
});

describe("shutdown", () => {
  it("stops after the idle period", async () => {
    const d = await start({ port: 0, idleMs: 200 });
    await d.closed;
    expect(existsSync(local("runtime.json"))).toBe(false);
  });

  it("an in-flight request prevents idle shutdown", async () => {
    const d = await start({ port: 0, idleMs: 200 });
    let release: () => void = () => undefined;
    d.routes.set("GET /slow", (_req, res) => {
      release = () => res.end("done");
    });
    let closed = false;
    void d.closed.then(() => (closed = true));
    const pending = call(d, "/slow", bearer(d));
    await sleep(700);
    expect(closed).toBe(false);
    release();
    expect((await pending).body).toBe("done");
    await d.closed;
  });

  it("POST /api/stop answers 202 and shuts down", async () => {
    const d = await start();
    expect((await call(d, "/api/stop", bearer(d), "POST")).status).toBe(202);
    await d.closed;
    expect(existsSync(local("daemon.lock"))).toBe(false);
  });
});
