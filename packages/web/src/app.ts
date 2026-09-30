import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  blockId,
  entityAt,
  query,
  renameEntity,
  renderKnowledge,
  renderMap,
  tagCatalog,
  type BlockId,
  type DocumentUri,
  type EntityId,
  type LinkResult,
  type Location,
  type Position,
} from "@flo/core";
import { createEditor, showDocument, type EditorHost } from "./editor.js";
import { edgePanelHtml, entityPanelHtml } from "./entity-panel.js";
import { bindExplorer, explorerHtml, type ExplorerFilter } from "./explorer.js";
import { DEFAULT_GRAPH, graphBarHtml, graphHtml, readBar, whereOf, type GraphQuery } from "./knowledge-view.js";
import { addEdgeHitAreas, mapHtml } from "./map-view.js";
import { bindPanZoom } from "./pan-zoom.js";
import { byName, isPresetName, listPresets, savePreset, type Preset } from "./presets.js";
import { nextPreviewState, previewHtml, renderActive, type PreviewState } from "./preview.js";
import { createToolbar, type DiagramKind } from "./toolbar.js";
import { openFloFile, saveFloFile } from "./file-io.js";
import { ensurePermission, openFolder, writeWorkspaceFile } from "./folder-io.js";
import { exportSvg, exportPng } from "./export.js";
import { saveDraft } from "./storage.js";
import { EXAMPLES } from "./examples.js";
import { enhanceSequencePreview } from "./sequence-view.js";
import { applyTextEdits, offsetAt, toChanges } from "./text-edits.js";
import { EditorWorkspace, type WorkspaceSnapshot } from "./workspace.js";

const NEW_SOURCE: Record<DiagramKind, string> = {
  flowchart: ["flow nuevo {", "", "}", ""].join("\n"),
  sequence: ["sequence nuevo {", "", "}", ""].join("\n"),
};

// Mismo debounce que el preview del editor (decisión #48).
const SEARCH_DEBOUNCE_MS = 200;

export function newWorkspace(kind: DiagramKind = "flowchart"): WorkspaceSnapshot {
  return { files: { "nuevo.flo": NEW_SOURCE[kind] }, saved: {}, active: "nuevo.flo", dir: null };
}

export interface AppElements {
  toolbar: HTMLElement;
  explorer: HTMLElement;
  editor: HTMLElement;
  preview: HTMLElement;
  panel: HTMLElement;
}

function reportActionError(action: string, error: unknown): void {
  console.error(`flo: ${action} falló`, error);
  window.alert(`No se pudo completar: ${action}. Revisá la consola para más detalle.`);
}

type PanelState = { kind: "entity"; id: EntityId } | { kind: "edge"; from: EntityId; to: EntityId } | null;

function byData(root: ParentNode, selector: string, attribute: string, value: string): Element[] {
  return Array.from(root.querySelectorAll(selector)).filter((element) => element.getAttribute(attribute) === value);
}

/** El editor web: un workspace de documentos, el documento activo en el editor y su preview. */
export class App {
  ws: EditorWorkspace;
  readonly view: EditorView;
  selectedBlock: BlockId | null = null;
  private previewState: PreviewState = { lastDiagrams: [] };
  private fileHandle: FileSystemFileHandle | null = null;
  private panel: PanelState = null;
  private mode: "document" | "map" | "graph" = "document";
  /** La consulta de la vista de grafo (#45); se reemplaza, nunca se muta. */
  graph: GraphQuery = DEFAULT_GRAPH;
  /** Las vistas guardadas de la carpeta (#46); null = sin cargar o sin carpeta. */
  private presets: Preset[] | null = null;
  private highlight: EntityId | null = null;
  private filter: ExplorerFilter = { type: null, tag: null };
  /** El estado de cada documento que dejó el editor, hasta que se reemplace el workspace (#43). */
  private readonly states = new Map<DocumentUri, EditorState>();
  private shown: DocumentUri | null = null;
  /** El debounce de la búsqueda de la barra del grafo (#48). */
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly host: EditorHost = {
    workspace: () => this.ws,
    onChange: () => this.refresh(),
    onGoToDefinition: (position) => this.goToDefinition(position),
    onRename: (position) => this.renameAt(position),
  };

