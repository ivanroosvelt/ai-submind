import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runScopeHandlers } from "@codemirror/view";
import { createEditor, showDocument, type EditorHost } from "./editor.js";
import { floHighlightField } from "./flo-highlight-field.js";
import { EditorWorkspace } from "./workspace.js";

describe("editor", () => {
  let ws: EditorWorkspace;
  let host: EditorHost & { onChange: ReturnType<typeof vi.fn>; onGoToDefinition: ReturnType<typeof vi.fn>; onRename: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    ws = new EditorWorkspace({
      files: { "a.flo": "entity a\nflow f {\n  a -> a\n}\n", "n.md": "---\nid: n\n---\n" },
      saved: {},
      active: "a.flo",
      dir: null,
    });
    host = { workspace: () => ws, onChange: vi.fn(), onGoToDefinition: vi.fn(), onRename: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a document and pushes each change to the workspace at once", () => {
    const view = createEditor(document.createElement("div"));
    showDocument(view, host, "a.flo");
    expect(view.state.doc.toString()).toBe(ws.source("a.flo"));

    view.dispatch({ changes: { from: 0, insert: "// hola\n" } });
    expect(ws.source("a.flo")).toBe("// hola\nentity a\nflow f {\n  a -> a\n}\n");
    view.destroy();
  });

  it("calls onChange 200ms after the last edit, not for selection changes", () => {
    const view = createEditor(document.createElement("div"));
    showDocument(view, host, "a.flo");
    view.dispatch({ selection: { anchor: 1 } });
    view.dispatch({ changes: { from: 0, insert: "x" } });
    vi.advanceTimersByTime(199);
    expect(host.onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(host.onChange).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  it("binds F12 to go to definition and F2 to rename at the cursor", () => {
    const view = createEditor(document.createElement("div"));
    showDocument(view, host, "a.flo");
    view.dispatch({ selection: { anchor: 20 } }); // línea 3, columna 3: la primera 'a' de 'a -> a'
    runScopeHandlers(view, new KeyboardEvent("keydown", { key: "F12" }), "editor");
    runScopeHandlers(view, new KeyboardEvent("keydown", { key: "F2" }), "editor");
    expect(host.onGoToDefinition).toHaveBeenCalledWith({ line: 3, column: 3 });
    expect(host.onRename).toHaveBeenCalledWith({ line: 3, column: 3 });
    view.destroy();
  });

  it("gives each document its own state and highlights only .flo", () => {
    const view = createEditor(document.createElement("div"));
    showDocument(view, host, "a.flo");
    expect(view.state.field(floHighlightField, false)).toBeDefined();
    showDocument(view, host, "n.md");
    expect(view.state.doc.toString()).toBe("---\nid: n\n---\n");
    expect(view.state.field(floHighlightField, false)).toBeUndefined();
    view.destroy();
  });
});
