import { basicSetup } from "codemirror";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { linter, lintGutter } from "@codemirror/lint";
import type { DocumentUri, Position } from "@tejo/core";
import { floHighlightField } from "./flo-highlight-field.js";
import { toLintDiagnostics } from "./flo-lint.js";
import { positionAt } from "./text-edits.js";
import type { EditorWorkspace } from "./workspace.js";

const PREVIEW_DEBOUNCE_MS = 200;

export interface EditorHost {
  /** El workspace vigente: la app lo reemplaza al abrir otra carpeta. */
  workspace(): EditorWorkspace;
  /** 200 ms después del último cambio del documento. */
  onChange(): void;
  /** F12 o Ctrl/Cmd+click. */
  onGoToDefinition(position: Position): void;
  /** F2. */
  onRename(position: Position): void;
}

export function createEditor(parent: HTMLElement): EditorView {
  return new EditorView({ parent });
}

function cursor(view: EditorView): Position {
  return positionAt(view.state.doc.toString(), view.state.selection.main.head);
}

function documentExtensions(host: EditorHost, uri: DocumentUri): Extension[] {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return [
    keymap.of([
      { key: "F12", run: (view) => (host.onGoToDefinition(cursor(view)), true) },
      { key: "F2", run: (view) => (host.onRename(cursor(view)), true) },
    ]),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return false;
        const offset = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (offset === null) return false;
        event.preventDefault();
        host.onGoToDefinition(positionAt(view.state.doc.toString(), offset));
        return true;
      },
    }),
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

/**
 * Muestra `uri` con su estado anterior (y su historial de deshacer) si su fuente
 * no cambió por fuera del editor; si no, con uno nuevo (#43).
 */
export function showDocument(view: EditorView, host: EditorHost, uri: DocumentUri, previous?: EditorState): void {
  const doc = host.workspace().source(uri);
  view.setState(
    previous?.doc.toString() === doc ? previous : EditorState.create({ doc, extensions: documentExtensions(host, uri) })
  );
}
