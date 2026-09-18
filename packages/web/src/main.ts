import { createEditor, getEditorSource, setEditorSource } from "./editor.js";
import { nextPreviewState, previewHtml, type PreviewState } from "./preview.js";
import { createToolbar, type DiagramKind } from "./toolbar.js";
import { openFloFile, saveFloFile } from "./file-io.js";
import { exportSvg, exportPng } from "./export.js";
import { loadDraft, saveDraft } from "./storage.js";

const NEW_SOURCE: Record<DiagramKind, string> = {
  flowchart: ["diagram flowchart", "", ""].join("\n"),
  sequence: ["diagram sequence", "", ""].join("\n"),
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

  let previewState: PreviewState = { lastSvg: null };
  let fileHandle: FileSystemFileHandle | null = null;
  let fileName = "diagrama.flo";

  const view = createEditor(editorPane, initialSource, (result, source) => {
    previewState = nextPreviewState(previewState, result);
    previewPane.innerHTML = previewHtml(previewState, result);
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
        if (previewState.lastSvg) exportSvg(previewState.lastSvg);
      } catch (error) {
        reportActionError("Exportar SVG", error);
      }
    },
    async onExportPng() {
      try {
        if (previewState.lastSvg) await exportPng(previewState.lastSvg);
      } catch (error) {
        reportActionError("Exportar PNG", error);
      }
    },
  });
}

void main();
