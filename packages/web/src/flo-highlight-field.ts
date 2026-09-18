import { StateField, type Text } from "@codemirror/state";
import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";
import { buildHighlightRanges } from "./flo-highlight.js";

function decorationsFor(doc: Text): DecorationSet {
  const ranges = buildHighlightRanges(doc);
  return Decoration.set(ranges.map((r) => Decoration.mark({ class: r.className }).range(r.from, r.to)));
}

export const floHighlightField = StateField.define<DecorationSet>({
  create(state) {
    return decorationsFor(state.doc);
  },
  update(deco, tr) {
    if (!tr.docChanged) return deco.map(tr.changes);
    return decorationsFor(tr.state.doc);
  },
  provide: (field) => EditorView.decorations.from(field),
});
