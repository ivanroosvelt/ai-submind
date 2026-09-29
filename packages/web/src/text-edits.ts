import type { Position, TextEdit } from "@flo/core";

/** Offset de una posición del core (línea y columna desde 1, en unidades UTF-16 como el lexer). */
export function offsetAt(source: string, position: Position): number {
  let offset = 0;
  for (let line = 1; line < position.line; line++) {
    const next = source.indexOf("\n", offset);
    if (next === -1) return source.length;
    offset = next + 1;
  }
  return Math.min(offset + position.column - 1, source.length);
}

export function positionAt(source: string, offset: number): Position {
  const before = source.slice(0, offset);
  const lineStart = before.lastIndexOf("\n") + 1;
  return { line: before.split("\n").length, column: offset - lineStart + 1 };
}

export interface Change {
  from: number;
  to: number;
  insert: string;
}

/** En orden ascendente, como los espera `EditorView.dispatch`. */
export function toChanges(source: string, edits: TextEdit[]): Change[] {
  return edits
    .map((edit) => ({ from: offsetAt(source, edit.range.start), to: offsetAt(source, edit.range.end), insert: edit.text }))
    .sort((a, b) => a.from - b.from);
}

/** Aplica ediciones que no se solapan, dadas en cualquier orden. */
export function applyTextEdits(source: string, edits: TextEdit[]): string {
  return toChanges(source, edits).reduceRight(
    (text, change) => text.slice(0, change.from) + change.insert + text.slice(change.to),
    source
  );
}
