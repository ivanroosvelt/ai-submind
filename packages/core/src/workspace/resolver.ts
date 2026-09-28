import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { EntityDecl, EntityId, ParsedDocument } from "../ast.js";

export type Catalog = Map<EntityId, EntityDecl>;

/**
 * Resolución estricta dentro de un único documento: arma el catálogo (la
 * primera declaración de cada id gana), rellena `Ref.target` y reporta
 * E030/E031/E033. La Fase D lo generaliza a varios documentos vía `use`.
 */
export function resolveDocument(document: ParsedDocument): { catalog: Catalog; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const catalog: Catalog = new Map();

  for (const entity of document.entities) {
    if (catalog.has(entity.id)) {
      diagnostics.push(diagnosticAt("E031", `la entidad '${entity.id}' ya fue declarada`, entity.nameRange));
    } else {
      catalog.set(entity.id, entity);
    }
  }

  const blockNames = new Set<string>();
  for (const block of document.blocks) {
    if (blockNames.has(block.name)) {
      diagnostics.push(diagnosticAt("E033", `el bloque '${block.name}' ya fue declarado`, block.nameRange));
    }
    blockNames.add(block.name);

    for (const edge of block.edges) {
      for (const ref of [edge.from, edge.to]) {
        ref.target = catalog.has(ref.name) ? ref.name : null;
        if (ref.target === null) {
          diagnostics.push(
            diagnosticAt("E030", `la entidad '${ref.name}' no está declarada; añade 'entity ${ref.name}'`, ref.range)
          );
        }
      }
    }
  }

  return { catalog, diagnostics };
}
