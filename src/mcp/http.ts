// HTTP route of the MCP server (API-001, DEC-016): the SDK's stateless web handler behind a small
// node:http ↔ fetch bridge. Auth, Host and Origin are checked by the daemon before dispatch (DEC-014).
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { Engine } from "../engine/engine.js";
import type { Query } from "../query/query.js";
import { createMcpServer } from "./tools.js";

type Route = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** `POST|GET|DELETE /mcp` handlers keyed like the daemon's routes, and the handler's shutdown. */
export function mcpRoutes(
  engine: Engine,
  query: Query,
  version: string,
): { routes: [string, Route][]; close: () => Promise<void> } {
  const handler = createMcpHandler(() => createMcpServer(engine, query, version), {
    legacy: "stateless",
    onerror: (e) => {
      process.stderr.write(`ai-submind: mcp: ${e.message}\n`);
    },
  });
  const route: Route = async (req, res) => {
    const abort = new AbortController();
    res.on("close", () => {
      abort.abort();
    });
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }
    const body = req.method === "GET" || req.method === "HEAD" ? null : Readable.toWeb(req);
    const response = await handler.fetch(
      new Request(new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`), {
        method: req.method ?? "GET",
        headers,
        body: body as ReadableStream | null,
        duplex: "half",
        signal: abort.signal,
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) {
      res.end();
      return;
    }
    // A client that goes away mid-stream is not a server error.
    await pipeline(Readable.fromWeb(response.body), res).catch((e: unknown) => {
      if (!res.destroyed) throw e;
    });
  };
  return {
    routes: [
      ["POST /mcp", route],
      ["GET /mcp", route],
      ["DELETE /mcp", route],
    ],
    close: () => handler.close(),
  };
}
