// `ai-submind mcp` (API-001, API-003, DEC-005, DEC-016): stdio MCP server for agents that bridges every
// message to the project daemon's stateless `/mcp` route, starting the daemon if needed. stdout carries
// only the protocol; logs go to stderr.
import { StreamableHTTPClientTransport, type FetchLike } from "@modelcontextprotocol/client";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import type { Project } from "../daemon/project.js";
import { ensureDaemon } from "../daemon/runtime.js";

type Message = Parameters<StdioServerTransport["send"]>[0];

const log = (line: string): void => {
  process.stderr.write(`ai-submind mcp: ${line}\n`);
};

const refused = (e: unknown): boolean =>
  (e as { cause?: { code?: string } } | undefined)?.cause?.code === "ECONNREFUSED";

/** Runs the proxy until stdin closes; never returns normally (exits the process). */
export async function proxy(project: Project): Promise<number> {
  let runtime = await ensureDaemon(project);
  log(`daemon pid ${String(runtime.pid)} at ${runtime.url}`);

  // The request never reached a handler when the connection is refused (daemon gone) or the token is
  // stale (daemon restarted): start or find the daemon again and retry once.
  const send: FetchLike = async (_url, init) => {
    const attempt = (): Promise<Response> => {
      const headers = new Headers(init?.headers);
      headers.set("authorization", `Bearer ${runtime.token}`);
      return fetch(new URL("mcp", runtime.url), { ...init, headers });
    };
    const again = async (why: string): Promise<Response> => {
      log(`${why}; ensuring the daemon`);
      runtime = await ensureDaemon(project);
      log(`daemon pid ${String(runtime.pid)} at ${runtime.url}`);
      return attempt();
    };
    let res: Response;
    try {
      res = await attempt();
    } catch (e) {
      if (!refused(e)) throw e;
      return again("connection refused");
    }
    if (res.status !== 401) return res;
    await res.body?.cancel();
    return again("token rejected");
  };

  const up = new StreamableHTTPClientTransport(new URL("mcp", runtime.url), { fetch: send });
  const down = new StdioServerTransport();
  const initializing = new Set<unknown>();

  down.onmessage = (msg: Message) => {
    const request = "method" in msg && "id" in msg ? msg : undefined;
    if (request?.method === "initialize") initializing.add(request.id);
    up.send(msg).catch((e: unknown) => {
      const text = e instanceof Error ? e.message : String(e);
      log(`cannot forward ${request?.method ?? "message"}: ${text}`);
      if (request) {
        void down.send({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32603, message: `ai-submind daemon unreachable: ${text}` },
        });
      }
    });
  };
  up.onmessage = (msg: Message) => {
    if ("result" in msg && initializing.delete(msg.id)) {
      const version = (msg.result as { protocolVersion?: unknown }).protocolVersion;
      if (typeof version === "string") up.setProtocolVersion(version);
    }
    void down.send(msg);
  };
  up.onerror = (e) => {
    log(e.message);
  };
  down.onerror = (e) => {
    log(e.message);
  };
  const closed = new Promise<void>((ok) => {
    down.onclose = ok;
  });

  await up.start();
  await down.start();
  await closed;
  await up.close();
  process.exit(0); // undici keep-alive sockets must not keep the agent's child process around
}
