import type { Range } from "./ast.js";

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  code: string;
  message: string;
  range: Range;
  severity: DiagnosticSeverity;
}

export function diagnosticAt(
  code: string,
  message: string,
  range: Range,
  severity: DiagnosticSeverity = "error"
): Diagnostic {
  return { code, message, range, severity };
}

/** Ordena in place por (línea, columna) y devuelve el mismo array. */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column
  );
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const label = diagnostic.severity === "error" ? "error" : "warning";
  return `${diagnostic.code} ${label} [${diagnostic.range.start.line}:${diagnostic.range.start.column}]: ${diagnostic.message}`;
}
