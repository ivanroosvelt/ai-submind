import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RenderResult } from "@flo/core";
import { createEditor } from "./editor.js";
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
    const view = createEditor(container, "diagram flowchart\n\nstart[Inicio]\n", (result) => {
      results.push(result);
    });

    expect(results).toHaveLength(1);
    expect(results[0].svg).toContain(">Inicio<");
    expect(results[0].diagnostics).toEqual([]);

    view.dispatch({ changes: { from: view.state.doc.length, insert: "check[Otro]\nstart -> check\n" } });
    expect(results).toHaveLength(1);

    vi.advanceTimersByTime(199);
    expect(results).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(results).toHaveLength(2);
    expect(results[1].svg).toContain(">Inicio<");
    expect(results[1].diagnostics).toEqual([]);

    view.destroy();
  });

  it("does not schedule a preview update for non-doc changes (e.g. selection only)", () => {
    const results: RenderResult[] = [];
    const view = createEditor(container, "diagram flowchart\n\nstart[Inicio]\n", (result) => {
      results.push(result);
    });

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
