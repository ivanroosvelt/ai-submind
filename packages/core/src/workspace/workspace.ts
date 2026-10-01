import { parseDocument } from "../parser/document.js";
import { parseMarkdownDocument } from "../parser/markdown.js";
import { sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";
import { byUri, linkDocuments, type Catalog } from "./resolver.js";
import { XRefIndex } from "./xref.js";

export interface LinkedDocument {
  document: ParsedDocument;
  /** Catálogo alcanzable del documento vía `use`. */
  catalog: Catalog;
}

export interface LinkResult {
  /** Catálogo global: la declaración ganadora de cada id. */
  entities: Catalog;
  /** En orden de uri. */
  documents: Map<DocumentUri, LinkedDocument>;
  /** Lexer, parser y resolución, por documento y ordenados por posición. */
  diagnostics: Map<DocumentUri, Diagnostic[]>;
  xref: XRefIndex;
}

/**
 * Conjunto de documentos en memoria (spec §6). `setDocument` parsea una vez;
 * `link()` resuelve todo desde cero cada vez (sin linking incremental,
 * spec §9) y reescribe todos los `Ref.target`.
 */
export class Workspace {
  private readonly parsed = new Map<DocumentUri, { document: ParsedDocument; diagnostics: Diagnostic[] }>();

  /**
   * El parser se elige por uri (decisión #29): un `.md` es conocimiento y todo lo demás es `.flo`. Un `.md`
   * sin `---` inicial no es documento: si lo era, deja de serlo.
   */
  setDocument(uri: DocumentUri, source: string): void {
    const parsed = uri.endsWith(".md") ? parseMarkdownDocument(source, uri) : parseDocument(source, uri);
    if (parsed) this.parsed.set(uri, parsed);
    else this.parsed.delete(uri);
  }

  removeDocument(uri: DocumentUri): void {
    this.parsed.delete(uri);
  }

  link(): LinkResult {
    const parsed = [...this.parsed.values()].sort((a, b) => byUri(a.document, b.document));
    const linked = linkDocuments(parsed.map((p) => p.document));

    const documents = new Map<DocumentUri, LinkedDocument>();
    const diagnostics = new Map<DocumentUri, Diagnostic[]>();
    for (const { document, diagnostics: parseDiagnostics } of parsed) {
      documents.set(document.uri, { document, catalog: linked.catalogs.get(document.uri)! });
      diagnostics.set(document.uri, sortDiagnostics([...parseDiagnostics, ...linked.diagnostics.get(document.uri)!]));
    }

    return {
      entities: linked.entities,
      documents,
      diagnostics,
      xref: new XRefIndex(parsed.map((p) => p.document), linked.entities),
    };
  }
}
