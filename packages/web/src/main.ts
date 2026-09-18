import { createEditor } from "./editor.js";
import { nextPreviewState, previewHtml, type PreviewState } from "./preview.js";

const INITIAL_SOURCE = ["diagram flowchart", "", "start[Inicio]", "", ""].join("\n");

const editorPane = document.querySelector<HTMLDivElement>("#editor-pane");
const previewPane = document.querySelector<HTMLDivElement>("#preview-pane");

if (editorPane && previewPane) {
  let previewState: PreviewState = { lastSvg: null };
  createEditor(editorPane, INITIAL_SOURCE, (result) => {
    previewState = nextPreviewState(previewState, result);
    previewPane.innerHTML = previewHtml(previewState, result);
  });
}
