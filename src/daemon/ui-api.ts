// UI HTTP API of the daemon (API-002, REQ-028..REQ-033, DEC-017): the built UI from dist/ui/, read routes
// over the query facade, layout writes through engine transactions (the only write, REQ-032) and the SSE
// stream of engine changes. Token, Host and Origin are checked by the daemon before dispatch (DEC-014).
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ChangeEvent, Engine } from "../engine/engine.js";
import { EngineError } from "../engine/errors.js";
import { isValidId } from "../engine/ids.js";
import { QueryError } from "../query/errors.js";
import { LIMITS, type QueryPage } from "../query/limits.js";
import type { DiagramView, Query } from "../query/query.js";

/** Same depth from src/daemon/ and dist/daemon/: the package's dist/ui/ (built by `npm run build`). */
const UI_DIR = new URL("../../dist/ui/", import.meta.url);
/** Largest request body accepted (a layout of thousands of nodes fits easily). */
export const MAX_BODY = 2 * 1024 * 1024;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
// Build output names only: no separators, no leading dot, so nothing can leave dist/ui/assets/.
const ASSET = /^\/assets\/([A-Za-z0-9_-][A-Za-z0-9_.-]*)$/;
const CSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; " +
  "base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

type Route = [string, (req: IncomingMessage, res: ServerResponse) => void | Promise<void>];

function json(res: ServerResponse, status: number, value: unknown): void {
  res
    .writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    })
    .end(JSON.stringify(value));
}

const error = (
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void => {
  json(res, status, { error: { code, message, ...(details === undefined ? {} : { details }) } });
};

/** Typed engine and query errors as JSON; anything else is a bug and goes to the daemon (500). */
function typed(res: ServerResponse, e: unknown): void {
  if (!(e instanceof EngineError || e instanceof QueryError)) throw e;
  const status = e.code === "NOT_FOUND" ? 404 : e.code === "REVISION_CONFLICT" ? 409 : 400;
  error(res, status, e.code, e.message, e.details);
}

async function serve(res: ServerResponse, name: string, headers: Record<string, string> = {}) {
  let bytes: Buffer;
  try {
    bytes = await readFile(new URL(name, UI_DIR));
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "EISDIR") throw e;
    if (name === "index.html") error(res, 503, "UI_NOT_BUILT", "dist/ui is missing: npm run build");
    else res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found\n");
    return;
  }
  const ext = /\.[a-z0-9]+$/.exec(name)?.[0] ?? "";
  res
    .writeHead(200, {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
      "cache-control": "no-cache",
      ...headers,
    })
    .end(bytes);
}

/**
 * Body as text; `undefined` once it exceeds `MAX_BODY`, after answering 413 and closing the connection
 * without reading the rest.
 */
