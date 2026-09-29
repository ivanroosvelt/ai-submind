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

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("App navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens the entity panel from a node in the preview", () => {
    const el = elements();
    new App(el, FILES);
    click(el.preview.querySelector('[data-flo-entity="api"] text')!);
    expect(el.panel.innerHTML).toContain("API Gateway");
    expect(el.panel.innerHTML).toContain("Aparece en 1 flujo");
  });

  it("ignores unresolved placeholders", () => {
    const el = elements();
    new App(el, { ...FILES, files: { ...FILES.files, "login.flo": "flow f {\n  x -> y\n}\n" } });
    click(el.preview.querySelector('[data-flo-entity="x"]')!);
    expect(el.panel.innerHTML).toBe("");
  });

  it("jumps from a flow in the panel to its block, selecting it and highlighting the node", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.openDocument("catalog.flo");
    app.selectEntity("db");
    click(el.panel.querySelector('[data-flo-block="login.flo#login"]')!);
    expect(app.ws.active).toBe("login.flo");
    expect(app.selectedBlock).toBe("login.flo#login");
    const section = el.preview.querySelector('section[data-flo-block="login.flo#login"]')!;
    expect(section.classList.contains("flo-block-selected")).toBe(true);
    expect(section.querySelector('[data-flo-entity="db"]')!.classList.contains("flo-selected")).toBe(true);
  });

  it("selects a block by its title", () => {
    const el = elements();
    const app = new App(el, FILES);
    click(el.preview.querySelector('section[data-flo-block="login.flo#vacio"] .flo-block-title')!);
    expect(app.selectedBlock).toBe("login.flo#vacio");
  });

  it("reveals the definition in the editor", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.selectEntity("db");
    click(el.panel.querySelector("[data-flo-definition]")!);
    expect(app.ws.active).toBe("catalog.flo");
    const { from, to } = app.view.state.selection.main;
    expect(app.view.state.sliceDoc(from, to)).toBe("db");
  });

  it("closes the panel when the entity disappears", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.selectEntity("db");
    app.ws.setSource("catalog.flo", "entity api\n");
    app.refresh();
    expect(el.panel.innerHTML).toBe("");
  });

  it("keeps the explorer in sync with the workspace", () => {
    const el = elements();
    const app = new App(el, FILES);
    expect(el.explorer.querySelector('[data-flo-open="login.flo"]')!.classList.contains("flo-active")).toBe(true);
    click(el.explorer.querySelector('[data-flo-open="catalog.flo"]')!);
    expect(app.ws.active).toBe("catalog.flo");
    app.view.dispatch({ changes: { from: 0, insert: "entity nuevo\n" } });
    vi.advanceTimersByTime(200);
    expect(el.explorer.querySelector('[data-flo-entity="nuevo"]')).not.toBeNull();
    expect(el.explorer.querySelector('[data-flo-open="catalog.flo"] .flo-dirty')).not.toBeNull();
  });
});
