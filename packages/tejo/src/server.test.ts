import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { FloFolder } from "@tejo/mcp";
import { createViewServer, startView } from "./server.js";
import { tempFolder } from "./test-folder.js";

const servers: Server[] = [];
afterEach(() => {
  // Un stream SSE abierto no deja cerrar el servidor: se cortan las conexiones.
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    server.close();
  }
});

async function serve(files: Record<string, string>) {
  const root = tempFolder(files);
  const viewer = tempFolder({ "index.html": "<!doctype html><title>tejo</title>", "assets/app.js": "console.log(1)" });
  const folder = new FloFolder(root);
  folder.load();
  const server = createViewServer(folder, viewer);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { root, port, base: `http://127.0.0.1:${port}` };
}

/** `fetch` no deja cambiar `Host`: para esos casos, `http.request` a mano. */
function raw(port: number, path: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, headers }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });
}

describe("tejo view: servidor", () => {
  it("GET /api/files devuelve los documentos", async () => {
    const { base, root } = await serve({ "a.flo": "entity api\n", "kb/b.md": "# b\n", "x.txt": "no" });
    const body = await (await fetch(`${base}/api/files`)).json();
    expect(body.files).toEqual({ "a.flo": "entity api\n", "kb/b.md": "# b\n" });
    expect(body.root).toBe(root.split("/").at(-1));
  });

  it("PUT escribe sin validar y devuelve la uri", async () => {
    const { base, root } = await serve({});
    const res = await fetch(`${base}/api/files/kb/nueva%20nota.md`, { method: "PUT", body: "---\nid: [\n" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uri: "kb/nueva nota.md" });
    expect(readFileSync(join(root, "kb/nueva nota.md"), "utf8")).toBe("---\nid: [\n");
  });

  // `%2e%2e` lo normaliza el parser de URL (del cliente o del servidor) y la ruta deja de ser /api/files/: 404.
  it.each(["..%2Ffuera.md", "%2e%2e/fuera.md", "a.txt", "kb%5C..%5C..%5Cfuera.md", ".git/x.md"])(
    "PUT %s → rechazado sin escribir fuera",
    async (path) => {
      const { base, root } = await serve({});
      const res = await fetch(`${base}/api/files/${path}`, { method: "PUT", body: "x" });
      expect([400, 404]).toContain(res.status);
      expect((await res.json()).error).toBeTypeOf("string");
      expect(existsSync(join(root, "..", "fuera.md"))).toBe(false);
    }
  );

  it("PUT a través de un symlink que sale de la raíz → 400", async () => {
    const { base, root } = await serve({});
    const outside = tempFolder({});
    symlinkSync(outside, join(root, "link"));
    const res = await fetch(`${base}/api/files/link/a.md`, { method: "PUT", body: "x" });
    expect(res.status).toBe(400);
    expect(existsSync(join(outside, "a.md"))).toBe(false);
  });

  it("vistas: PUT en .flo/views y GET /api/views", async () => {
    const { base } = await serve({});
    expect((await fetch(`${base}/api/files/.flo/views/mia.json`, { method: "PUT", body: '{"a":1}' })).status).toBe(200);
    expect(await (await fetch(`${base}/api/views`)).json()).toEqual({ mia: '{"a":1}' });
  });

  it("Host u Origin ajenos → 403", async () => {
    const { port } = await serve({});
    expect(await raw(port, "/api/files", { host: `evil.test:${port}` })).toBe(403);
    expect(await raw(port, "/api/files", { host: `127.0.0.1:${port}`, origin: "http://evil.test" })).toBe(403);
    expect(await raw(port, "/api/files", { host: `localhost:${port}`, origin: `http://localhost:${port}` })).toBe(200);
  });

  it("sirve estáticos y 404 fuera del visor", async () => {
    const { base } = await serve({});
    const index = await fetch(`${base}/`);
    expect(index.headers.get("content-type")).toContain("text/html");
    expect(await index.text()).toContain("<title>tejo</title>");
    expect((await fetch(`${base}/assets/app.js`)).headers.get("content-type")).toContain("javascript");
    expect((await fetch(`${base}/..%2F..%2Fetc%2Fpasswd`)).status).toBe(404);
    expect((await fetch(`${base}/no-existe.js`)).status).toBe(404);
  });

  it("GET /api/events avisa cuando cambia el disco", async () => {
    const { base, root } = await serve({ "a.flo": "entity api\n" });
    const controller = new AbortController();
    const res = await fetch(`${base}/api/events`, { signal: controller.signal });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    writeFileSync(join(root, "a.flo"), "entity api\nentity db\n");
    let text = "";
    while (!text.includes("event: change")) text += new TextDecoder().decode((await reader.read()).value);
    controller.abort();
  });
});

describe("startView", () => {
  it("puerto ocupado → error que sugiere --port", async () => {
    const { port } = await serve({});
    const root = tempFolder({});
    await expect(startView(root, { port, open: false, viewerDir: tempFolder({ "index.html": "x" }) })).rejects.toThrow(
      `el puerto ${port} está ocupado; prueba con --port <otro>`
    );
  });
});
