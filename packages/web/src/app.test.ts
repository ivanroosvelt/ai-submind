import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runScopeHandlers } from "@codemirror/view";
import { App, newWorkspace, type AppElements } from "./app.js";
import { memoryDir, type MemoryTree } from "./test-dir.js";
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

const KG_SOURCES: Record<string, string> = {
  "knowledge.schema.yaml": "type_tags: [decision, rule]\nrelation_types: [affects, enforces, visualized_by]\n",
  "catalog.flo": 'entity api [API]\nentity db\nflow acceso "Acceso" {\n  api -> db\n}\n',
  "login.flo": 'use "./catalog.flo"\nuse "./kb/pkce.md"\nflow login {\n  api -> pkce\n}\n',
  "kb/pkce.md": [
    "---",
    "id: pkce",
    "title: PKCE",
    "memory_type: long_term",
    "type_tags: [decision]",
    'context_tags: ["project:core"]',
    'use: ["../catalog.flo"]',
    "relations:",
    "  - target: api",
    "    type: affects",
    "  - target: ../catalog.flo#acceso",
    "    type: visualized_by",
    "  - target: rule.md",
    "    type: enforces",
    "---",
    "Texto de PKCE.",
    "",
  ].join("\n"),
  "kb/rule.md": "---\nid: rule\ntitle: Regla\nmemory_type: working\ntype_tags: [rule]\n---\nContraseñas largas.\n",
};

export const KG_FILES: WorkspaceSnapshot = { files: KG_SOURCES, saved: { ...KG_SOURCES }, active: "login.flo", dir: null };

const graphNodes = (el: AppElements) =>
  [...el.preview.querySelectorAll(".flo-kg g[data-flo-entity]")].map((g) => g.getAttribute("data-flo-entity"));

