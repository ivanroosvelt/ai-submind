export type DiagramKind = "flowchart" | "sequence";

export interface ToolbarActions {
  onNew(kind: DiagramKind): void;
  onOpen(): void;
  onSave(): void;
  onExportSvg(): void;
  onExportPng(): void;
}

export function createToolbar(container: HTMLElement, actions: ToolbarActions): void {
  container.innerHTML = `
    <button id="flo-new-flowchart" type="button">Nuevo flowchart</button>
    <button id="flo-new-sequence" type="button">Nueva secuencia</button>
    <button id="flo-open" type="button">Abrir</button>
    <button id="flo-save" type="button">Guardar</button>
    <button id="flo-export-svg" type="button">Exportar SVG</button>
    <button id="flo-export-png" type="button">Exportar PNG</button>
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
  byId("flo-save").addEventListener("click", actions.onSave);
  byId("flo-export-svg").addEventListener("click", actions.onExportSvg);
  byId("flo-export-png").addEventListener("click", actions.onExportPng);
}
