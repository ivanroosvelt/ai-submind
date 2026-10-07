import { afterEach, describe, expect, it, vi } from "vitest";
import { openLocalFolder, readLocalViews, watchLocalFolder, writeLocalFile } from "./local-folder.js";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("local-folder", () => {
  it("con API: snapshot local con lo del disco como guardado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ root: "kb", files: { "b.md": "# b\n", "a.flo": "entity a\n" } })));
    expect(await openLocalFolder()).toEqual({
      files: { "b.md": "# b\n", "a.flo": "entity a\n" },
      saved: { "b.md": "# b\n", "a.flo": "entity a\n" },
      active: "a.flo",
      dir: null,
      local: true,
    });
    expect(fetch).toHaveBeenCalledWith("api/files", expect.anything());
  });

  it.each([
    ["404", async () => new Response("no", { status: 404 })],
    ["HTML", async () => new Response("<html>", { headers: { "content-type": "text/html" } })],
    ["red caída", async () => Promise.reject(new TypeError("fail"))],
  ])("sin API (%s): null", async (_name, impl) => {
    vi.stubGlobal("fetch", vi.fn(impl));
    expect(await openLocalFolder()).toBeNull();
  });

  it("writeLocalFile hace PUT con la uri codificada por segmento", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ uri: "kb/a b.md" })));
    await writeLocalFile("kb/a b.md", "x");
    expect(fetch).toHaveBeenCalledWith("api/files/kb/a%20b.md", { method: "PUT", body: "x" });
  });

  it("writeLocalFile lanza el error del servidor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "solo se escriben archivos .md o .flo" }, 400)));
    await expect(writeLocalFile("a.txt", "x")).rejects.toThrow("solo se escriben archivos .md o .flo");
  });

  it("readLocalViews devuelve el mapa nombre → texto", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ mia: "{}" })));
    expect(await readLocalViews()).toEqual({ mia: "{}" });
  });

  it("watchLocalFolder escucha 'change' en api/events y se cierra", () => {
    const listeners: Record<string, () => void> = {};
    const close = vi.fn();
    const EventSourceMock = vi.fn(() => ({ addEventListener: (type: string, fn: () => void) => (listeners[type] = fn), close }));
    vi.stubGlobal("EventSource", EventSourceMock);
    const onChange = vi.fn();
    const stop = watchLocalFolder(onChange);
    expect(EventSourceMock).toHaveBeenCalledWith("api/events");
    listeners.change();
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    expect(close).toHaveBeenCalled();
  });
});
