export type DiagramKind = "flowchart" | "sequence";

export interface ExampleOption {
  id: string;
  title: string;
}

export interface ToolbarActions {
  onNew(kind: DiagramKind): void;
  onOpen(): void;
  onOpenFolder(): void;
  onSave(): void;
  onExportSvg(): void;
  onExportPng(): void;
  onLoadExample(id: string): void;
  onToggleExpand(): void;
  onToggleMap(): void;
  onToggleGraph(): void;
}

// Paneles que se pueden ocultar: cada botón alterna `flo-hide-<id>` en <body>.
const PANES = [
  { id: "side", label: "Archivos" },
  { id: "editor", label: "Código" },
  { id: "preview", label: "Diagrama" },
];
const PANES_KEY = "flo:hidden-panes";

function bindPanes(container: HTMLElement): void {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>("[data-flo-pane]")];
  const apply = (hidden: Set<string>) => {
    for (const button of buttons) {
      const id = button.dataset.floPane!;
      document.body.classList.toggle(`flo-hide-${id}`, hidden.has(id));
      button.setAttribute("aria-pressed", String(!hidden.has(id)));
    }
    try {
      localStorage.setItem(PANES_KEY, JSON.stringify([...hidden]));
    } catch {
      // Sin storage (modo privado): el estado vale solo para esta sesión.
    }
  };
  let saved: string[] = [];
  try {
    saved = JSON.parse(localStorage.getItem(PANES_KEY) ?? "[]");
  } catch {
    saved = [];
  }
  const hidden = new Set(saved.filter((id) => PANES.some((pane) => pane.id === id)));
  if (hidden.size === PANES.length) hidden.clear();
  apply(hidden);
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const id = button.dataset.floPane!;
      if (hidden.has(id)) hidden.delete(id);
      // Siempre queda al menos un panel visible.
      else if (hidden.size < PANES.length - 1) hidden.add(id);
      apply(hidden);
    });
  }
}

export function createToolbar(
  container: HTMLElement,
  actions: ToolbarActions,
  examples: ExampleOption[] = []
): void {
  const exampleOptions = examples
    .map((example) => `<option value="${example.id}">${example.title}</option>`)
    .join("");

  container.innerHTML = `
    <span class="flo-brand" aria-hidden="true">.flo</span>
    <div class="flo-tb-group flo-tb-nav" role="group" aria-label="Navegación">
      <button id="flo-back" type="button" title="Atrás" aria-label="Atrás">←</button>
      <button id="flo-forward" type="button" title="Adelante" aria-label="Adelante">→</button>
    </div>
    <div class="flo-tb-group" role="group" aria-label="Archivo">
      <button id="flo-new-flowchart" type="button">Nuevo flowchart</button>
      <button id="flo-new-sequence" type="button">Nueva secuencia</button>
      <button id="flo-open" type="button">Abrir</button>
      <button id="flo-open-folder" type="button">Abrir carpeta</button>
      <button id="flo-save" type="button" class="flo-primary">Guardar</button>
    </div>
    <div class="flo-tb-group" role="group" aria-label="Vista">
      <button id="flo-toggle-map" type="button" aria-pressed="false">Mapa</button>
      <button id="flo-toggle-graph" type="button" aria-pressed="false">Grafo</button>
      <button id="flo-toggle-expand" type="button">Ampliar</button>
    </div>
    <div class="flo-tb-group" role="group" aria-label="Paneles">
      ${PANES.map((pane) => `<button type="button" data-flo-pane="${pane.id}" aria-pressed="true">${pane.label}</button>`).join("")}
    </div>
    <div class="flo-tb-group" role="group" aria-label="Exportar">
      <button id="flo-export-svg" type="button">SVG</button>
      <button id="flo-export-png" type="button">PNG</button>
    </div>
    <select id="flo-examples" aria-label="Ejemplos">
      <option value="" selected disabled>Ejemplos</option>
      ${exampleOptions}
    </select>
  `;

  function byId(id: string): HTMLElement {
    const element = container.querySelector<HTMLElement>(`#${id}`);
    if (!element) {
      throw new Error(`falta el botón #${id} en la toolbar`);
    }
    return element;
  }

  byId("flo-new-flowchart").addEventListener("click", () => actions.onNew("flowchart"));
  byId("flo-new-sequence").addEventListener("click", () => actions.onNew("sequence"));
  byId("flo-open").addEventListener("click", actions.onOpen);
  byId("flo-open-folder").addEventListener("click", actions.onOpenFolder);
  byId("flo-save").addEventListener("click", actions.onSave);
  byId("flo-export-svg").addEventListener("click", actions.onExportSvg);
  byId("flo-export-png").addEventListener("click", actions.onExportPng);
  byId("flo-toggle-map").addEventListener("click", actions.onToggleMap);
  byId("flo-toggle-graph").addEventListener("click", actions.onToggleGraph);
  byId("flo-toggle-expand").addEventListener("click", actions.onToggleExpand);

  // El historial es el del navegador (lo llena App): mouse y gestos también sirven.
  byId("flo-back").addEventListener("click", () => history.back());
  byId("flo-forward").addEventListener("click", () => history.forward());
  bindPanes(container);

  const examplesSelect = byId("flo-examples") as HTMLSelectElement;
  examplesSelect.addEventListener("change", () => {
    const id = examplesSelect.value;
    examplesSelect.value = "";
    if (id) actions.onLoadExample(id);
  });
}
