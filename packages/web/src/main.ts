import { createEditor, getEditorSource, setEditorSource } from "./editor.js";
import { nextPreviewState, previewHtml, type PreviewState } from "./preview.js";
import { createToolbar, type DiagramKind } from "./toolbar.js";
import { openFloFile, saveFloFile } from "./file-io.js";
import { exportSvg, exportPng } from "./export.js";
import { loadDraft, saveDraft } from "./storage.js";
import { EXAMPLES } from "./examples.js";
import { enhanceSequencePreview } from "./sequence-view.js";

const NEW_SOURCE: Record<DiagramKind, string> = {
  flowchart: ["flow nuevo {", "", "}", ""].join("\n"),
  sequence: ["sequence nuevo {", "", "}", ""].join("\n"),
};

function reportActionError(action: string, error: unknown): void {
  console.error(`flo: ${action} falló`, error);
  window.alert(`No se pudo completar: ${action}. Revisá la consola para más detalle.`);
}

async function main(): Promise<void> {
  const editorPane = document.querySelector<HTMLDivElement>("#editor-pane");
  const previewPane = document.querySelector<HTMLDivElement>("#preview-pane");
  const toolbarPane = document.querySelector<HTMLDivElement>("#toolbar");
  if (!editorPane || !previewPane || !toolbarPane) return;

  const draft = await loadDraft().catch(() => null);
  const initialSource = draft ?? NEW_SOURCE.flowchart;

  let previewState: PreviewState = { lastDiagrams: [] };
  let fileHandle: FileSystemFileHandle | null = null;
  let fileName = "diagrama.flo";

  const view = createEditor(editorPane, initialSource, (result, source) => {
    previewState = nextPreviewState(previewState, result);
    previewPane.innerHTML = previewHtml(previewState, result);
    enhanceSequencePreview(previewPane);
    void saveDraft(source);
  });

  createToolbar(toolbarPane, {
    onNew(kind) {
      fileHandle = null;
      fileName = "diagrama.flo";
      setEditorSource(view, NEW_SOURCE[kind]);
    },
    async onOpen() {
      try {
        const opened = await openFloFile();
        if (!opened) return;
        fileHandle = opened.handle;
        fileName = opened.name;
        setEditorSource(view, opened.source);
      } catch (error) {
        reportActionError("Abrir", error);
      }
    },
    async onSave() {
      try {
        fileHandle = await saveFloFile(getEditorSource(view), fileHandle, fileName);
      } catch (error) {
        reportActionError("Guardar", error);
      }
    },
    onExportSvg() {
      try {
        // ponytail: exporta el primer bloque; elegir cuál llega con el explorador (Fase F).
        const svg = previewState.lastDiagrams[0]?.svg;
        if (svg) exportSvg(svg);
      } catch (error) {
        reportActionError("Exportar SVG", error);
      }
    },
    async onExportPng() {
      try {
        const svg = previewState.lastDiagrams[0]?.svg;
        if (svg) await exportPng(svg);
      } catch (error) {
        reportActionError("Exportar PNG", error);
      }
    },
    onLoadExample(id) {
      const example = EXAMPLES.find((candidate) => candidate.id === id);
      if (!example) return;
      fileHandle = null;
      fileName = "diagrama.flo";
      setEditorSource(view, example.source);
    },
    onToggleExpand() {
      document.body.classList.toggle("flo-expanded");
    },
  }, EXAMPLES);
}

void main();
