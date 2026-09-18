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

async function main(): Promise<void> {
  const editorPane = document.querySelector<HTMLDivElement>("#editor-pane");
  const previewPane = document.querySelector<HTMLDivElement>("#preview-pane");
  const toolbarPane = document.querySelector<HTMLDivElement>("#toolbar");
  if (!editorPane || !previewPane || !toolbarPane) return;

  const draft = await loadDraft().catch(() => null);
  const initialSource = draft ?? NEW_SOURCE.flowchart;

  let previewState: PreviewState = { lastSvg: null };
  let fileHandle: FileSystemFileHandle | null = null;

  const view = createEditor(editorPane, initialSource, (result, source) => {
    previewState = nextPreviewState(previewState, result);
    previewPane.innerHTML = previewHtml(previewState, result);
    void saveDraft(source);
  });

  createToolbar(toolbarPane, {
    onNew(kind) {
      fileHandle = null;
      setEditorSource(view, NEW_SOURCE[kind]);
    },
    async onOpen() {
      const opened = await openFloFile();
      if (!opened) return;
      fileHandle = opened.handle;
      setEditorSource(view, opened.source);
    },
    async onSave() {
      fileHandle = await saveFloFile(getEditorSource(view), fileHandle);
    },
    onExportSvg() {
      if (previewState.lastSvg) exportSvg(previewState.lastSvg);
    },
    onExportPng() {
      if (previewState.lastSvg) void exportPng(previewState.lastSvg);
    },
  });
}

void main();
