import { basicSetup } from "codemirror";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { linter, lintGutter } from "@codemirror/lint";
import type { DocumentUri } from "@flo/core";
import { floHighlightField } from "./flo-highlight-field.js";
import { toLintDiagnostics } from "./flo-lint.js";
import type { EditorWorkspace } from "./workspace.js";

const PREVIEW_DEBOUNCE_MS = 200;

export interface EditorHost {
  /** El workspace vigente: la app lo reemplaza al abrir otra carpeta. */
  workspace(): EditorWorkspace;
  /** 200 ms después del último cambio del documento. */
  onChange(): void;
}

export function createEditor(parent: HTMLElement): EditorView {
  return new EditorView({ parent });
}

function documentExtensions(host: EditorHost, uri: DocumentUri): Extension[] {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return [
    basicSetup,
    uri.endsWith(".flo") ? floHighlightField : [],
    lintGutter(),
    linter((v) => toLintDiagnostics(host.workspace().link().diagnostics.get(uri) ?? [], v.state.doc), {
      delay: PREVIEW_DEBOUNCE_MS,
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      // En el acto: el lint lee el workspace y no puede ver una fuente vieja.
      host.workspace().setSource(uri, update.state.doc.toString());
      clearTimeout(timer);
      timer = setTimeout(() => host.onChange(), PREVIEW_DEBOUNCE_MS);
    }),
  ];
}

/** Muestra `uri` con un estado propio (su historial de deshacer empieza de cero). */
export function showDocument(view: EditorView, host: EditorHost, uri: DocumentUri): void {
  view.setState(EditorState.create({ doc: host.workspace().source(uri), extensions: documentExtensions(host, uri) }));
}
