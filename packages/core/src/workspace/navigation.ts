import type { DocumentUri, EntityId, ParsedDocument, Position, Range } from "../ast.js";
import { isIdentifier } from "../parser/yaml.js";
import { relationPath } from "./knowledge.js";
import { push } from "./xref.js";
import type { LinkResult } from "./workspace.js";

export interface TextEdit {
  range: Range;
  text: string;
}

export type RenameResult = { edits: Map<DocumentUri, TextEdit[]> } | { error: string };

// Escalares que YAML (1.1 o 1.2) leería como null o booleano: en un .md el
// id nuevo va entre comillas para seguir siendo string (pendiente K1 → F).
const YAML_NON_STRING = /^(null|true|false|yes|no|on|off|y|n)$/i;

function before(a: Position, b: Position): boolean {
  return a.line < b.line || (a.line === b.line && a.column < b.column);
}

// El fin es exclusivo, pero el cursor justo después del id también lo nombra.
function touches(range: Range, position: Position): boolean {
  return !before(position, range.start) && !before(range.end, position);
}

/**
 * La entidad nombrada en `position` (decisión #39): una declaración, el
 * target de una relación resuelta a entidad o una referencia resuelta de un
 * bloque. Null en una referencia sin resolver o fuera de un nombre. Usa los
 * `Ref.target` del último `link()`.
 */
export function entityAt(document: ParsedDocument, position: Position): EntityId | null {
  for (const entity of document.entities) {
    if (touches(entity.nameRange, position)) return entity.id;
    for (const relation of entity.knowledge?.relations ?? []) {
      if (relation.resolved?.kind === "entity" && touches(relation.range, position)) return relation.resolved.id;
    }
  }
  for (const block of document.blocks) {
    for (const edge of block.edges) {
      for (const ref of [edge.from, edge.to]) {
        if (ref.target !== null && touches(ref.range, position)) return ref.target;
      }
    }
  }
  return null;
}

/**
 * Ediciones para renombrar `id` en todo el workspace (decisión #39): la
 * declaración ganadora, las relaciones en forma id de los `.md` ganadores y
 * las referencias resueltas de los bloques — lo mismo que `definitionOf` y
 * `referencesTo`. Una ruta a `.md` en `relations` no escribe el id y no se
 * toca (#30).
 */
export function renameEntity(link: LinkResult, id: EntityId, newId: string): RenameResult {
  const declaration = link.entities.get(id);
  if (!declaration) return { error: `no existe la entidad '${id}'` };
  if (!isIdentifier(newId)) {
    return { error: `'${newId}' no es un identificador: letras, dígitos y '_', sin empezar con dígito` };
  }
  const edits = new Map<DocumentUri, TextEdit[]>();
  if (newId === id) return { edits };
  if (link.entities.has(newId)) return { error: `ya existe una entidad '${newId}'` };

  const yaml = YAML_NON_STRING.test(newId) ? `"${newId}"` : newId;
  push(edits, declaration.uri, { range: declaration.nameRange, text: declaration.knowledge ? yaml : newId });
  for (const { document } of link.documents.values()) {
    for (const entity of document.entities) {
      if (!entity.knowledge || link.entities.get(entity.id) !== entity) continue;
      for (const relation of entity.knowledge.relations) {
        const named = relation.resolved?.kind === "entity" && relation.resolved.id === id;
        if (named && relationPath(relation.target) === null) push(edits, document.uri, { range: relation.range, text: yaml });
      }
    }
    for (const block of document.blocks) {
      for (const edge of block.edges) {
        for (const ref of [edge.from, edge.to]) {
          if (ref.target === id) push(edits, document.uri, { range: ref.range, text: newId });
        }
      }
    }
  }

  for (const list of edits.values()) {
    list.sort((a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column);
  }
  return { edits };
}
