import { spawn } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { basename, extname, join, normalize, sep } from "node:path";
import { FloFolder } from "@tejo/mcp";

export const DEFAULT_PORT = 8356;
const MAX_BODY = 5 * 1024 * 1024;
const VIEW_FILE = /^([A-Za-z0-9_-]+)\.json$/;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Anti DNS-rebinding y CSRF (#66): solo el propio origen local. */
function isLocal(req: IncomingMessage, port: number): boolean {
  const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!allowed.includes(req.headers.host ?? "")) return false;
  const origin = req.headers.origin;
  return origin === undefined || allowed.some((host) => origin === `http://${host}`);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        // Se deja de leer: al terminar la respuesta Node descarta el resto del cuerpo.
        req.pause();
        reject(new Error("el archivo supera 5 MB"));
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** `.flo/views/*.json` de la carpeta, sin seguir enlaces simbólicos. */
function readViews(root: string): Record<string, string> {
  const dir = join(root, ".flo", "views");
  const views: Record<string, string> = {};
  for (const part of [join(root, ".flo"), dir]) {
    if (!lstatSync(part, { throwIfNoEntry: false })?.isDirectory()) return views;
  }
  for (const name of readdirSync(dir)) {
    const match = VIEW_FILE.exec(name);
    const file = join(dir, name);
    if (match && lstatSync(file).isFile()) views[match[1]] = readFileSync(file, "utf8");
  }
  return views;
}

/** Estáticos del visor; null si la ruta sale de `viewerDir` o no existe. */
function staticFile(viewerDir: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = normalize(join(viewerDir, decoded === "/" ? "index.html" : decoded));
  if (!file.startsWith(normalize(viewerDir + sep))) return null;
  return statSync(file, { throwIfNoEntry: false })?.isFile() ? file : null;
}

/** El servidor de `tejo view` (spec §4.3, decisión #66). */
export function createViewServer(folder: FloFolder, viewerDir: string): Server {
  const clients = new Set<ServerResponse>();
  let watcher: { close(): void } | null = null;

  const server = createServer((req, res) => {
    void handle(req, res).catch((error) => send(res, 500, { error: (error as Error).message }));
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { port } = server.address() as AddressInfo;
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) {
      const file = req.method === "GET" ? staticFile(viewerDir, url.pathname) : null;
      if (!file) return send(res, 404, { error: "no encontrado" });
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
      return;
    }
    if (!isLocal(req, port)) return send(res, 403, { error: "solo se aceptan pedidos desde el propio visor local" });

    if (req.method === "GET" && url.pathname === "/api/files") {
      return send(res, 200, { root: basename(folder.root), files: folder.files() });
    }
    if (req.method === "GET" && url.pathname === "/api/views") return send(res, 200, readViews(folder.root));
    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(": tejo\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (req.method === "PUT" && url.pathname.startsWith("/api/files/")) {
      let uri: string;
      try {
        uri = url.pathname.slice("/api/files/".length).split("/").map(decodeURIComponent).join("/");
      } catch {
        return send(res, 400, { error: "ruta mal codificada" });
      }
      // Una barra invertida o un segmento '..' nunca es una uri del workspace.
      if (uri.includes("\\") || uri.split("/").some((part) => part === ".." || part === "")) {
        return send(res, 400, { error: `ruta inválida: '${uri}'` });
      }
      const result = folder.save(uri, await readBody(req));
      return result.ok ? send(res, 200, { uri: result.uri }) : send(res, 400, { error: result.error });
    }
    send(res, 404, { error: "no encontrado" });
  }

  server.on("listening", () => {
    watcher = folder.watch(() => {
      for (const client of clients) client.write("event: change\ndata: {}\n\n");
    });
  });
  server.on("close", () => {
    watcher?.close();
    for (const client of clients) client.end();
    clients.clear();
  });
  return server;
}

function openBrowser(url: string): void {
  const [command, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  // ponytail: sin navegador (servidor, CI) solo queda la URL impresa.
  spawn(command, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

/** `tejo view`: carga la carpeta, escucha en 127.0.0.1 y abre el navegador. */
export async function startView(
  root: string,
  options: { port: number; open: boolean; viewerDir: string }
): Promise<{ url: string; server: Server }> {
  if (!existsSync(join(options.viewerDir, "index.html"))) {
    throw new Error(`no se encontró el visor en '${options.viewerDir}' (¿falta el build?)`);
  }
  const folder = new FloFolder(root);
  folder.load();
  const server = createViewServer(folder, options.viewerDir);
  await new Promise<void>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) =>
      reject(error.code === "EADDRINUSE" ? new Error(`el puerto ${options.port} está ocupado; prueba con --port <otro>`) : error)
    );
    server.listen(options.port, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}/`;
  if (options.open) openBrowser(url);
  return { url, server };
}
