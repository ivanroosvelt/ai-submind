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
  parseBlockId,
} from "@tejo/core";
import { createEditor, showDocument, type EditorHost } from "./editor.js";
import { edgePanelHtml, entityPanelHtml } from "./entity-panel.js";
import { bindExplorer, explorerHtml, type ExplorerFilter } from "./explorer.js";
import { DEFAULT_GRAPH, graphBarHtml, graphHtml, readBar, whereOf, type GraphQuery } from "./knowledge-view.js";
import { addEdgeHitAreas, mapHtml } from "./map-view.js";
import { bindPanZoom, centerViewBox, fitViewBox, parseViewBox, type ViewBox } from "./pan-zoom.js";
import { byName, isPresetName, listLocalPresets, listPresets, presetJson, presetUri, savePreset, type Preset } from "./presets.js";
import { nextPreviewState, previewHtml, renderActive, scopeMarkerIds, type PreviewState } from "./preview.js";
import { ask, confirmDialog, notify } from "./dialogs.js";
import { createToolbar, type DiagramKind } from "./toolbar.js";
import { openFloFile, saveFloFile } from "./file-io.js";
import { ensurePermission, openFolder, writeWorkspaceFile } from "./folder-io.js";
import { exportSvg, exportPng } from "./export.js";
import { readLocalFiles, writeLocalFile } from "./local-folder.js";
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

// Escala mínima con la que abre un lienzo (mapa, grafo): más chico no se lee.
const MIN_CANVAS_SCALE = 0.75;
// Escala con la que se centra una entidad elegida en el catálogo.
const FOCUS_SCALE = 1;

export function newWorkspace(kind: DiagramKind = "flowchart"): WorkspaceSnapshot {
  return { files: { "nuevo.flo": NEW_SOURCE[kind] }, saved: {}, active: "nuevo.flo", dir: null, local: false };
}

export interface AppElements {
  toolbar: HTMLElement;
  explorer: HTMLElement;
  editor: HTMLElement;
  preview: HTMLElement;
  panel: HTMLElement;
}

function reportActionError(action: string, error: unknown): void {
  console.error(`tejo: ${action} falló`, error);
  void notify(`No se pudo completar: ${action}. Revisa la consola para más detalle.`);
}

type PanelState = { kind: "entity"; id: EntityId } | { kind: "edge"; from: EntityId; to: EntityId } | null;

/** Una parada del historial del navegador: qué se está mirando, sin el texto. */
interface NavState {
  uri: DocumentUri;
  mode: "document" | "map" | "graph";
  graph: GraphQuery;
  panel: PanelState;
  selectedBlock: BlockId | null;
  highlight: EntityId | null;
}

function byData(root: ParentNode, selector: string, attribute: string, value: string): Element[] {
  return Array.from(root.querySelectorAll(selector)).filter((element) => element.getAttribute(attribute) === value);
}

