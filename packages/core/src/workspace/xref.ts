import type { DocumentUri, EntityId, ParsedDocument, Range, Relation } from "../ast.js";
import { byUri, type Catalog } from "./resolver.js";
import { blockId } from "./uri.js";
import { relationPath } from "./knowledge.js";

import type { BlockId } from "../ast.js";
export type { BlockId };
export { blockId } from "./uri.js";

export interface Location {
  uri: DocumentUri;
  range: Range;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Índice de referencias cruzadas del workspace (spec §6.2). Se construye a
 * partir de referencias ya resueltas por `linkDocuments`; las no resueltas
 * (E030, E035) no entran. Inmutable: cada `link()` construye uno nuevo.
 */
export class XRefIndex {
  private readonly references = new Map<EntityId, Location[]>();
  private readonly blocksByEntity = new Map<EntityId, BlockId[]>();
  private readonly entitiesByBlock = new Map<BlockId, EntityId[]>();
  private readonly adjacent = new Map<EntityId, Set<EntityId>>();
  private readonly incoming = new Map<EntityId, { from: EntityId; relation: Relation }[]>();

  constructor(
    documents: ParsedDocument[],
    private readonly entities: Catalog
  ) {
    for (const document of [...documents].sort(byUri)) {
      // Relaciones de las declaraciones ganadoras; van antes que los bloques
      // porque el frontmatter está al principio del archivo.
      for (const entity of document.entities) {
        if (!entity.knowledge || this.entities.get(entity.id) !== entity) continue;
        for (const relation of entity.knowledge.relations) {
          if (relation.resolved?.kind !== "entity") continue;
          push(this.incoming, relation.resolved.id, { from: entity.id, relation });
          // Solo la forma id escribe el id: es la que cuenta como referencia
          // (y la que renombrar edita, decisión #30).
          if (relationPath(relation.target) === null) {
            push(this.references, relation.resolved.id, { uri: document.uri, range: relation.range });
          }
        }
      }

      const seen = new Set<string>();
      for (const block of document.blocks) {
        const inBlock = new Set<EntityId>();
        for (const edge of block.edges) {
          for (const ref of [edge.from, edge.to]) {
            if (ref.target === null) continue;
            push(this.references, ref.target, { uri: document.uri, range: ref.range });
            inBlock.add(ref.target);
          }
          const { target: from } = edge.from;
          const { target: to } = edge.to;
          if (from !== null && to !== null && from !== to) {
            this.adjacentOf(from).add(to);
            this.adjacentOf(to).add(from);
          }
        }

        if (seen.has(block.name)) continue; // E033: para consultas de bloque gana el primero
        seen.add(block.name);
        const id = blockId(document.uri, block.name);
        this.entitiesByBlock.set(id, this.inCatalogOrder(inBlock));
        for (const entity of inBlock) push(this.blocksByEntity, entity, id);
      }
    }
  }

  definitionOf(id: EntityId): Location | null {
    const entity = this.entities.get(id);
    return entity ? { uri: entity.uri, range: entity.nameRange } : null;
  }

  referencesTo(id: EntityId): Location[] {
    return this.references.get(id) ?? [];
  }

  flowsUsing(id: EntityId): BlockId[] {
    return this.blocksByEntity.get(id) ?? [];
  }

  entitiesIn(block: BlockId): EntityId[] {
    return this.entitiesByBlock.get(block) ?? [];
  }

  neighbors(id: EntityId): EntityId[] {
    return this.inCatalogOrder(this.adjacent.get(id) ?? new Set());
  }

  /** Las relaciones que declara el `.md` de la entidad, resueltas o no. */
  relationsFrom(id: EntityId): Relation[] {
    return this.entities.get(id)?.knowledge?.relations ?? [];
  }

  /** Relaciones resueltas que apuntan a la entidad, en orden de documento. */
  relationsTo(id: EntityId): { from: EntityId; relation: Relation }[] {
    return this.incoming.get(id) ?? [];
  }

  private adjacentOf(id: EntityId): Set<EntityId> {
    let set = this.adjacent.get(id);
    if (!set) this.adjacent.set(id, (set = new Set()));
    return set;
  }

  // ponytail: recorre el catálogo entero por consulta; indexar posiciones si el workspace crece a miles de entidades
  private inCatalogOrder(ids: Set<EntityId>): EntityId[] {
    return [...this.entities.keys()].filter((id) => ids.has(id));
  }
}
