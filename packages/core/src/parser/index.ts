import { Workspace } from "../workspace/workspace.js";
import type { Catalog } from "../workspace/resolver.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";
import type { Diagnostic } from "../diagnostics.js";

export interface ParseResult {
  document: ParsedDocument;
  catalog: Catalog;
  diagnostics: Diagnostic[];
}

/**
 * Un documento suelto, como un workspace de uno: sus `use` no encuentran
 * nada (E032). Un `.md` sin frontmatter no es
 * documento del workspace: se devuelve un documento vacío con catálogo
 * vacío.
 */
export function parse(source: string, uri: DocumentUri = ""): ParseResult {
  const workspace = new Workspace();
  workspace.setDocument(uri, source);
  const result = workspace.link();
  const linked = result.documents.get(uri);
  const document = linked?.document ?? { uri, uses: [], entities: [], blocks: [] };
  const catalog = linked?.catalog ?? new Map();
  return { document, catalog, diagnostics: result.diagnostics.get(uri) ?? [] };
}