  constructor(
    private readonly el: AppElements,
    snapshot: WorkspaceSnapshot
  ) {
    this.ws = new EditorWorkspace(snapshot);
    this.view = createEditor(el.editor);
    createToolbar(
      el.toolbar,
      {
        onNew: (kind) => this.newDocument(kind),
        onOpen: () => void this.run("Abrir", () => this.openFile()),
        onOpenFolder: () => void this.run("Abrir carpeta", () => this.openFolder()),
        onSave: () => void this.run("Guardar", () => this.save()),
        onExportSvg: () =>
          void this.run("Exportar SVG", async () => {
            const svg = this.exportable();
            if (svg) exportSvg(svg);
          }),
        onExportPng: () =>
          void this.run("Exportar PNG", async () => {
            const svg = this.exportable();
            if (svg) await exportPng(svg);
          }),
        onLoadExample: (id) => this.loadExample(id),
        onToggleExpand: () => void document.body.classList.toggle("flo-expanded"),
        onToggleMap: () => this.toggleMap(),
        onToggleGraph: () => this.toggleGraph(),
      },
      EXAMPLES
    );
    el.preview.addEventListener("click", (event) => this.onPreviewClick(event.target as Element));
    el.preview.addEventListener("change", (event) => this.onPreviewChange(event.target as Element));
    el.preview.addEventListener("input", (event) => this.onPreviewInput(event.target as Element));
    el.panel.addEventListener("click", (event) => this.onPanelClick(event.target as Element));
    bindExplorer(el.explorer, {
      onOpenDocument: (uri) => this.openDocument(uri),
      onSelectBlock: (id) => this.selectBlock(id),
      onSelectEntity: (id) => this.selectEntity(id),
      onFilter: (filter) => {
        this.filter = filter;
        this.renderExplorer();
      },
    });
    this.openDocument(this.ws.active);
  }

