import { parseDocument } from "./document.js";
import { resolveDocument, type Catalog } from "../workspace/resolver.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";
import type { Diagnostic } from "../diagnostics.js";

export interface ParseResult {
  document: ParsedDocument;
  catalog: Catalog;
  diagnostics: Diagnostic[];
}

function sortDiagnosticsByPosition(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column
  );
}

export function parse(source: string, uri: DocumentUri = ""): ParseResult {
  const parsed = parseDocument(source, uri);
  const resolved = resolveDocument(parsed.document);
  return {
    document: parsed.document,
    catalog: resolved.catalog,
    diagnostics: sortDiagnosticsByPosition([...parsed.diagnostics, ...resolved.diagnostics]),
  };
}
