import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runScopeHandlers } from "@codemirror/view";
import { App, newWorkspace, type AppElements } from "./app.js";
import type { WorkspaceSnapshot } from "./workspace.js";

// jsdom no descarga archivos: se observa qué SVG recibe la exportación.
vi.mock("./export.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./export.js")>()),
  exportSvg: vi.fn(),
}));
import { exportSvg } from "./export.js";

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

  it("asks before replacing an open folder whose new file was never saved", () => {
    const app = new App(elements(), { ...FILES, dir: {} as FileSystemDirectoryHandle });
    app.newDocument("flowchart");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    app.loadExample("flowchart");
    expect(confirm).toHaveBeenCalledWith("Hay cambios sin guardar. ¿Descartarlos?");
    expect(app.ws.uris()).toContain("nuevo.flo");
  });

  it("keeps each document's undo history across switches", () => {
    const app = new App(elements(), FILES);
    app.openDocument("catalog.flo");
    app.view.dispatch({ changes: { from: 0, insert: "entity x\n" } });
    app.openDocument("login.flo");
    app.openDocument("catalog.flo");
    // jsdom no es mac: Mod-z es Ctrl-z.
    runScopeHandlers(app.view, new KeyboardEvent("keydown", { key: "z", ctrlKey: true }), "editor");
    expect(app.view.state.doc.toString()).toBe(FILES.files["catalog.flo"]);
    expect(app.ws.source("catalog.flo")).toBe(FILES.files["catalog.flo"]);
  });

  it("starts a replaced workspace without selection, panel or map mode", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.selectBlock("login.flo#login", "api");
    app.selectEntity("api");
    app.toggleMap();
    app.loadExample("flowchart");
    expect(app.selectedBlock).toBeNull();
    expect(el.panel.innerHTML).toBe("");
    expect(el.preview.innerHTML).not.toContain("Mapa del sistema");
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

  it("goes to the definition in another file", () => {
    const app = new App(elements(), FILES);
    app.goToDefinition({ line: 3, column: 10 }); // 'db' en 'api -> db'
    expect(app.ws.active).toBe("catalog.flo");
    const { from, to } = app.view.state.selection.main;
    expect(app.view.state.sliceDoc(from, to)).toBe("db");
  });

  it("does nothing on text that names no entity", () => {
    const app = new App(elements(), FILES);
    app.goToDefinition({ line: 2, column: 1 });
    expect(app.ws.active).toBe("login.flo");
  });

  it("renames across documents: the active one through the editor, the rest in the workspace", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.selectEntity("api");
    vi.spyOn(window, "prompt").mockReturnValue("gateway");
    click(el.panel.querySelector("[data-flo-rename]")!);
    expect(app.view.state.doc.toString()).toContain("  gateway -> db");
    expect(app.ws.source("login.flo")).toContain("  gateway -> db");
    expect(app.ws.source("catalog.flo")).toBe("entity gateway [API Gateway]\nentity db [Base]\n");
    expect(app.ws.isDirty("catalog.flo")).toBe(true);
    expect(el.panel.innerHTML).toContain("<code>gateway</code>");
  });

  it("shows the rename error and changes nothing", () => {
    const app = new App(elements(), FILES);
    vi.spyOn(window, "prompt").mockReturnValue("db");
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    app.rename("api");
    expect(alert).toHaveBeenCalledWith("ya existe una entidad 'db'");
    expect(app.ws.hasUnsavedChanges()).toBe(false);
  });

  it("renames the entity under the cursor", () => {
    const app = new App(elements(), FILES);
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    app.renameAt({ line: 3, column: 4 });
    expect(prompt).toHaveBeenCalledWith("Nuevo id para 'api':", "api");
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

  it("shows the aggregated map and lists the flows of a clicked edge", () => {
    const el = elements();
    const app = new App(el, FILES);
    click(el.toolbar.querySelector("#flo-toggle-map")!);
    expect(el.preview.innerHTML).toContain("Mapa del sistema");
    click(el.preview.querySelector('polyline.flo-map-hit[data-flo-from="api"]')!);
    expect(el.panel.innerHTML).toContain("En 1 flujo");
    click(el.panel.querySelector('[data-flo-block="login.flo#login"]')!);
    expect(el.preview.innerHTML).not.toContain("Mapa del sistema");
    expect(app.selectedBlock).toBe("login.flo#login");
  });

  it("opens the entity panel from a map node", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.toggleMap();
    click(el.preview.querySelector('[data-flo-entity="db"]')!);
    expect(el.panel.innerHTML).toContain("<code>db</code>");
  });

  it("exports the selected block, or the map when it is visible", () => {
    const el = elements();
    const app = new App(el, FILES);
    vi.mocked(exportSvg).mockClear();
    app.selectBlock("login.flo#vacio");
    click(el.toolbar.querySelector("#flo-export-svg")!);
    expect(vi.mocked(exportSvg).mock.calls[0][0]).not.toContain("API Gateway"); // no el primero
    app.toggleMap();
    click(el.toolbar.querySelector("#flo-export-svg")!);
    expect(vi.mocked(exportSvg).mock.calls[1][0]).toContain('data-flo-block="#mapa"');
  });

  it("marks the map button as pressed while the map is visible", () => {
    const el = elements();
    const app = new App(el, FILES);
    const button = el.toolbar.querySelector("#flo-toggle-map")!;
    expect(button.getAttribute("aria-pressed")).toBe("false");
    app.toggleMap();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    app.selectBlock("login.flo#login");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("closes an edge panel when leaving the map through one of its flows", () => {
    const el = elements();
    new App(el, FILES);
    click(el.toolbar.querySelector("#flo-toggle-map")!);
    click(el.preview.querySelector('polyline.flo-map-hit[data-flo-from="api"]')!);
    click(el.panel.querySelector('[data-flo-block="login.flo#login"]')!);
    expect(el.panel.innerHTML).toBe("");
  });
});
