import type { Text } from "@codemirror/state";
import type { Diagnostic, Position } from "@flo/core";

export interface LintDiagnostic {
  from: number;
  to: number;
  severity: "error";
  message: string;
}

function offsetOf(doc: Text, position: Position): number {
  const line = doc.line(Math.min(position.line, doc.lines));
  return Math.min(line.from + (position.column - 1), line.to);
}

export function toLintDiagnostics(diagnostics: Diagnostic[], doc: Text): LintDiagnostic[] {
  return diagnostics.map((d) => {
    const from = offsetOf(doc, d.range.start);
    const to = Math.max(from, offsetOf(doc, d.range.end));
    return { from, to, severity: "error", message: `${d.code}: ${d.message}` };
  });
}
