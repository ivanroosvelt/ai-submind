import { describe, it, expect, vi } from "vitest";
import { createToolbar, type ToolbarActions } from "./toolbar.js";

function mockActions(): ToolbarActions {
  return {
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onExportSvg: vi.fn(),
    onExportPng: vi.fn(),
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

    container.querySelector<HTMLButtonElement>("#flo-save")!.click();
    expect(actions.onSave).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-export-svg")!.click();
    expect(actions.onExportSvg).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-export-png")!.click();
    expect(actions.onExportPng).toHaveBeenCalledTimes(1);
  });
});
