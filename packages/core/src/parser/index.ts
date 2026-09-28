import { parseDocument } from "./document.js";
import { linkDocuments, type Catalog } from "../workspace/resolver.js";
import { sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";

export interface ParseResult {
  document: ParsedDocument;
  catalog: Catalog;
  diagnostics: Diagnostic[];
}

/** Un documento suelto: sus `use` no encuentran nada (E032) y solo ve su propio catálogo. */
export function parse(source: string, uri: DocumentUri = ""): ParseResult {
  const parsed = parseDocument(source, uri);
  const linked = linkDocuments([parsed.document]);
  return {
    document: parsed.document,
    catalog: linked.catalogs.get(uri)!,
    diagnostics: sortDiagnostics([...parsed.diagnostics, ...linked.diagnostics.get(uri)!]),
  };
}