function body(req: IncomingMessage, res: ServerResponse): Promise<string | undefined> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const tooLarge = (): void => {
      req.removeAllListeners("data");
      req.pause();
      res.setHeader("connection", "close");
      error(res, 413, "PAYLOAD_TOO_LARGE", `body over ${String(MAX_BODY)} bytes`);
      // ponytail: closing right away may reset the connection before the client reads the 413 (it sees
      // ECONNRESET/EPIPE instead); draining the body to avoid that would mean reading what we refuse.
      res.on("finish", () => req.destroy());
      ok(undefined);
    };
    if (Number(req.headers["content-length"] ?? 0) > MAX_BODY) {
      tooLarge();
      return;
    }
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) tooLarge();
      else chunks.push(c);
    });
    req.on("end", () => {
      if (size <= MAX_BODY) ok(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", fail);
  });
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Routes of the UI API over `engine` and `query`, keyed like the daemon's (`"METHOD /path"`). */
export function uiRoutes(engine: Engine, query: Query): Route[] {
  const url = (req: IncomingMessage): URL => new URL(req.url ?? "/", "http://localhost");
  /** Revision of what the UI read: the diagram's model file and its layout (empty if none). */
  const revision = (view: DiagramView): string =>
    `${engine.revision(view.file) ?? ""}:${engine.revision(`layout/${view.diagram.id}.json`) ?? ""}`;
  const all = <T>(page: (offset: number) => QueryPage<T>): T[] => {
    const out: T[] = [];
    for (let offset: number | null = 0; offset !== null;) {
      const p = page(offset);
      out.push(...p.items);
      offset = p.nextOffset;
    }
    return out;
  };
  const limit = LIMITS.list.max;

  return [
    [
      "GET /",
      (_req, res) =>
        serve(res, "index.html", { "content-security-policy": CSP, "cache-control": "no-store" }),
    ],
    [
      "GET /assets/*",
      (req, res) => {
        const name = ASSET.exec(url(req).pathname)?.[1];
        if (name === undefined) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found\n");
          return;
        }
        return serve(res, `assets/${name}`);
      },
    ],
    [
      "GET /api/diagrams",
      (_req, res) => {
        json(res, 200, {
          models: all((offset) => query.listModels({ offset, limit }).data),
          diagrams: all((offset) => query.listDiagrams({ offset, limit }).data),
        });
      },
    ],
    [
      "GET /api/diagram",
      (req, res) => {
        const id = url(req).searchParams.get("id");
        if (id === null) {
          error(res, 400, "INVALID_ARGUMENT", "id: required");
          return;
        }
        try {
          const view = query.diagram(id).data;
          json(res, 200, { ...view, revision: revision(view) });
        } catch (e) {
          typed(res, e);
        }
      },
    ],
    [
      "GET /api/relations",
      (req, res) => {
        const id = url(req).searchParams.get("id");
        if (id === null) {
          error(res, 400, "INVALID_ARGUMENT", "id: required");
          return;
        }
        try {
          const max = LIMITS.relations.max;
          const items = all(
            (offset) => query.relations(id, { direction: "in", offset, limit: max }).data,
          );
          const name = (x: string): string | undefined => {
            const n = (engine.get(x)[0]?.node as { name?: unknown } | undefined)?.name;
            return typeof n === "string" && n !== "" ? n : undefined;
          };
          json(res, 200, {
            items: items.map((e) => {
              const n = name(e.from);
              return n === undefined ? e : { ...e, name: n };
            }),
          });
        } catch (e) {
          typed(res, e);
        }
      },
    ],
    [
      "GET /api/findings",
      (_req, res) => {
        const { state, findings } = engine.status();
        const errors = findings.filter((f) => f.severity === "error").length;
        json(res, 200, { state, errors, warnings: findings.length - errors, findings });
      },
    ],
    [
      "PUT /api/layout",
      async (req, res) => {
        const diagram = url(req).searchParams.get("diagram") ?? "";
        const text = await body(req, res);
        if (text === undefined) return;
        if (!isValidId(diagram, true)) {
          error(res, 400, "INVALID_ARGUMENT", "diagram: not a diagram ID");
          return;
        }
        let input: unknown;
        try {
          input = JSON.parse(text);
        } catch {
          error(res, 400, "INVALID_ARGUMENT", "body: not JSON");
          return;
        }
        if (
          !isObject(input) ||
          Object.keys(input).some((k) => k !== "layout" && k !== "revision") ||
          typeof input.revision !== "string" ||
          !isObject(input.layout)
        ) {
          error(res, 400, "INVALID_ARGUMENT", "body: expected {layout, revision}");
          return;
        }
        const { layout, revision: expected } = input;
        if (!isObject(layout.diagram) || layout.diagram.idref !== diagram) {
          error(res, 400, "INVALID_ARGUMENT", `layout.diagram: must be {"idref": "${diagram}"}`);
          return;
        }
        const path = `layout/${diagram}.json`;
        try {
          let view: DiagramView | undefined;
          await engine.transact(() => {
            view = query.diagram(diagram).data;
            const actual = revision(view);
            if (actual !== expected) {
              throw new EngineError("REVISION_CONFLICT", `${diagram} changed since it was read`, {
                path,
                expected,
                actual,
              });
            }
            return [{ op: "put", path, data: layout, expectedRevision: engine.revision(path) }];
          });
          if (view === undefined) throw new Error("transaction did not run");
          json(res, 200, { revision: revision(view), generation: engine.generation });
        } catch (e) {
          typed(res, e);
        }
      },
    ],
    [
      "GET /api/events",
      (_req, res) => {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
        });
        res.write(": connected\n\n");
        const send = (e: ChangeEvent): void => {
          const data = { source: e.source, generation: engine.generation, ...e.diff };
          res.write(`event: change\ndata: ${JSON.stringify(data)}\n\n`);
        };
        engine.on("change", send);
        res.on("close", () => engine.off("change", send));
      },
    ],
  ];
}
