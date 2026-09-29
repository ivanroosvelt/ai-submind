import type { DiagramBlock, EntityId, Range, Ref } from "../ast.js";
import { query, type QueryEdge } from "../workspace/query.js";
import type { LinkResult } from "../workspace/workspace.js";
import { renderBlock } from "./index.js";

export interface RenderedMap {
  svg: string;
  /** Las aristas de flujo del workspace, con los bloques que contienen cada una. */
  edges: QueryEdge[];
}

// El bloque sintético no tiene fuente: todos sus rangos apuntan a 1:1.
const NO_RANGE: Range = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

/**
 * Mapa agregado del sistema (spec §8, decisión #40): las aristas de flujo
 * de todo el workspace, una por par dirigido, dibujadas como un `flow` sobre
 * el catálogo global. Las relaciones de `.md` no entran (vista de grafo, K4).
 */
export function renderMap(link: LinkResult): RenderedMap {
  const edges = query(link).edges.filter((edge) => edge.type === "flow");
  const ref = (id: EntityId): Ref => ({ name: id, range: NO_RANGE, target: id });
  const block: DiagramBlock = {
    kind: "flow",
    name: "mapa",
    title: null,
    edges: edges.map((edge) => ({ from: ref(edge.from), to: ref(edge.to), label: null, range: NO_RANGE })),
    range: NO_RANGE,
    nameRange: NO_RANGE,
  };
  return { svg: renderBlock(block, link.entities, "").svg, edges };
}
