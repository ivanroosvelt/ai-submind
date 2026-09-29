import { App, newWorkspace, type AppElements } from "./app.js";
import { loadDraft } from "./storage.js";

async function main(): Promise<void> {
  const find = (selector: string) => document.querySelector<HTMLElement>(selector);
  const el = {
    toolbar: find("#toolbar"),
    explorer: find("#explorer"),
    editor: find("#editor-pane"),
    preview: find("#preview-pane"),
    panel: find("#panel"),
  };
  if (Object.values(el).some((element) => element === null)) return;
  const draft = await loadDraft().catch(() => null);
  new App(el as AppElements, draft ?? newWorkspace());
}

void main();
