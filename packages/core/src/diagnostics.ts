import type { Range } from "./ast.js";

/** Todo diagnóstico es un error (#53). */
export interface Diagnostic {
  code: string;
  message: string;
  range: Range;
}

export function diagnosticAt(code: string, message: string, range: Range): Diagnostic {
  return { code, message, range };
}

/** Ordena in place por (línea, columna) y devuelve el mismo array. */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column
  );
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `${diagnostic.code} error [${diagnostic.range.start.line}:${diagnostic.range.start.column}]: ${diagnostic.message}`;
}
