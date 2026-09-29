import type { EditorView } from "@codemirror/view";
import { blockId, type BlockId, type DocumentUri, type EntityId, type Location } from "@flo/core";
import { createEditor, showDocument, type EditorHost } from "./editor.js";
import { entityPanelHtml } from "./entity-panel.js";
import { bindExplorer, explorerHtml, type ExplorerFilter } from "./explorer.js";
import { nextPreviewState, previewHtml, renderActive, type PreviewState } from "./preview.js";
import { createToolbar, type DiagramKind } from "./toolbar.js";
import { openFloFile, saveFloFile } from "./file-io.js";
import { ensureWritable, openFolder, writeWorkspaceFile } from "./folder-io.js";
import { exportSvg, exportPng } from "./export.js";
import { saveDraft } from "./storage.js";
import { EXAMPLES } from "./examples.js";
import { enhanceSequencePreview } from "./sequence-view.js";
import { offsetAt } from "./text-edits.js";
import { EditorWorkspace, type WorkspaceSnapshot } from "./workspace.js";

const NEW_SOURCE: Record<DiagramKind, string> = {
  flowchart: ["flow nuevo {", "", "}", ""].join("\n"),
  sequence: ["sequence nuevo {", "", "}", ""].join("\n"),
};

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

type PanelState = { kind: "entity"; id: EntityId } | null;

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
  private highlight: EntityId | null = null;
  private filter: ExplorerFilter = { type: null, tag: null };
  private readonly host: EditorHost = {
    workspace: () => this.ws,
    onChange: () => this.refresh(),
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
      },
      EXAMPLES
    );
    el.preview.addEventListener("click", (event) => this.onPreviewClick(event.target as Element));
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
    this.openDocument(this.ws.active);
  }

  openDocument(uri: DocumentUri): void {
    this.ws.active = uri;
    this.previewState = { lastDiagrams: [] };
    showDocument(this.view, this.host, uri);
    this.refresh();
  }

  /** Todo lo que depende del link, desde un link nuevo; y el borrador. */
  refresh(): void {
    const uri = this.ws.active;
    const result = renderActive(this.ws.link(), uri);
    this.previewState = nextPreviewState(this.previewState, result);
    this.el.preview.innerHTML = previewHtml(this.previewState, result, uri);
    enhanceSequencePreview(this.el.preview);
    this.markSelection();
    this.renderPanel();
    this.renderExplorer();
    // ponytail: sin IndexedDB (modo privado) el editor sigue, solo sin borrador.
    saveDraft(this.ws.snapshot()).catch(() => {});
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
    const { dir } = this.ws;
    if (dir) {
      if (!(await ensureWritable(dir))) throw new Error("sin permiso de escritura en la carpeta");
      for (const uri of this.ws.uris()) {
        if (!this.ws.isDirty(uri)) continue;
        await writeWorkspaceFile(dir, uri, this.ws.source(uri));
        this.ws.markSaved(uri);
      }
    } else {
      const uri = this.ws.active;
      const handle = await saveFloFile(this.ws.source(uri), this.fileHandle, uri);
      if (handle) {
        this.fileHandle = handle;
        this.ws.markSaved(uri);
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
    const section = target.closest("section[data-flo-block]");
    if (section && target.closest(".flo-block-title")) {
      this.selectBlock(section.getAttribute("data-flo-block")!);
      return;
    }
    const node = target.closest("[data-flo-entity]");
    if (node && !node.classList.contains("flo-unresolved")) this.selectEntity(node.getAttribute("data-flo-entity")!);
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
    }
  }

  selectEntity(id: EntityId): void {
    this.panel = { kind: "entity", id };
    this.renderPanel();
  }

  private renderPanel(): void {
    const link = this.ws.link();
    if (this.panel?.kind === "entity" && !link.entities.has(this.panel.id)) this.panel = null;
    this.el.panel.innerHTML = this.panel ? entityPanelHtml(link, this.panel.id) : "";
  }

  private renderExplorer(): void {
    this.el.explorer.innerHTML = explorerHtml(this.ws, this.filter, this.selectedBlock);
  }

  /** Abre el documento del bloque y lo selecciona (es el que se exporta); con `entity`, resalta su nodo. */
  selectBlock(id: BlockId, entity: EntityId | null = null): void {
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

  /** El SVG que exportan los botones: el bloque seleccionado si está en el preview; si no, el primero (#41). */
  private exportable(): string | undefined {
    const diagrams = this.previewState.lastDiagrams;
    const selected = diagrams.find((diagram) => blockId(this.ws.active, diagram.name) === this.selectedBlock);
    return (selected ?? diagrams[0])?.svg;
  }
}
