import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RenderResult } from "@flo/core";
import { createEditor, getEditorSource, setEditorSource } from "./editor.js";
import { floHighlightField } from "./flo-highlight-field.js";

describe("createEditor", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onPreview immediately with the initial source, then again ~200ms after an edit", () => {
    const results: RenderResult[] = [];
    const view = createEditor(
      container,
      "entity start [Inicio]\nentity check [Otro]\n\nflow f {\n  start -> check\n}\n",
      (result) => {
        results.push(result);
      }
    );

    expect(results).toHaveLength(1);
    expect(results[0].diagrams[0].svg).toContain(">Inicio<");
    expect(results[0].diagnostics).toEqual([]);

    view.dispatch({ changes: { from: view.state.doc.length, insert: "flow g {\n  check -> start\n}\n" } });
    expect(results).toHaveLength(1);

    vi.advanceTimersByTime(199);
    expect(results).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(results).toHaveLength(2);
    expect(results[1].diagrams[0].svg).toContain(">Inicio<");
    expect(results[1].diagnostics).toEqual([]);

    view.destroy();
  });

  it("does not schedule a preview update for non-doc changes (e.g. selection only)", () => {
    const results: RenderResult[] = [];
    const view = createEditor(
      container,
      "entity start [Inicio]\nentity check [Otro]\n\nflow f {\n  start -> check\n}\n",
      (result) => {
        results.push(result);
      }
    );

    view.dispatch({ selection: { anchor: 0 } });
    vi.advanceTimersByTime(200);

    expect(results).toHaveLength(1);
    view.destroy();
  });

  it("highlights tokens in the mounted view via floHighlightField", () => {
    const view = createEditor(container, "start[Inicio]\n", () => {});

    const decorated: string[] = [];
    view.state.field(floHighlightField).between(0, view.state.doc.length, (from, to) => {
      decorated.push(view.state.doc.sliceString(from, to));
    });

    expect(decorated).toEqual(["start", "[", "Inicio", "]"]);
    view.destroy();
  });
});

it("passes the current source alongside the render result", () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  const sources: string[] = [];
  const view = createEditor(container, "start[Inicio]\n", (_result, source) => {
    sources.push(source);
  });

  view.dispatch({ changes: { from: view.state.doc.length, insert: "check[Otro]\n" } });
  vi.advanceTimersByTime(200);

  expect(sources).toEqual(["start[Inicio]\n", "start[Inicio]\ncheck[Otro]\n"]);
  view.destroy();
  vi.useRealTimers();
});

describe("getEditorSource / setEditorSource", () => {
  it("reads and replaces the full document", () => {
    const container = document.createElement("div");
    const view = createEditor(container, "start[Inicio]\n", () => {});

    expect(getEditorSource(view)).toBe("start[Inicio]\n");

    setEditorSource(view, "diagram sequence\n");
    expect(getEditorSource(view)).toBe("diagram sequence\n");

    view.destroy();
  });
});
