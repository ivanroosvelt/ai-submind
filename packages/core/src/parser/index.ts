import { Workspace } from "../workspace/workspace.js";
import type { Catalog } from "../workspace/resolver.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";
import type { Diagnostic } from "../diagnostics.js";

export interface ParseResult {
  document: ParsedDocument;
  catalog: Catalog;
  diagnostics: Diagnostic[];
}

/** Un documento suelto, como un workspace de uno: sus `use` no encuentran nada (E032). */
export function parse(source: string, uri: DocumentUri = ""): ParseResult {
  const workspace = new Workspace();
  workspace.setDocument(uri, source);
  const result = workspace.link();
  const { document, catalog } = result.documents.get(uri)!;
  return { document, catalog, diagnostics: result.diagnostics.get(uri)! };
}