  private async run(action: string, task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      reportActionError(action, error);
    }
  }

  /** Reemplaza el workspace entero (abrir carpeta o archivo, nuevo sin carpeta, ejemplo). */
  load(snapshot: WorkspaceSnapshot, fileHandle: FileSystemFileHandle | null = null): void {
    this.ws = new EditorWorkspace(snapshot);
    this.fileHandle = fileHandle;
    this.states.clear();
    this.shown = null;
    this.selectedBlock = null;
    this.highlight = null;
    this.panel = null;
    this.mode = "document";
    this.graph = DEFAULT_GRAPH;
    this.presets = null;
    clearTimeout(this.searchTimer);
    this.openDocument(this.ws.active);
  }

  openDocument(uri: DocumentUri): void {
    this.ws.active = uri;
    this.previewState = { lastDiagrams: [] };
    if (this.shown !== null) this.states.set(this.shown, this.view.state);
    this.shown = uri;
    showDocument(this.view, this.host, uri, this.states.get(uri));
    this.refresh();
  }

  /** Todo lo que depende del link, desde un link nuevo; y el borrador. */
  refresh(): void {
    const link = this.ws.link();
    if (this.mode === "map") {
      this.el.preview.innerHTML = mapHtml(renderMap(link));
      addEdgeHitAreas(this.el.preview);
    } else if (this.mode === "graph") {
      this.renderGraph(link);
    } else {
      const uri = this.ws.active;
      const result = renderActive(link, uri);
      this.previewState = nextPreviewState(this.previewState, result);
      this.el.preview.innerHTML = previewHtml(this.previewState, result, uri);
      enhanceSequencePreview(this.el.preview);
      this.markSelection();
    }
    this.el.toolbar.querySelector("#flo-toggle-map")?.setAttribute("aria-pressed", String(this.mode === "map"));
    this.el.toolbar.querySelector("#flo-toggle-graph")?.setAttribute("aria-pressed", String(this.mode === "graph"));
    this.renderPanel();
    this.renderExplorer();
    // ponytail: sin IndexedDB (modo privado) el editor sigue, solo sin borrador.
    saveDraft(this.ws.snapshot()).catch(() => {});
  }

  /** Alterna el preview entre el documento activo y el mapa agregado del workspace (spec §8, #40). */
  toggleMap(): void {
    this.mode = this.mode === "map" ? "document" : "map";
    this.refresh();
  }

  /** Alterna el preview entre el documento activo y la vista de grafo (spec de conocimiento §7, #45). */
  toggleGraph(): void {
    if (this.mode === "graph") {
      this.mode = "document";
      this.refresh();
    } else {
      this.showGraph(this.graph);
    }
  }

  private showGraph(graph: GraphQuery): void {
    this.mode = "graph";
    this.graph = graph;
    this.refresh();
    if (this.presets === null) void this.run("Leer vistas", () => this.loadPresets());
  }

  /** Las vistas de `.flo/views` (#46); sin permiso de lectura, ninguna. */
  private async loadPresets(): Promise<void> {
    const ws = this.ws;
    if (!ws.dir) return;
    const presets = (await ensurePermission(ws.dir, "read")) ? await listPresets(ws.dir) : [];
    if (this.ws !== ws) return;
    this.presets = presets;
    if (this.mode === "graph") this.refresh();
  }

  private async savePreset(): Promise<void> {
    const ws = this.ws;
    if (!ws.dir) return;
    const answer = window.prompt("Nombre de la vista:");
    if (answer === null) return;
    const name = answer.trim();
    if (!isPresetName(name)) {
      window.alert("El nombre de una vista solo puede tener letras, números, '-' y '_'.");
      return;
    }
    const presets = this.presets ?? [];
    if (presets.some((preset) => preset.name === name) && !window.confirm(`Ya existe la vista '${name}'. ¿Reemplazarla?`)) return;
    if (!(await ensurePermission(ws.dir, "readwrite"))) throw new Error("sin permiso de escritura en la carpeta");
    const preset: Preset = { name, ...this.graph };
    await savePreset(ws.dir, preset);
    if (this.ws !== ws) return;
    this.presets = [...presets.filter((other) => other.name !== name), preset].sort(byName);
    this.refresh();
  }

  private renderGraph(link: LinkResult): void {
    // Un re-render con la búsqueda enfocada la vuelve a enfocar con su texto (#48).
    const active = document.activeElement;
    const typing =
      active instanceof HTMLInputElement && active.getAttribute("data-flo-kg") === "text" && this.el.preview.contains(active)
        ? { value: active.value, start: active.selectionStart, end: active.selectionEnd }
        : null;
    const { where, from, depth, viewBox } = this.graph;
    const result = query(link, { where, from: from ?? undefined, depth });
    this.el.preview.innerHTML =
      `<div class="flo-kg-bar">${graphBarHtml(link, tagCatalog(link), this.graph, this.presets?.map((preset) => preset.name) ?? null)}</div>` +
      graphHtml(renderKnowledge(link, result), result.nodes.length === 0);
    if (typing) {
      const input = this.el.preview.querySelector<HTMLInputElement>('[data-flo-kg="text"]');
      if (input) {
        input.value = typing.value;
        input.focus();
        input.setSelectionRange(typing.start, typing.end);
      }
    }
    const svg = this.el.preview.querySelector<SVGSVGElement>(".flo-kg svg");
    if (!svg) return;
    if (viewBox) svg.setAttribute("viewBox", viewBox.join(" "));
    // Las aristas a un bloque se clickean (drill-down): franja ancha como en el mapa.
    addEdgeHitAreas(this.el.preview);
    bindPanZoom(svg, (next) => (this.graph = { ...this.graph, viewBox: next }));
  }

  private onPreviewChange(target: Element): void {
    if (this.mode !== "graph" || !target.hasAttribute("data-flo-kg")) return;
    if (target.getAttribute("data-flo-kg") === "preset") {
      const preset = this.presets?.find((candidate) => candidate.name === (target as HTMLSelectElement).value);
      if (preset) {
        const { name: _name, ...graph } = preset;
        this.graph = graph;
        this.refresh();
      }
      return;
    }
    this.applyBar();
  }

  /** La búsqueda aplica mientras se escribe, con debounce (#48); los selects, en `change`. */
  private onPreviewInput(target: Element): void {
    if (this.mode !== "graph" || target.getAttribute("data-flo-kg") !== "text") return;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyBar(), SEARCH_DEBOUNCE_MS);
  }

  /** Lleva la barra a la consulta; si no cambia nada, no re-renderiza (un click en curso sobrevive, #48). */
  private applyBar(): void {
    clearTimeout(this.searchTimer);
    if (this.mode !== "graph") return;
    const { filter, depth } = readBar(this.el.preview);
    const next: GraphQuery = { where: whereOf(filter), from: this.graph.from, depth, viewBox: null };
    const key = (graph: GraphQuery) => JSON.stringify([graph.where, graph.from, graph.depth]);
    if (key(next) === key(this.graph)) return;
    this.graph = next;
    this.refresh();
  }

  private onGraphClick(target: Element): void {
    if (target.closest("[data-flo-kg-save]")) {
      void this.run("Guardar vista", () => this.savePreset());
      return;
    }
    if (target.closest("[data-flo-kg-clear-from]")) {
      this.graph = { ...this.graph, from: null, viewBox: null };
      this.refresh();
      return;
    }
    const block = target.closest("[data-flo-block]");
    if (block) {
      this.selectBlock(block.getAttribute("data-flo-block")!, block.getAttribute("data-flo-from"));
      return;
    }
    const node = target.closest("[data-flo-entity]");
    if (!node) return;
    const id = node.getAttribute("data-flo-entity")!;
    const link = this.ws.link();
    if (!link.entities.get(id)?.knowledge) {
      this.selectEntity(id);
      return;
    }
    const location = link.xref.definitionOf(id);
    if (location) this.reveal(location);
  }

  private confirmDiscard(): boolean {
    return !this.ws.hasUnsavedChanges() || window.confirm("Hay cambios sin guardar. ¿Descartarlos?");
  }

  /** Con carpeta abierta agrega un archivo al workspace; sin carpeta lo reemplaza. */
  newDocument(kind: DiagramKind): void {
    if (!this.ws.dir) {
      if (this.confirmDiscard()) this.load(newWorkspace(kind));
      return;
    }
    let uri = "nuevo.flo";
    for (let n = 2; this.ws.uris().includes(uri); n++) uri = `nuevo-${n}.flo`;
    this.ws.setSource(uri, NEW_SOURCE[kind]);
    this.openDocument(uri);
  }

  async openFile(): Promise<void> {
    const opened = await openFloFile();
    if (!opened || !this.confirmDiscard()) return;
    const { name, source, handle } = opened;
    this.load({ files: { [name]: source }, saved: { [name]: source }, active: name, dir: null }, handle);
  }

  async openFolder(): Promise<void> {
    const snapshot = await openFolder();
    if (!snapshot) return;
    if (Object.keys(snapshot.files).length === 0) {
      window.alert("La carpeta no tiene archivos .flo ni .md.");
      return;
    }
    if (this.confirmDiscard()) this.load(snapshot);
  }

  /** Decisión #38: con carpeta, todos los modificados y sin validar; sin carpeta, el activo. */
  async save(): Promise<void> {
    // El workspace puede reemplazarse durante los await: se guarda el que había al empezar.
    const ws = this.ws;
    const { dir } = ws;
    if (dir) {
      if (!(await ensurePermission(dir, "readwrite"))) throw new Error("sin permiso de escritura en la carpeta");
      for (const uri of ws.uris()) {
        if (!ws.isDirty(uri)) continue;
        await writeWorkspaceFile(dir, uri, ws.source(uri));
        ws.markSaved(uri);
      }
    } else {
      const uri = ws.active;
      const handle = await saveFloFile(ws.source(uri), this.fileHandle, uri);
      if (handle) {
        if (this.ws === ws) this.fileHandle = handle;
        ws.markSaved(uri);
      }
    }
    this.refresh();
  }

  loadExample(id: string): void {
    const example = EXAMPLES.find((candidate) => candidate.id === id);
    if (!example || !this.confirmDiscard()) return;
    const uri = `${id}.flo`;
    this.load({ files: { [uri]: example.source }, saved: {}, active: uri, dir: null });
  }

  private onPreviewClick(target: Element): void {
    if (this.mode === "graph") return this.onGraphClick(target);
    const edge = target.closest("[data-flo-from]");
    if (this.mode === "map" && edge) {
      this.panel = { kind: "edge", from: edge.getAttribute("data-flo-from")!, to: edge.getAttribute("data-flo-to")! };
      this.renderPanel();
      return;
    }
    const section = target.closest("section[data-flo-block]");
    if (section && target.closest(".flo-block-title")) {
      this.selectBlock(section.getAttribute("data-flo-block")!);
      return;
    }
    const node = target.closest("[data-flo-entity]");
    if (!node || node.classList.contains("flo-unresolved")) return;
    const id = node.getAttribute("data-flo-entity")!;
    // Una nota vuelve a la vista de grafo centrada en ella (spec de conocimiento §7).
    if (this.ws.link().entities.get(id)?.knowledge) {
      this.showGraph({ ...DEFAULT_GRAPH, from: [id], depth: this.graph.depth });
    } else {
      this.selectEntity(id);
    }
  }

  private onPanelClick(target: Element): void {
    const button = target.closest("button");
    const panel = this.panel;
    if (!button || !panel) return;
    const block = button.getAttribute("data-flo-block");
    if (block !== null) {
      this.selectBlock(block, panel.kind === "entity" ? panel.id : null);
    } else if (panel.kind === "entity" && button.hasAttribute("data-flo-definition")) {
      const location = this.ws.link().xref.definitionOf(panel.id);
      if (location) this.reveal(location);
    } else if (panel.kind === "entity" && button.hasAttribute("data-flo-rename")) {
      this.rename(panel.id);
    }
  }

  selectEntity(id: EntityId): void {
    this.panel = { kind: "entity", id };
    this.renderPanel();
  }

  private renderPanel(): void {
    const link = this.ws.link();
    const panel = this.panel;
    let html = "";
    if (panel?.kind === "entity" && link.entities.has(panel.id)) {
      html = entityPanelHtml(link, panel.id);
    } else if (panel?.kind === "edge") {
      const edge = query(link).edges.find((e) => e.type === "flow" && e.from === panel.from && e.to === panel.to);
      if (edge) html = edgePanelHtml(link, edge);
    }
    if (html === "") this.panel = null;
    this.el.panel.innerHTML = html;
  }

  private renderExplorer(): void {
    this.el.explorer.innerHTML = explorerHtml(this.ws, this.filter, this.selectedBlock);
  }

  /** Abre el documento del bloque y lo selecciona (es el que se exporta); con `entity`, resalta su nodo. */
  selectBlock(id: BlockId, entity: EntityId | null = null): void {
    this.mode = "document";
    // La arista del panel ya no está a la vista; el panel de una entidad sí sigue valiendo.
    if (this.panel?.kind === "edge") this.panel = null;
    this.selectedBlock = id;
    this.highlight = entity;
    const uri = id.slice(0, id.lastIndexOf("#"));
    if (uri === this.ws.active) this.refresh();
    else this.openDocument(uri);
    byData(this.el.preview, "section[data-flo-block]", "data-flo-block", id)[0]?.scrollIntoView?.({ block: "nearest" });
  }

  private markSelection(): void {
    if (!this.selectedBlock) return;
    const section = byData(this.el.preview, "section[data-flo-block]", "data-flo-block", this.selectedBlock)[0];
    if (!section) return;
    section.classList.add("flo-block-selected");
    if (this.highlight) {
      for (const node of byData(section, "[data-flo-entity]", "data-flo-entity", this.highlight)) node.classList.add("flo-selected");
    }
  }

  /** Abre el documento y selecciona el rango en el editor. */
  reveal(location: Location): void {
    if (location.uri !== this.ws.active) this.openDocument(location.uri);
    const source = this.ws.source(location.uri);
    this.view.dispatch({
      selection: { anchor: offsetAt(source, location.range.start), head: offsetAt(source, location.range.end) },
      scrollIntoView: true,
    });
    this.view.focus();
  }

  private entityAtCursor(position: Position): EntityId | null {
    const document = this.ws.link().documents.get(this.ws.active)?.document;
    return document ? entityAt(document, position) : null;
  }

  goToDefinition(position: Position): void {
    const id = this.entityAtCursor(position);
    const location = id === null ? null : this.ws.link().xref.definitionOf(id);
    if (location) this.reveal(location);
  }

  renameAt(position: Position): void {
    const id = this.entityAtCursor(position);
    if (id !== null) this.rename(id);
  }

  /** Decisión #39: el activo por el editor (queda en su historial), los demás en el workspace. */
  rename(id: EntityId): void {
    const answer = window.prompt(`Nuevo id para '${id}':`, id);
    if (answer === null) return;
    const newId = answer.trim();
    const result = renameEntity(this.ws.link(), id, newId);
    if ("error" in result) {
      window.alert(result.error);
      return;
    }
    for (const [uri, edits] of result.edits) {
      if (uri === this.ws.active) this.view.dispatch({ changes: toChanges(this.view.state.doc.toString(), edits) });
      else this.ws.setSource(uri, applyTextEdits(this.ws.source(uri), edits));
    }
    if (this.panel?.kind === "entity" && this.panel.id === id) this.panel = { kind: "entity", id: newId };
    this.refresh();
  }

  /** El SVG que exportan los botones: el bloque seleccionado si está en el preview; si no, el primero (#41). */
  private exportable(): string | undefined {
    if (this.mode === "map") return renderMap(this.ws.link()).svg;
    if (this.mode === "graph") {
      // Lo que se ve, con su viewBox (#45), sin las franjas de click.
      const svg = this.el.preview.querySelector(".flo-kg svg")?.cloneNode(true) as Element | undefined;
      svg?.querySelectorAll(".flo-map-hit").forEach((hit) => hit.remove());
      return svg?.outerHTML;
    }
    const diagrams = this.previewState.lastDiagrams;
    const selected = diagrams.find((diagram) => blockId(this.ws.active, diagram.name) === this.selectedBlock);
    return (selected ?? diagrams[0])?.svg;
  }
}
