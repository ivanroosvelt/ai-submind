import type { Text } from "@codemirror/state";
import type { Diagnostic } from "@flo/core";

export interface LintDiagnostic {
  from: number;
  to: number;
  severity: "error" | "warning";
  message: string;
}

export function toLintDiagnostics(diagnostics: Diagnostic[], doc: Text): LintDiagnostic[] {
  return diagnostics.map((d) => {
    const line = doc.line(Math.min(d.line, doc.lines));
    const from = Math.min(line.from + (d.column - 1), line.to);
    const to = Math.min(from + 1, line.to);
    return { from, to, severity: d.severity, message: `${d.code}: ${d.message}` };
  });
}
