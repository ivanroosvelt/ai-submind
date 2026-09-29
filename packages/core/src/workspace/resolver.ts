import { diagnosticAt, sortDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, EntityDecl, EntityId, ParsedDocument } from "../ast.js";
import { resolveUse } from "./uri.js";
import { openingRange } from "../parser/markdown.js";
import { SCHEMA_URI, checkVocabulary, type Vocabulary } from "./schema.js";
import { relationUses, resolveRelations } from "./knowledge.js";

export type Catalog = Map<EntityId, EntityDecl>;

export interface LinkedDocuments {
  /** Catálogo global: la declaración ganadora de cada id (los ids son únicos en el workspace). */
  entities: Catalog;
  /** Por documento, el catálogo alcanzable vía `use`: dependencias primero, el documento al final. */
  catalogs: Map<DocumentUri, Catalog>;
  /** Por documento, las uris que resuelven sus `use`, en orden de aparición y sin repetir; incluye los `use` implícitos de `relations`. */
  uses: Map<DocumentUri, DocumentUri[]>;
  /** Por documento, diagnósticos de resolución (E030–E033, E035, E065, E066, E068), ordenados por posición. */
  diagnostics: Map<DocumentUri, Diagnostic[]>;
}

/** Orden determinista de documentos (decisión #24): por uri, sin importar el orden de carga. */
export function byUri(a: { uri: DocumentUri }, b: { uri: DocumentUri }): number {
  return a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0;
}

/**
 * Resolución de un conjunto de documentos: arma el catálogo global (la
 * primera declaración de cada id gana, decisión #2), resuelve los `use`
 * (E032), calcula el catálogo alcanzable de cada documento, rellena todos
 * los `Ref.target` contra ese catálogo (E030) y reporta bloques repetidos
 * dentro de un documento (E033); las rutas de `relations` cuentan como
 * `use` implícito y cada `relations.target` se resuelve (E035). Valida el
 * vocabulario de los `.md` contra el esquema (E065, E066) o reporta su
 * ausencia (E068).
 */
export function linkDocuments(input: ParsedDocument[], vocabulary: Vocabulary = "missing"): LinkedDocuments {
  const documents = [...input].sort(byUri);
  const documentsByUri = new Map(documents.map((d) => [d.uri, d]));
  const diagnostics = new Map<DocumentUri, Diagnostic[]>(documents.map((d) => [d.uri, []]));

  const entities: Catalog = new Map();
  for (const document of documents) {
    for (const entity of document.entities) {
      const first = entities.get(entity.id);
      if (first === undefined) {
        entities.set(entity.id, entity);
        continue;
      }
      const where = first.uri === entity.uri ? "" : ` en '${first.uri}'`;
      diagnostics
        .get(document.uri)!
        .push(diagnosticAt("E031", `la entidad '${entity.id}' ya fue declarada${where}`, entity.nameRange));
    }
  }

  const uses = new Map<DocumentUri, DocumentUri[]>();
  for (const document of documents) {
    const targets: DocumentUri[] = [];
    for (const use of document.uses) {
      const target = resolveUse(document.uri, use.path);
      if (target === null || !documentsByUri.has(target)) {
        diagnostics
          .get(document.uri)!
          .push(diagnosticAt("E032", missingUseMessage(use.path, target), use.pathRange));
      } else if (!targets.includes(target)) {
        targets.push(target);
      }
    }
    for (const uri of relationUses(document, (candidate) => documentsByUri.has(candidate))) {
      if (!targets.includes(uri)) targets.push(uri);
    }
    uses.set(document.uri, targets);
  }

  const catalogs = new Map<DocumentUri, Catalog>();
  for (const document of documents) {
    const catalog: Catalog = new Map();
    for (const uri of reachable(document.uri, uses)) {
      for (const entity of documentsByUri.get(uri)!.entities) {
        if (entities.get(entity.id) === entity) catalog.set(entity.id, entity);
      }
    }
    catalogs.set(document.uri, catalog);
    resolveBlocks(document, catalog, entities, diagnostics.get(document.uri)!);
    resolveRelations(document, catalog, documentsByUri, diagnostics.get(document.uri)!);
  }

  if (vocabulary === "missing") {
    // Un solo E068, en el primer .md por uri (decisión #29).
    const first = documents.find((d) => d.uri.endsWith(".md"));
    if (first) {
      diagnostics
        .get(first.uri)!
        .push(
          diagnosticAt(
            "E068",
            `falta '${SCHEMA_URI}' en la raíz del workspace: no se validan 'type_tags' ni los tipos de relación`,
            openingRange()
          )
        );
    }
  } else if (vocabulary !== "invalid") {
    for (const document of documents) checkVocabulary(document, vocabulary, diagnostics.get(document.uri)!);
  }

  for (const list of diagnostics.values()) sortDiagnostics(list);
  return { entities, catalogs, uses, diagnostics };
}

/** Por qué la ruta de un `use` no llega a un documento (E032). */
function missingUseMessage(path: string, target: DocumentUri | null): string {
  if (target === null) return `la ruta '${path}' sale de la raíz del workspace o no nombra un documento`;
  if (target === SCHEMA_URI) return `'${path}' es el esquema de conocimiento, no un documento del workspace`;
  if (target.endsWith(".md")) {
    return `el documento '${path}' no existe en el workspace o no es un documento (un .md necesita frontmatter con '---')`;
  }
  return `el documento '${path}' no existe en el workspace`;
}

/** Post-orden DFS sobre `use`: dependencias primero, `root` al final. Los ciclos se cortan por visitado. */
function reachable(root: DocumentUri, uses: Map<DocumentUri, DocumentUri[]>): DocumentUri[] {
  const order: DocumentUri[] = [];
  const visited = new Set<DocumentUri>();
  const visit = (uri: DocumentUri): void => {
    if (visited.has(uri)) return;
    visited.add(uri);
    for (const dependency of uses.get(uri) ?? []) visit(dependency);
    order.push(uri);
  };
  visit(root);
  return order;
}

function resolveBlocks(document: ParsedDocument, catalog: Catalog, entities: Catalog, diagnostics: Diagnostic[]): void {
  const blockNames = new Set<string>();
  for (const block of document.blocks) {
    if (blockNames.has(block.name)) {
      diagnostics.push(diagnosticAt("E033", `el bloque '${block.name}' ya fue declarado`, block.nameRange));
    }
    blockNames.add(block.name);

    for (const edge of block.edges) {
      for (const ref of [edge.from, edge.to]) {
        ref.target = catalog.has(ref.name) ? ref.name : null;
        if (ref.target === null) diagnostics.push(diagnosticAt("E030", unresolvedMessage(ref.name, entities), ref.range));
      }
    }
  }
}

function unresolvedMessage(name: string, entities: Catalog): string {
  const elsewhere = entities.get(name);
  return elsewhere
    ? `la entidad '${name}' está declarada en '${elsewhere.uri}', que este documento no alcanza; añade un 'use' a ese archivo`
    : `la entidad '${name}' no está declarada; añade 'entity ${name}'`;
}
