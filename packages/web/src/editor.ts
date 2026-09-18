import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { linter, lintGutter } from "@codemirror/lint";
import { parse, render, type RenderResult } from "@flo/core";
import { floHighlightField } from "./flo-highlight-field.js";
import { toLintDiagnostics } from "./flo-lint.js";

const PREVIEW_DEBOUNCE_MS = 200;

export function createEditor(
  parent: HTMLElement,
  initialSource: string,
  onPreview: (result: RenderResult) => void
): EditorView {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const view = new EditorView({
    state: EditorState.create({
      doc: initialSource,
      extensions: [
        basicSetup,
        floHighlightField,
        lintGutter(),
        linter((v) => toLintDiagnostics(parse(v.state.doc.toString()).diagnostics, v.state.doc), {
          delay: PREVIEW_DEBOUNCE_MS,
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          clearTimeout(timer);
          timer = setTimeout(() => onPreview(render(update.state.doc.toString())), PREVIEW_DEBOUNCE_MS);
        }),
      ],
    }),
    parent,
  });

  onPreview(render(initialSource));

  return view;
}
