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
    <button id="flo-new-flowchart" type="button">Nuevo flowchart</button>
    <button id="flo-new-sequence" type="button">Nueva secuencia</button>
    <button id="flo-open" type="button">Abrir</button>
    <button id="flo-open-folder" type="button">Abrir carpeta</button>
    <button id="flo-save" type="button">Guardar</button>
    <button id="flo-export-svg" type="button">Exportar SVG</button>
    <button id="flo-export-png" type="button">Exportar PNG</button>
    <button id="flo-toggle-expand" type="button">Ampliar</button>
    <select id="flo-examples">
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
  byId("flo-toggle-expand").addEventListener("click", actions.onToggleExpand);

  const examplesSelect = byId("flo-examples") as HTMLSelectElement;
  examplesSelect.addEventListener("change", () => {
    const id = examplesSelect.value;
    examplesSelect.value = "";
    if (id) actions.onLoadExample(id);
  });
}
