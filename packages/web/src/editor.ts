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
  onPreview: (result: RenderResult, source: string) => void
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
          timer = setTimeout(() => {
            const source = update.state.doc.toString();
            onPreview(render(source), source);
          }, PREVIEW_DEBOUNCE_MS);
        }),
      ],
    }),
    parent,
  });

  onPreview(render(initialSource), initialSource);

  return view;
}

export function getEditorSource(view: EditorView): string {
  return view.state.doc.toString();
}

export function setEditorSource(view: EditorView, source: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
}
