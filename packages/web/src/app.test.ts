import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { App, newWorkspace, type AppElements } from "./app.js";
import type { WorkspaceSnapshot } from "./workspace.js";

export function elements(): AppElements {
  const el = () => document.body.appendChild(document.createElement("div"));
  return { toolbar: el(), explorer: el(), editor: el(), preview: el(), panel: el() };
}

export const FILES: WorkspaceSnapshot = {
  files: {
    "catalog.flo": "entity api [API Gateway]\nentity db [Base]\n",
    "login.flo": 'use "./catalog.flo"\nflow login "Inicio" {\n  api -> db\n}\nflow vacio {}\n',
  },
  saved: {
    "catalog.flo": "entity api [API Gateway]\nentity db [Base]\n",
    "login.flo": 'use "./catalog.flo"\nflow login "Inicio" {\n  api -> db\n}\nflow vacio {}\n',
  },
  active: "login.flo",
  dir: null,
};

describe("App", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("previews the active document with entities from other documents", () => {
    const el = elements();
    const app = new App(el, FILES);
    expect(app.view.state.doc.toString()).toBe(FILES.files["login.flo"]);
    expect(el.preview.innerHTML).toContain(">API Gateway<");
    expect(el.preview.innerHTML).toContain('data-flo-block="login.flo#login"');
    expect(el.preview.innerHTML).toContain("Bloque vacío");
  });

  it("relinks every document after an edit in another one", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.openDocument("catalog.flo");
    app.view.dispatch({ changes: { from: 0, to: "entity api [API Gateway]".length, insert: "entity api [Puerta]" } });
    app.openDocument("login.flo");
    expect(el.preview.innerHTML).toContain(">Puerta<");
  });

  it("switches documents in the editor", () => {
    const app = new App(elements(), FILES);
    app.openDocument("catalog.flo");
    expect(app.ws.active).toBe("catalog.flo");
    expect(app.view.state.doc.toString()).toBe(FILES.files["catalog.flo"]);
  });

  it("adds a new file to an open folder instead of replacing the workspace", () => {
    const dir = {} as FileSystemDirectoryHandle;
    const app = new App(elements(), { ...FILES, dir });
    app.newDocument("flowchart");
    app.newDocument("sequence");
    expect(app.ws.uris()).toEqual(["catalog.flo", "login.flo", "nuevo-2.flo", "nuevo.flo"]);
    expect(app.ws.active).toBe("nuevo-2.flo");
  });

  it("replaces the workspace for a new document without a folder, asking before discarding changes", () => {
    const app = new App(elements(), FILES);
    app.ws.setSource("catalog.flo", "entity api\n");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    app.newDocument("flowchart");
    expect(confirm).toHaveBeenCalledWith("Hay cambios sin guardar. ¿Descartarlos?");
    expect(app.ws.uris()).toEqual(["catalog.flo", "login.flo"]);
    confirm.mockReturnValue(true);
    app.newDocument("flowchart");
    expect(app.ws.uris()).toEqual(["nuevo.flo"]);
  });

  it("saves every modified file into the folder", async () => {
    const written: Record<string, string> = {};
    const dir = {
      queryPermission: vi.fn().mockResolvedValue("granted"),
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn(async (name: string) => ({
        createWritable: async () => ({ write: async (data: string) => void (written[name] = data), close: async () => {} }),
      })),
      requestPermission: vi.fn(),
    } as unknown as FileSystemDirectoryHandle;
    const app = new App(elements(), { ...FILES, dir });
    app.ws.setSource("catalog.flo", "entity api\nentity db\n");

    await app.save();

    expect(written).toEqual({ "catalog.flo": "entity api\nentity db\n" });
    expect(app.ws.isDirty("catalog.flo")).toBe(false);
  });

  it("does not mark anything saved when write permission is denied", async () => {
    const dir = {
      queryPermission: vi.fn().mockResolvedValue("prompt"),
      requestPermission: vi.fn().mockResolvedValue("denied"),
    } as unknown as FileSystemDirectoryHandle;
    const app = new App(elements(), { ...FILES, dir });
    app.ws.setSource("catalog.flo", "entity api\n");
    await expect(app.save()).rejects.toThrow("sin permiso de escritura en la carpeta");
    expect(app.ws.isDirty("catalog.flo")).toBe(true);
  });

  it("starts from a new flowchart", () => {
    expect(newWorkspace()).toEqual({ files: { "nuevo.flo": "flow nuevo {\n\n}\n" }, saved: {}, active: "nuevo.flo", dir: null });
  });
});
