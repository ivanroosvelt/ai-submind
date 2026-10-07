import { App, newWorkspace, type AppElements } from "./app.js";
import { openLocalFolder, watchLocalFolder } from "./local-folder.js";
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
  // Con `tejo view` detrás, el disco manda: sin borrador (#66).
  const local = await openLocalFolder();
  const draft = local ? null : await loadDraft().catch(() => null);
  const app = new App(el as AppElements, local ?? draft ?? newWorkspace());
  if (local) {
    document.getElementById("flo-open-folder")?.setAttribute("hidden", "");
    let timer: ReturnType<typeof setTimeout> | undefined;
    // El mismo debounce que el preview (#48): una ráfaga de escrituras es una sola relectura.
    watchLocalFolder(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void app.syncLocal().catch((error) => console.error("tejo: no se pudo releer la carpeta", error)), 200);
    });
  }
  window.addEventListener("keydown", (event) => app.onKeydown(event));
  window.addEventListener("popstate", (event) => app.onPopState(event.state));
  window.addEventListener("beforeunload", (event) => app.onBeforeUnload(event));
}

void main();
