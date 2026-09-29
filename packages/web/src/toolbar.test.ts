import { describe, it, expect, vi } from "vitest";
import { createToolbar, type ToolbarActions } from "./toolbar.js";

function mockActions(): ToolbarActions {
  return {
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onOpenFolder: vi.fn(),
    onSave: vi.fn(),
    onExportSvg: vi.fn(),
    onExportPng: vi.fn(),
    onLoadExample: vi.fn(),
    onToggleExpand: vi.fn(),
    onToggleMap: vi.fn(),
  };
}

describe("createToolbar", () => {
  it("wires each button to its action", () => {
    const container = document.createElement("div");
    const actions = mockActions();
    createToolbar(container, actions);

    container.querySelector<HTMLButtonElement>("#flo-new-flowchart")!.click();
    expect(actions.onNew).toHaveBeenCalledWith("flowchart");

    container.querySelector<HTMLButtonElement>("#flo-new-sequence")!.click();
    expect(actions.onNew).toHaveBeenCalledWith("sequence");

    container.querySelector<HTMLButtonElement>("#flo-open")!.click();
    expect(actions.onOpen).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-open-folder")!.click();
    expect(actions.onOpenFolder).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-save")!.click();
    expect(actions.onSave).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-export-svg")!.click();
    expect(actions.onExportSvg).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-export-png")!.click();
    expect(actions.onExportPng).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-toggle-expand")!.click();
    expect(actions.onToggleExpand).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-toggle-map")!.click();
    expect(actions.onToggleMap).toHaveBeenCalledTimes(1);
  });

  it("lists the given examples and loads the selected one", () => {
    const container = document.createElement("div");
    const actions = mockActions();
    createToolbar(container, actions, [
      { id: "flowchart", title: "Flowchart" },
      { id: "sequence", title: "Secuencia" },
    ]);

    const select = container.querySelector<HTMLSelectElement>("#flo-examples")!;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "",
      "flowchart",
      "sequence",
    ]);

    select.value = "sequence";
    select.dispatchEvent(new Event("change"));

    expect(actions.onLoadExample).toHaveBeenCalledWith("sequence");
    expect(select.value).toBe("");
  });
});