function change(root: ParentNode, name: string, value: string): void {
  const control = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-flo-kg="${name}"]`)!;
  control.value = value;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

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
    expect(vi.mocked(exportSvg).mock.calls[0][1]).toBe("vacio");
    expect(vi.mocked(exportSvg).mock.calls[1][1]).toBe("mapa");
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

describe("App knowledge graph", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses a fixture without diagnostics", () => {
    const app = new App(elements(), KG_FILES);
    expect([...app.ws.link().diagnostics.values()].flat()).toEqual([]);
  });

  it("shows the notes and their neighbours, with the graph button pressed", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    expect(el.preview.querySelector(".flo-kg-bar")).not.toBeNull();
    expect(graphNodes(el)).toEqual(["pkce", "rule", "api"]);
    expect(el.preview.innerHTML).toContain('data-flo-block="catalog.flo#acceso"');
    expect(el.toolbar.querySelector("#flo-toggle-graph")!.getAttribute("aria-pressed")).toBe("true");
    expect(el.toolbar.querySelector("#flo-toggle-map")!.getAttribute("aria-pressed")).toBe("false");
    app.toggleGraph();
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
  });

  it("filters with the bar", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    change(el.preview, "memory", "working");
    change(el.preview, "depth", "0");
    expect(graphNodes(el)).toEqual(["rule"]);
    expect(app.graph).toEqual({ where: { and: [{ text: "" }, { memory: "working" }] }, from: null, depth: 0, viewBox: null });
    change(el.preview, "memory", "");
    change(el.preview, "text", "pkce");
    expect(graphNodes(el)).toEqual(["pkce"]);
  });

  it("says so when nothing matches, and exporting does not throw", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    change(el.preview, "text", "no existe");
    expect(el.preview.textContent).toContain("Ninguna nota coincide con el filtro");
    vi.mocked(exportSvg).mockClear();
    click(el.toolbar.querySelector("#flo-export-svg")!);
    expect(exportSvg).not.toHaveBeenCalled();
  });

  it("opens a note in the editor and stays in the graph", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    click(el.preview.querySelector('.flo-kg g[data-flo-entity="rule"] text')!);
    expect(app.ws.active).toBe("kb/rule.md");
    expect(app.view.state.doc.toString()).toBe(KG_SOURCES["kb/rule.md"]);
    expect(el.preview.querySelector(".flo-kg")).not.toBeNull();
  });

  it("opens the entity panel for a .flo entity", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    click(el.preview.querySelector('.flo-kg g[data-flo-entity="api"] text')!);
    expect(el.panel.innerHTML).toContain("<code>api</code>");
  });

  it("opens the flow of a visualized_by edge, highlighting its source when present", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    click(el.preview.querySelector('polyline.flo-map-hit[data-flo-type="visualized_by"]')!);
    expect(app.ws.active).toBe("catalog.flo");
    expect(app.selectedBlock).toBe("catalog.flo#acceso");
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
    expect(el.toolbar.querySelector("#flo-toggle-graph")!.getAttribute("aria-pressed")).toBe("false");
  });

  it("opens the flow from its block node", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    click(el.preview.querySelector('.flo-kg g[data-flo-block="catalog.flo#acceso"] text')!);
    expect(app.selectedBlock).toBe("catalog.flo#acceso");
  });

  it("centers the graph on a note clicked in a flow, until cleared", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    click(el.preview.querySelector('[data-flo-entity="pkce"] text')!);
    expect(app.graph.from).toEqual(["pkce"]);
    expect(graphNodes(el)).toEqual(["pkce", "api", "rule"]);
    expect(el.preview.querySelector("[data-flo-kg-clear-from]")!.textContent).toBe("Centrado en PKCE ×");
    click(el.preview.querySelector("[data-flo-kg-clear-from]")!);
    expect(app.graph.from).toBeNull();
    expect(graphNodes(el)).toEqual(["pkce", "rule", "api"]);
  });

  it("still opens the entity panel for a .flo entity clicked in a flow", () => {
    const el = elements();
    new App(el, KG_FILES);
    click(el.preview.querySelector('[data-flo-entity="api"] text')!);
    expect(el.panel.innerHTML).toContain("<code>api</code>");
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
  });

  it("survives editing away the note it is centered on", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    click(el.preview.querySelector('[data-flo-entity="pkce"] text')!);
    app.openDocument("kb/pkce.md");
    app.view.dispatch({ changes: { from: 0, to: app.view.state.doc.length, insert: "" } });
    vi.advanceTimersByTime(500);
    expect(el.preview.textContent).toContain("Ninguna nota coincide con el filtro");
    expect(el.preview.querySelector("[data-flo-kg-clear-from]")!.textContent).toBe("Centrado en pkce ×");
  });

  it("keeps the pan/zoom across edits and drops it when the query changes", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    const svg = () => el.preview.querySelector(".flo-kg svg")!;
    svg().dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 }));
    const zoomed = svg().getAttribute("viewBox");
    expect(app.graph.viewBox).not.toBeNull();
    app.refresh();
    expect(svg().getAttribute("viewBox")).toBe(zoomed);
    change(el.preview, "depth", "2");
    expect(app.graph.viewBox).toBeNull();
    expect(svg().getAttribute("viewBox")).not.toBe(zoomed);
  });

  it("exports the graph as shown", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    vi.mocked(exportSvg).mockClear();
    click(el.toolbar.querySelector("#flo-export-svg")!);
    const svg = vi.mocked(exportSvg).mock.calls[0][0];
    expect(svg).toContain('data-flo-entity="pkce"');
    expect(svg).not.toContain("flo-map-hit");
    expect(vi.mocked(exportSvg).mock.calls[0][1]).toBe("grafo");
  });

  it("goes back to the document view when another workspace is loaded", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    app.load(FILES);
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
    expect(app.graph).toEqual({ where: { and: [{ text: "" }] }, from: null, depth: 1, viewBox: null });
  });

  const decisiones = {
    name: "decisiones",
    where: { and: [{ text: "" }, { typeTag: "decision" }] },
    from: null,
    depth: 0,
    viewBox: [0, 0, 50, 50],
  };

  function withViews(views: MemoryTree): { tree: MemoryTree; snapshot: WorkspaceSnapshot } {
    const tree: MemoryTree = { ".flo": { views } };
    return { tree, snapshot: { ...KG_FILES, dir: memoryDir(tree) } };
  }

  const presetNames = (el: AppElements) =>
    [...el.preview.querySelectorAll('[data-flo-kg="preset"] option')].map((option) => option.textContent);

  it("lists the folder's views when entering the graph and applies one", async () => {
    const el = elements();
    const app = new App(el, withViews({ "decisiones.json": JSON.stringify(decisiones) }).snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "decisiones"]));
    change(el.preview, "preset", "decisiones");
    expect(app.graph).toEqual({ where: decisiones.where, from: null, depth: 0, viewBox: [0, 0, 50, 50] });
    expect(graphNodes(el)).toEqual(["pkce"]);
    expect(el.preview.querySelector(".flo-kg svg")!.getAttribute("viewBox")).toBe("0 0 50 50");
  });

  it("saves the current graph as a view", async () => {
    const el = elements();
    const { tree, snapshot } = withViews({});
    const app = new App(el, snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas"]));
    change(el.preview, "depth", "2");
    vi.spyOn(window, "prompt").mockReturnValue(" mia ");
    click(el.preview.querySelector("[data-flo-kg-save]")!);
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "mia"]));
    const views = (tree[".flo"] as MemoryTree).views as MemoryTree;
    expect(JSON.parse(views["mia.json"] as string)).toEqual({ name: "mia", ...app.graph });
  });

  it("rejects a view name that is not a plain file name", async () => {
    const el = elements();
    const { tree, snapshot } = withViews({});
    const app = new App(el, snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas"]));
    vi.spyOn(window, "prompt").mockReturnValue("../fuera");
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    click(el.preview.querySelector("[data-flo-kg-save]")!);
    await vi.waitFor(() => expect(alert).toHaveBeenCalled());
    expect((tree[".flo"] as MemoryTree).views).toEqual({});
    expect(app.graph.depth).toBe(1);
  });

  it("asks before replacing an existing view", async () => {
    const el = elements();
    const original = JSON.stringify(decisiones);
    const { tree, snapshot } = withViews({ "decisiones.json": original });
    const app = new App(el, snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "decisiones"]));
    vi.spyOn(window, "prompt").mockReturnValue("decisiones");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    click(el.preview.querySelector("[data-flo-kg-save]")!);
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(((tree[".flo"] as MemoryTree).views as MemoryTree)["decisiones.json"]).toBe(original);
  });

  it("skips broken views and offers no views without a folder", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = elements();
    const app = new App(el, withViews({ "roto.json": "{", "decisiones.json": JSON.stringify(decisiones) }).snapshot);
    app.toggleGraph();
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "decisiones"]));

    const other = elements();
    const plain = new App(other, KG_FILES);
    plain.toggleGraph();
    expect(other.preview.querySelector('[data-flo-kg="preset"]')).toBeNull();
    expect(other.preview.querySelector("[data-flo-kg-save]")).toBeNull();
  });

  const search = (el: AppElements) => el.preview.querySelector<HTMLInputElement>('[data-flo-kg="text"]')!;

  function type(el: AppElements, value: string): void {
    const input = search(el);
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("applies the search while typing, after the debounce", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    type(el, "pkce");
    expect(graphNodes(el)).toEqual(["pkce", "rule", "api"]); // todavía no
    vi.advanceTimersByTime(200);
    expect(graphNodes(el)[0]).toBe("pkce");
    expect(app.graph.where).toEqual({ and: [{ text: "pkce" }] });
  });

  it("does not re-render when a control leaves the query unchanged, so a click in progress survives", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    type(el, "pkce");
    vi.advanceTimersByTime(200);
    const node = el.preview.querySelector('.flo-kg g[data-flo-entity="pkce"]')!;
    search(el).dispatchEvent(new Event("change", { bubbles: true })); // el blur al ir al nodo
    expect(el.preview.contains(node)).toBe(true);
    click(node.querySelector("text")!);
    expect(app.ws.active).toBe("kb/pkce.md");
  });

  it("keeps focus and unapplied text in the search across a re-render", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    type(el, "regl");
    search(el).setSelectionRange(1, 3);
    app.refresh(); // p. ej. una edición en otro documento
    expect(search(el).value).toBe("regl");
    expect(document.activeElement).toBe(search(el));
    expect([search(el).selectionStart, search(el).selectionEnd]).toEqual([1, 3]);
    vi.advanceTimersByTime(200);
    expect(app.graph.where).toEqual({ and: [{ text: "regl" }] });
    expect(graphNodes(el)[0]).toBe("rule");
  });

  it("keeps the search being typed when the folder's views finish loading", async () => {
    const el = elements();
    const app = new App(el, withViews({ "decisiones.json": JSON.stringify(decisiones) }).snapshot);
    app.toggleGraph();
    type(el, "reg");
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "decisiones"]));
    expect(search(el).value).toBe("reg");
    expect(document.activeElement).toBe(search(el));
  });

  it("drops a pending search when leaving the graph", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    type(el, "pkce");
    app.toggleGraph();
    vi.advanceTimersByTime(200);
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
    expect(app.graph.where).toEqual({ and: [{ text: "" }] });
  });

  it("saves each document of a folderless workspace to its own file (#55)", async () => {
    const written = new Map<string, string>();
    const handle = (name: string) =>
      ({
        name,
        createWritable: async () => ({ write: async (text: string) => void written.set(name, text), close: async () => {} }),
      }) as unknown as FileSystemFileHandle;
    window.showOpenFilePicker = vi.fn();
    window.showSaveFilePicker = vi.fn().mockResolvedValueOnce(handle("a")).mockResolvedValueOnce(handle("b"));
    try {
      const app = new App(elements(), FILES); // sin carpeta, dos archivos, activo login.flo
      await app.save();
      app.openDocument("catalog.flo");
      await app.save();
      expect(window.showSaveFilePicker).toHaveBeenCalledTimes(2);
      expect(written.get("a")).toBe(FILES.files["login.flo"]);
      expect(written.get("b")).toBe(FILES.files["catalog.flo"]);
    } finally {
      delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
      delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    }
  });

  it("saves on Ctrl/Cmd+S and keeps the browser's own dialog away (#56)", () => {
    const app = new App(elements(), FILES);
    const save = vi.spyOn(app, "save").mockResolvedValue();
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { ctrlKey: true, key: "S" }]) {
      const event = new KeyboardEvent("keydown", { key: "s", cancelable: true, ...init });
      app.onKeydown(event);
      expect(event.defaultPrevented).toBe(true);
    }
    for (const init of [{ ctrlKey: true, altKey: true }, {}]) {
      const event = new KeyboardEvent("keydown", { key: "s", cancelable: true, ...init });
      app.onKeydown(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(save).toHaveBeenCalledTimes(3);
  });

  it("warns before leaving the page only with changes that would be lost (#56)", () => {
    const app = new App(elements(), FILES);
    const leave = () => new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const clean = leave();
    app.onBeforeUnload(clean);
    expect(clean.defaultPrevented).toBe(false);
    app.ws.setSource("catalog.flo", "entity x\n");
    const dirty = leave();
    app.onBeforeUnload(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("never repeats an element id in the preview (#58)", () => {
    const el = elements();
    new App(el, { ...FILES, files: { ...FILES.files, "login.flo": 'use "./catalog.flo"\nflow a {\n  api -> db\n}\nflow b {\n  db -> api\n}\n' } });
    const ids = [...el.preview.querySelectorAll("[id]")].map((node) => node.id);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
