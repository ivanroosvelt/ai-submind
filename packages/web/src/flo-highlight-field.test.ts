import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { floHighlightField } from "./flo-highlight-field.js";

describe("floHighlightField", () => {
  it("computes decorations for the initial document", () => {
    const state = EditorState.create({ doc: "a[X]\n", extensions: [floHighlightField] });

    const ranges: string[] = [];
    state.field(floHighlightField).between(0, state.doc.length, (from, to) => {
      ranges.push(state.doc.sliceString(from, to));
    });

    expect(ranges).toEqual(["a", "[", "X", "]"]);
  });

  it("recomputes decorations after a document change", () => {
    const state = EditorState.create({ doc: "a[X]\n", extensions: [floHighlightField] });
    const tr = state.update({ changes: { from: state.doc.length, insert: "a -> b\n" } });

    const ranges: string[] = [];
    tr.state.field(floHighlightField).between(0, tr.state.doc.length, (from, to) => {
      ranges.push(tr.state.doc.sliceString(from, to));
    });

    expect(ranges).toEqual(["a", "[", "X", "]", "a", "->", "b"]);
  });
});
