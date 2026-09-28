import type { DiagramBlock, NodeShape, Range, Ref } from "../ast.js";
import type { Catalog } from "../workspace/resolver.js";

export interface BlockNode {
  id: string;
  label: string;
  shape: NodeShape;
  resolved: boolean;
  /** Primera referencia al nodo dentro del bloque (no la declaración de la entidad). */
  range: Range;
}

/**
 * Nodos de un bloque, derivados de sus aristas (el bloque no declara nodos).
 * Las entidades resueltas van en orden de declaración del catálogo, así el
 * orden no depende de qué arista las nombra primero; las no resueltas
 * (E030) van al final, en orden de aparición, como placeholder con su
 * nombre como label.
 */
export function blockNodes(block: DiagramBlock, catalog: Catalog): BlockNode[] {
  const firstRef = new Map<string, Range>();
  const unresolved: string[] = [];
  for (const edge of block.edges) {
    for (const ref of [edge.from, edge.to]) {
      const id = nodeId(ref);
      if (firstRef.has(id)) continue;
      firstRef.set(id, ref.range);
      if (ref.target === null) unresolved.push(ref.name);
    }
  }

  const nodes: BlockNode[] = [];
  for (const entity of catalog.values()) {
    const range = firstRef.get(entity.id);
    if (range) nodes.push({ id: entity.id, label: entity.label, shape: entity.shape, resolved: true, range });
  }
  for (const name of unresolved) {
    nodes.push({ id: name, label: name, shape: "rectangle", resolved: false, range: firstRef.get(name)! });
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