/** El editor web: un workspace de documentos, el documento activo en el editor y su preview. */
export class App {
  ws: EditorWorkspace;
  readonly view: EditorView;
  selectedBlock: BlockId | null = null;
  private previewState: PreviewState = { lastDiagrams: [] };
  /** Sin carpeta, el handle de cada documento (#55): un uri nunca se guarda sobre el archivo de otro. */
  private readonly fileHandles = new Map<DocumentUri, FileSystemFileHandle>();
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
  /** Modo local (#66): los archivos ya avisados como cambiados en el disco mientras se editaban. */
  private readonly conflicts = new Set<DocumentUri>();
  /** El viewBox del lienzo del mapa; null = ajustado al contenido. */
  private mapViewBox: ViewBox | null = null;
  /** Entidad a centrar en el próximo render del lienzo (una sola vez). */
  private centerOn: EntityId | null = null;
  /** El debounce de la búsqueda de la barra del grafo (#48). */
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly host: EditorHost = {
    workspace: () => this.ws,
    onChange: () => this.refresh(),
    onGoToDefinition: (position) => this.goToDefinition(position),
    onRename: (position) => void this.renameAt(position),
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
        onNew: (kind) => void this.run("Nuevo", () => this.newDocument(kind)),
        onOpen: () => void this.run("Abrir", () => this.openFile()),
        onOpenFolder: () => void this.run("Abrir carpeta", () => this.openFolder()),
        onSave: () => void this.run("Guardar", () => this.save()),
        onExportSvg: () =>
          void this.run("Exportar SVG", async () => {
            const out = this.exportable();
            if (out) exportSvg(out.svg, out.name);
          }),
        onExportPng: () =>
          void this.run("Exportar PNG", async () => {
            const out = this.exportable();
            if (out) await exportPng(out.svg, out.name);
          }),
        onLoadExample: (id) => void this.run("Ejemplo", () => this.loadExample(id)),
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
      onSelectEntity: (id) => this.focusEntity(id),
      onFilter: (filter) => {
        this.filter = filter;
        this.renderExplorer();
      },
    });
    this.openDocument(this.ws.active);
  }

  private navState(): NavState {
    const { mode, graph, panel, selectedBlock, highlight } = this;
    return { uri: this.ws.active, mode, graph, panel, selectedBlock, highlight };
  }

  /**
   * Cada lugar nuevo es una entrada del historial del navegador: atrás y
   * adelante (botones, mouse, gesto) vuelven por las referencias seguidas.
   * Cambiar filtros o zoom del grafo reemplaza la entrada en vez de apilar.
   */
  private remember(): void {
    const state = this.navState();
    const previous = history.state as NavState | null;
    const place = (nav: NavState) =>
      JSON.stringify([nav.uri, nav.mode, nav.mode === "graph" ? nav.graph.from : null, nav.panel, nav.selectedBlock, nav.highlight]);
    try {
      if (previous?.uri === undefined || place(previous) === place(state)) {
        // Safari limita las llamadas por segundo: sin cambios, no se toca.
        if (JSON.stringify(previous) !== JSON.stringify(state)) history.replaceState(state, "");
      } else {
        history.pushState(state, "");
      }
    } catch {
      // ponytail: si el navegador rechaza la entrada, se navega igual, sin historial.
    }
  }

  /** `popstate`: vuelve a un lugar del historial; uno de otro workspace se ignora. */
  onPopState(state: NavState | null): void {
    if (!state?.uri || !this.ws.uris().includes(state.uri)) return;
    ({ mode: this.mode, graph: this.graph, panel: this.panel, selectedBlock: this.selectedBlock, highlight: this.highlight } = state);
    if (state.uri !== this.ws.active) this.openDocument(state.uri);
    else this.refresh();
  }

  /** Sigue una referencia de una nota: a otra nota se abre su documento; a una entidad, su panel; a un bloque, el bloque. */
  private follow(ref: Element): void {
    const block = ref.getAttribute("data-flo-ref-block");
    if (block !== null) return this.selectBlock(block);
    const id = ref.getAttribute("data-flo-ref-entity")!;
    const entity = this.ws.link().entities.get(id);
    if (!entity?.knowledge) return this.selectEntity(id);
    this.mode = "document";
    this.selectedBlock = null;
    this.highlight = null;
    if (entity.uri === this.ws.active) this.refresh();
    else this.openDocument(entity.uri);
    this.el.preview.scrollTop = 0;
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
    this.fileHandles.clear();
    if (fileHandle) this.fileHandles.set(this.ws.active, fileHandle);
    this.states.clear();
    this.conflicts.clear();
    this.shown = null;
    this.selectedBlock = null;
    this.highlight = null;
    this.panel = null;
    this.mode = "document";
    this.graph = DEFAULT_GRAPH;
    this.mapViewBox = null;
    this.centerOn = null;
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
    this.el.preview.classList.toggle("flo-canvas-mode", this.mode !== "document");
    if (this.mode === "map") {
      this.el.preview.innerHTML = mapHtml(renderMap(link));
      addEdgeHitAreas(this.el.preview);
      const svg = this.el.preview.querySelector<SVGSVGElement>(".flo-map svg");
      if (svg) this.canvas(svg, this.mapViewBox, (next) => (this.mapViewBox = next));
    } else if (this.mode === "graph") {
      this.renderGraph(link);
    } else {
      const uri = this.ws.active;
      const result = renderActive(link, uri);
      this.previewState = nextPreviewState(this.previewState, result);
      this.el.preview.innerHTML = previewHtml(this.previewState, result, uri, link);
      enhanceSequencePreview(this.el.preview);
      this.markSelection();
    }
    scopeMarkerIds(this.el.preview);
    this.el.toolbar.querySelector("#flo-toggle-map")?.setAttribute("aria-pressed", String(this.mode === "map"));
    this.el.toolbar.querySelector("#flo-toggle-graph")?.setAttribute("aria-pressed", String(this.mode === "graph"));
    this.renderPanel();
    this.renderExplorer();
    // ponytail: sin IndexedDB (modo privado) el editor sigue, solo sin borrador.
    if (!this.ws.local) saveDraft(this.ws.snapshot()).catch(() => {});
    this.remember();
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
    if (!ws.hasFolder()) return;
    const presets = ws.local
      ? await listLocalPresets()
      : (await ensurePermission(ws.dir!, "read"))
        ? await listPresets(ws.dir!)
        : [];
    if (this.ws !== ws) return;
    this.presets = presets;
    if (this.mode === "graph") this.refresh();
  }

  private async savePreset(): Promise<void> {
    const ws = this.ws;
    if (!ws.hasFolder()) return;
    const answer = await ask("Nombre de la vista:");
    if (answer === null) return;
    const name = answer.trim();
    if (!isPresetName(name)) {
      await notify("El nombre de una vista solo puede tener letras, números, '-' y '_'.");
      return;
    }
    const presets = this.presets ?? [];
    if (presets.some((preset) => preset.name === name) && !(await confirmDialog(`Ya existe la vista '${name}'. ¿Reemplazarla?`))) return;
    const preset: Preset = { name, ...this.graph };
    if (ws.local) {
      await writeLocalFile(presetUri(name), presetJson(preset));
    } else {
      if (!(await ensurePermission(ws.dir!, "readwrite"))) throw new Error("sin permiso de escritura en la carpeta");
      await savePreset(ws.dir!, preset);
    }
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
    // Las aristas a un bloque se clickean (drill-down): franja ancha como en el mapa.
    addEdgeHitAreas(this.el.preview);
    this.canvas(svg, viewBox, (next) => (this.graph = { ...this.graph, viewBox: next }));
  }

  /**
   * Un SVG de mapa o grafo como lienzo: ocupa todo el panel, abre ajustado
   * al contenido (sin bajar de una escala legible) y se recorre con rueda y
   * arrastre. La entidad resaltada se marca y, si se pidió, se centra.
   */
  private canvas(svg: SVGSVGElement, stored: ViewBox | null, save: (viewBox: ViewBox) => void): void {
    const content = parseViewBox(svg.getAttribute("viewBox"));
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    if (content) svg.dataset.floContent = content.join(" ");
    const box = svg.getBoundingClientRect();
    let viewBox = stored ?? (content ? fitViewBox(content, box, MIN_CANVAS_SCALE) : null);
    const targets = this.highlight ? byData(svg, "[data-flo-entity]", "data-flo-entity", this.highlight) : [];
    for (const node of targets) node.classList.add("flo-selected");
    const target = targets[0] as SVGGraphicsElement | undefined;
    if (this.centerOn !== null && this.centerOn === this.highlight && target?.getBBox && viewBox && box.width > 0) {
      const { x, y, width, height } = target.getBBox();
      const scale = Math.max(box.width / viewBox[2], FOCUS_SCALE);
      viewBox = centerViewBox([0, 0, box.width / scale, box.height / scale], x + width / 2, y + height / 2);
      save(viewBox);
    }
    this.centerOn = null;
    if (viewBox) svg.setAttribute("viewBox", viewBox.join(" "));
    bindPanZoom(svg, save);
  }

  /** "Ajustar": el lienzo vuelve a mostrar todo el contenido. */
  private fitCanvas(): void {
    const svg = this.el.preview.querySelector<SVGSVGElement>(".flo-map svg, .flo-kg svg");
    const content = parseViewBox(svg?.dataset.floContent ?? null);
    if (!svg || !content) return;
    const viewBox = fitViewBox(content, svg.getBoundingClientRect());
    svg.setAttribute("viewBox", viewBox.join(" "));
    if (this.mode === "map") this.mapViewBox = viewBox;
    else this.graph = { ...this.graph, viewBox };
  }

  /**
   * Elegir una entidad en el catálogo la muestra en la vista activa: en el
   * mapa o el grafo se resalta y se centra (si no está en el mapa, se pasa al
   * grafo centrado en ella); en el documento, se abre su nota o su flujo.
   */
  focusEntity(id: EntityId): void {
    const link = this.ws.link();
    const entity = link.entities.get(id);
    if (!entity) return;
    this.panel = { kind: "entity", id };
    this.highlight = id;
    this.centerOn = id;
    if (this.mode === "map" && !renderMap(link).edges.some((edge) => edge.from === id || edge.to === id)) {
      this.mode = "graph";
    }
    if (this.mode === "graph") {
      const { where, from, depth } = this.graph;
      const shown = query(link, { where, from: from ?? undefined, depth }).nodes.some((node) => node.id === id);
      // Las semillas se intersecan con el filtro: el de la barra la escondía, se suelta.
      // `{ and: [] }` acepta toda entidad; `{ text: "" }` solo las notas (#31).
      const seed = entity.knowledge ? DEFAULT_GRAPH.where : { and: [] };
      if (!shown) this.graph = { where: seed, from: [id], depth: Math.max(depth, 1), viewBox: null };
      this.showGraph(this.graph);
      return;
    }
    if (this.mode === "map") return this.refresh();
    if (entity.knowledge) {
      this.selectedBlock = null;
      if (entity.uri === this.ws.active) this.refresh();
      else this.openDocument(entity.uri);
      return;
    }
    const block = link.xref.flowsUsing(id)[0];
    if (block) this.selectBlock(block, id);
    else this.refresh();
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
    if (target.closest("[data-flo-fit]")) return this.fitCanvas();
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
    // Sin editor a la vista (lienzo ampliado), una nota re-centra el grafo en ella.
    if (document.body.classList.contains("flo-expanded") || document.body.classList.contains("flo-hide-editor")) {
      this.panel = { kind: "entity", id };
      this.highlight = id;
      this.centerOn = id;
      this.graph = { ...this.graph, from: [id], viewBox: null };
      this.refresh();
      return;
    }
    const location = link.xref.definitionOf(id);
    if (location) this.reveal(location);
  }

  private async confirmDiscard(): Promise<boolean> {
    return !this.ws.hasUnsavedChanges() || (await confirmDialog("Hay cambios sin guardar. ¿Descartarlos?"));
  }

  /** Con carpeta abierta agrega un archivo al workspace; sin carpeta lo reemplaza. */
  async newDocument(kind: DiagramKind): Promise<void> {
    if (!this.ws.hasFolder()) {
      if (await this.confirmDiscard()) this.load(newWorkspace(kind));
      return;
    }
    let uri = "nuevo.flo";
    for (let n = 2; this.ws.uris().includes(uri); n++) uri = `nuevo-${n}.flo`;
    this.ws.setSource(uri, NEW_SOURCE[kind]);
    this.openDocument(uri);
  }

  async openFile(): Promise<void> {
    const opened = await openFloFile();
    if (!opened || !(await this.confirmDiscard())) return;
    const { name, source, handle } = opened;
    this.load({ files: { [name]: source }, saved: { [name]: source }, active: name, dir: null, local: false }, handle);
  }

  async openFolder(): Promise<void> {
    const snapshot = await openFolder();
    if (!snapshot) return;
    if (Object.keys(snapshot.files).length === 0) {
      await notify("La carpeta no tiene archivos .flo ni .md.");
      return;
    }
    if (await this.confirmDiscard()) this.load(snapshot);
  }

  /** Decisión #38: con carpeta, todos los modificados y sin validar; sin carpeta, el activo. */
  async save(): Promise<void> {
    // El workspace puede reemplazarse durante los await: se guarda el que había al empezar.
    const ws = this.ws;
    const { dir } = ws;
    if (ws.local) {
      for (const uri of ws.uris()) {
        if (!ws.isDirty(uri)) continue;
        const source = ws.source(uri);
        await writeLocalFile(uri, source);
        ws.markSaved(uri, source);
        this.conflicts.delete(uri);
      }
    } else if (dir) {
      if (!(await ensurePermission(dir, "readwrite"))) throw new Error("sin permiso de escritura en la carpeta");
      for (const uri of ws.uris()) {
        if (!ws.isDirty(uri)) continue;
        const source = ws.source(uri);
        await writeWorkspaceFile(dir, uri, source);
        ws.markSaved(uri, source);
      }
    } else {
      const uri = ws.active;
      const source = ws.source(uri);
      const handle = await saveFloFile(source, this.fileHandles.get(uri) ?? null, uri);
      if (handle) {
        if (this.ws === ws) this.fileHandles.set(uri, handle);
        ws.markSaved(uri, source);
      }
    }
    this.refresh();
  }

  /** Cambio en el disco con `tejo view` (#66): lo limpio sigue al disco; lo modificado se conserva con un aviso. */
  async syncLocal(): Promise<void> {
    const ws = this.ws;
    if (!ws.local) return;
    const files = await readLocalFiles();
    if (this.ws !== ws) return;
    // Lo vuelto a lo del disco sin guardar también deja de estar en conflicto: el próximo se vuelve a avisar.
    for (const uri of this.conflicts) if (!ws.isDirty(uri)) this.conflicts.delete(uri);
    const { changed, conflicts } = ws.applyDisk(files);
    for (const uri of changed) this.states.delete(uri);
    if (changed.length > 0) {
      if (this.shown !== null && changed.includes(this.shown)) this.shown = null;
      this.openDocument(ws.active);
    }
    for (const uri of conflicts) {
      if (this.conflicts.has(uri)) continue;
      this.conflicts.add(uri);
      await notify(`'${uri}' cambió en el disco mientras lo editabas. Se conserva tu versión; si guardas, reemplaza la del disco.`);
    }
  }

  /** Ctrl/Cmd+S guarda en toda la página (#56); sin Alt, que con AltGr escribe caracteres. */
  onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "s") return;
    event.preventDefault();
    // Mantener la tecla repite el evento: no abrir un segundo selector de guardado.
    if (event.repeat) return;
    void this.run("Guardar", () => this.save());
  }

  /** Cerrar o recargar la pestaña avisa si hay cambios que se perderían (#56, criterio de #43). */
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.ws.hasUnsavedChanges()) return;
    event.preventDefault();
    // Safari todavía pide `returnValue` además de preventDefault.
    event.returnValue = "";
  }

  async loadExample(id: string): Promise<void> {
    const example = EXAMPLES.find((candidate) => candidate.id === id);
    if (!example || !(await this.confirmDiscard())) return;
    this.load({ files: example.files, saved: {}, active: example.active, dir: null, local: false });
  }

  private onPreviewClick(target: Element): void {
    if (this.mode === "graph") return this.onGraphClick(target);
    if (target.closest("[data-flo-fit]")) return this.fitCanvas();
    const edge = target.closest("[data-flo-from]");
    if (this.mode === "map" && edge) {
      this.panel = { kind: "edge", from: edge.getAttribute("data-flo-from")!, to: edge.getAttribute("data-flo-to")! };
      this.renderPanel();
      return;
    }
    const ref = target.closest("[data-flo-ref-entity], [data-flo-ref-block]");
    if (ref) return this.follow(ref);
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
      void this.rename(panel.id);
    }
  }

  selectEntity(id: EntityId): void {
    this.panel = { kind: "entity", id };
    this.renderPanel();
    this.remember();
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
    const entity = this.panel?.kind === "entity" ? this.panel.id : null;
    this.el.explorer.innerHTML = explorerHtml(this.ws, this.filter, this.selectedBlock, entity);
  }

  /** Abre el documento del bloque y lo selecciona (es el que se exporta); con `entity`, resalta su nodo. */
  selectBlock(id: BlockId, entity: EntityId | null = null): void {
    this.mode = "document";
    // La arista del panel ya no está a la vista; el panel de una entidad sí sigue valiendo.
    if (this.panel?.kind === "edge") this.panel = null;
    this.selectedBlock = id;
    this.highlight = entity;
    const { uri } = parseBlockId(id);
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

  renameAt(position: Position): Promise<void> {
    const id = this.entityAtCursor(position);
    return id === null ? Promise.resolve() : this.rename(id);
  }

  /** Decisión #39: el activo por el editor (queda en su historial), los demás en el workspace. */
  async rename(id: EntityId): Promise<void> {
    const answer = await ask(`Nuevo id para '${id}':`, id);
    if (answer === null) return;
    const newId = answer.trim();
    const result = renameEntity(this.ws.link(), id, newId);
    if ("error" in result) {
      await notify(result.error);
      return;
    }
    for (const [uri, edits] of result.edits) {
      if (uri === this.ws.active) this.view.dispatch({ changes: toChanges(this.view.state.doc.toString(), edits) });
      else this.ws.setSource(uri, applyTextEdits(this.ws.source(uri), edits));
    }
    if (this.panel?.kind === "entity" && this.panel.id === id) this.panel = { kind: "entity", id: newId };
    this.refresh();
  }

  /** Lo que exportan los botones (#41, #57): el SVG y el nombre del archivo, sin extensión. */
  private exportable(): { svg: string; name: string } | undefined {
    if (this.mode === "map") return { svg: renderMap(this.ws.link()).svg, name: "mapa" };
    if (this.mode === "graph") {
      // Lo que se ve, con su viewBox (#45), sin las franjas de click.
      const svg = this.el.preview.querySelector(".flo-kg svg")?.cloneNode(true) as Element | undefined;
      svg?.querySelectorAll(".flo-map-hit").forEach((hit) => hit.remove());
      return svg ? { svg: svg.outerHTML, name: "grafo" } : undefined;
    }
    const diagrams = this.previewState.lastDiagrams;
    const diagram = diagrams.find((d) => blockId(this.ws.active, d.name) === this.selectedBlock) ?? diagrams[0];
    return diagram ? { svg: diagram.svg, name: diagram.name } : undefined;
  }
}
