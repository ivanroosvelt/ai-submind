import type { DiagramBlock, NodeShape, Ref } from "../ast.js";
import type { Catalog } from "../workspace/resolver.js";

export interface BlockNode {
  id: string;
  label: string;
  shape: NodeShape;
  resolved: boolean;
}

/**
 * Nodos de un bloque, derivados de sus aristas (el bloque no declara nodos).
 * Las entidades resueltas van en orden de declaración del catálogo, así el
 * orden no depende de qué arista las nombra primero; las no resueltas
 * (E030) van al final, en orden de aparición, como placeholder con su
 * nombre como label.
 */
export function blockNodes(block: DiagramBlock, catalog: Catalog): BlockNode[] {
  const referenced = new Set<string>();
  const unresolved: string[] = [];
  for (const edge of block.edges) {
    for (const ref of [edge.from, edge.to]) {
      if (ref.target !== null) referenced.add(ref.target);
      else if (!unresolved.includes(ref.name)) unresolved.push(ref.name);
    }
  }

  const nodes: BlockNode[] = [];
  for (const entity of catalog.values()) {
    if (referenced.has(entity.id)) {
      nodes.push({ id: entity.id, label: entity.label, shape: entity.shape, resolved: true });
    }
  }
  for (const name of unresolved) {
    nodes.push({ id: name, label: name, shape: "rectangle", resolved: false });
  }
  return nodes;
}

/**
 * Id de nodo de un extremo de arista: la entidad resuelta, o el nombre
 * escrito si no resolvió (placeholder). Decisión #15.
 */
export function nodeId(ref: Ref): string {
  return ref.target ?? ref.name;
}
