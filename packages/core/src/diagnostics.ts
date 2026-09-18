export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  code: string;
  message: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const label = diagnostic.severity === "error" ? "error" : "warning";
  return `${diagnostic.code} ${label} [${diagnostic.line}:${diagnostic.column}]: ${diagnostic.message}`;
}
