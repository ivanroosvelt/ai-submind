import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument, Relation } from "../ast.js";
import type { Catalog } from "./resolver.js";
import { blockId, resolveUse } from "./uri.js";

/**
 * Forma ruta de `relations.target` (spec de conocimiento §3.2, decisión
 * #30): lo anterior a `#` contiene `/` o termina en `.md`/`.flo`; lo
 * posterior, si hay, nombra un bloque. null = forma id.
 */
export function relationPath(target: string): { path: string; block: string | null } | null {
  const hash = target.indexOf("#");
  const path = hash === -1 ? target : target.slice(0, hash);
  if (!path.includes("/") && !path.endsWith(".md") && !path.endsWith(".flo")) return null;
  return { path, block: hash === -1 ? null : target.slice(hash + 1) };
}

function relationsOf(document: ParsedDocument): Relation[] {
  return document.entities.flatMap((entity) => entity.knowledge?.relations ?? []);
}

/** Documentos que las rutas de `relations` suman como `use` implícito: los que existen, sin repetir. */
export function relationUses(document: ParsedDocument, exists: (uri: DocumentUri) => boolean): DocumentUri[] {
  const uris: DocumentUri[] = [];
  for (const relation of relationsOf(document)) {
    const path = relationPath(relation.target);
    const uri = path && resolveUse(document.uri, path.path);
    if (uri && exists(uri) && !uris.includes(uri)) uris.push(uri);
  }
  return uris;
}

/** Rellena `Relation.resolved` contra el catálogo alcanzable del documento (E035). */
export function resolveRelations(
  document: ParsedDocument,
  catalog: Catalog,
  documentsByUri: Map<DocumentUri, ParsedDocument>,
  diagnostics: Diagnostic[]
): void {
  for (const relation of relationsOf(document)) {
    relation.resolved = resolveTarget(document.uri, relation.target, catalog, documentsByUri);
    if (relation.resolved === null) {
      diagnostics.push(
        diagnosticAt(
          "E035",
          `la relación '${relation.target}' no resuelve a una entidad, un .md o un bloque del workspace`,
          relation.range
        )
      );
    }
  }
}

function resolveTarget(
  from: DocumentUri,
  target: string,
  catalog: Catalog,
  documentsByUri: Map<DocumentUri, ParsedDocument>
): Relation["resolved"] {
  const path = relationPath(target);
  if (path === null) return catalog.has(target) ? { kind: "entity", id: target } : null;

  const uri = resolveUse(from, path.path);
  const document = uri === null ? undefined : documentsByUri.get(uri);
  if (!document) return null;
  if (path.block !== null) {
    const name = path.block;
    return document.blocks.some((block) => block.name === name) ? { kind: "block", id: blockId(document.uri, name) } : null;
  }
  const entity = document.entities.find((candidate) => candidate.knowledge !== null);
  return entity ? { kind: "entity", id: entity.id } : null;
}
