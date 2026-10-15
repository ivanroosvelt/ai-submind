// Auto-layout of class diagrams (DEC-017, REQ-028, ENT-005): the graph of shown nodes and relationships, and
// dagre (@dagrejs/dagre) over the shape sizes of size.ts. Pure and DOM-free: used by the UI for nodes without
// a position and by the MCP tool `auto_layout_diagram`, which persists the result.
import * as dagreModule from "@dagrejs/dagre";
import type { Layout, LayoutEdge, LayoutNode } from "../format/types.js";
import { NODE_TYPES, nodeBox, type NameOf, type NodeBox, type NodeType } from "./size.js";

/** Relationship types drawn as links in a class diagram (spec §6.6). */
export const EDGE_TYPES = ["association", "generalization", "dependency", "realization"] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

/** A shown element as resolved from the diagram (query `diagram`, API-002 `GET /api/diagram`). */
export interface DiagramElement {
  id: string;
  type: string;
  node: unknown;
}

export interface GraphNode extends NodeBox {
  id: string;
  type: NodeType;
  node: unknown;
}

/** `source` → `target` in UML reading: whole → part, child → parent, client → supplier. */
export interface GraphEdge {
  id: string;
  type: EdgeType;
  source: string;
  target: string;
  node: unknown;
}

export interface ClassGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** What auto-layout needs from a diagram (the shape of the query's diagram view). */
export interface DiagramInput {
  diagram: { id: string };
  elements: readonly DiagramElement[];
  /** Names of referenced elements by ID. */
  names: Readonly<Record<string, string>>;
  layout: Layout | null;
  /** Format version written in a new layout. */
  formatVersion: string;
}

// ponytail: @dagrejs/dagre 3.1.1 ships declarations with extensionless relative imports that do not resolve
// under NodeNext (its types become `any`), so the subset used here is typed by hand.
interface DagreGraph {
  setGraph(label: Record<string, number | string>): void;
  setDefaultEdgeLabel(label: () => object): void;
  setNode(id: string, label: { width: number; height: number }): void;
  hasNode(id: string): boolean;
  setEdge(source: string, target: string, label: object, name: string): void;
  node(id: string): { x: number; y: number };
}
const { Graph, layout: dagre } = dagreModule as unknown as {
  Graph: new (options: { multigraph: boolean }) => DagreGraph;
  layout: (graph: DagreGraph) => void;
};

/** dagre spacing in px; `gap` separates newly placed nodes from those that keep their position. */
export const SPACING = { nodesep: 60, ranksep: 80, edgesep: 20, margin: 20, gap: 80 } as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const ref = (v: unknown): string => (isObj(v) && typeof v.idref === "string" ? v.idref : "");
const byId = <T extends { id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

function ends(type: EdgeType, n: Obj): [string, string] {
  switch (type) {
    case "association":
      return [isObj(n.end1) ? ref(n.end1.element) : "", isObj(n.end2) ? ref(n.end2.element) : ""];
    case "generalization":
      return [ref(n.specific), ref(n.general)];
    default:
      return [ref(n.client), ref(n.supplier)];
  }
}

/** Nodes and links of a class diagram, sorted by ID; links whose ends are not both shown are left out. */
export function classGraph(elements: readonly DiagramElement[], nameOf: NameOf): ClassGraph {
  const sorted = [...elements].sort(byId);
  const nodes: GraphNode[] = [];
  for (const e of sorted) {
    const type = NODE_TYPES.find((t) => t === e.type);
    if (type) nodes.push({ id: e.id, type, node: e.node, ...nodeBox(type, e.node, nameOf) });
  }
  const shown = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];
  for (const e of sorted) {
    const type = EDGE_TYPES.find((t) => t === e.type);
    if (!type || !isObj(e.node)) continue;
    const [source, target] = ends(type, e.node);
    if (shown.has(source) && shown.has(target)) {
      edges.push({ id: e.id, type, source, target, node: e.node });
    }
  }
  return { nodes, edges };
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Size a node is drawn and laid out with: an explicit `width`/`height` in its layout entry is a minimum,
 * so content is never clipped (spec §8).
 */
export function boxSize(content: Size, entry: LayoutNode | undefined): Size {
  return {
    width: Math.max(content.width, entry?.width ?? 0),
    height: Math.max(content.height, entry?.height ?? 0),
  };
}

/** Top-left corners of `nodes` laid out by dagre, from (margin, margin). */
function place(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  size: (n: GraphNode) => Size,
): Map<string, { x: number; y: number }> {
  const g = new Graph({ multigraph: true });
  g.setGraph({
    rankdir: "TB",
    nodesep: SPACING.nodesep,
    ranksep: SPACING.ranksep,
    edgesep: SPACING.edgesep,
    marginx: SPACING.margin,
    marginy: SPACING.margin,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, size(n));
  for (const e of edges) {
    if (!g.hasNode(e.source) || !g.hasNode(e.target)) continue;
    // Parents and suppliers of a realization above: dagre ranks the source of an edge first.
    const up = e.type === "generalization" || e.type === "realization";
    g.setEdge(up ? e.target : e.source, up ? e.source : e.target, {}, e.id);
  }
  dagre(g);
  const out = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id);
    const s = size(n);
    out.set(n.id, { x: Math.round(p.x - s.width / 2), y: Math.round(p.y - s.height / 2) });
  }
  return out;
}

/**
 * Layout document of a class diagram laid out by dagre. Every shown node is placed; explicit sizes and
 * styles of the previous layout are kept, link vertices are dropped (straight links) and entries of
 * elements no longer shown are left out. With `keep`, nodes that already have a position keep their entry
 * as is and only the others are laid out, below them, with the previous link entries kept.
 */
export function autoLayout(view: DiagramInput, options: { keep?: boolean } = {}): Layout {
  const nameOf: NameOf = (id) => (Object.hasOwn(view.names, id) ? view.names[id] : undefined);
  const g = classGraph(view.elements, nameOf);
  const prev = view.layout?.nodes ?? {};
  const prevEdges = view.layout?.edges ?? {};
  const old = (id: string): LayoutNode | undefined =>
    Object.hasOwn(prev, id) ? prev[id] : undefined;
  const size = (n: GraphNode): Size => boxSize(n, old(n.id));
  const keep = options.keep === true;
  const fixed = keep ? g.nodes.filter((n) => old(n.id) !== undefined) : [];
  const free = g.nodes.filter((n) => !fixed.includes(n));
  const placed = place(free, g.edges, size);
  let dx = 0;
  let dy = 0;
  if (fixed.length > 0) {
    dx = Math.min(...fixed.map((n) => old(n.id)?.x ?? 0)) - SPACING.margin;
    dy =
      Math.max(...fixed.map((n) => (old(n.id)?.y ?? 0) + size(n).height)) +
      SPACING.gap -
      SPACING.margin;
  }

  // Object.fromEntries keeps an ID `__proto__` as a key (an assignment would set the prototype).
  const nodes = Object.fromEntries(
    g.nodes.map((n): [string, LayoutNode] => {
      const before = old(n.id);
      if (before && keep) return [n.id, before];
      const p = placed.get(n.id) ?? { x: 0, y: 0 };
      const entry: LayoutNode = { x: p.x + dx, y: p.y + dy };
      if (before?.width !== undefined) entry.width = before.width;
      if (before?.height !== undefined) entry.height = before.height;
      if (before?.style !== undefined) entry.style = before.style;
      return [n.id, entry];
    }),
  );
  const edges = Object.fromEntries(
    g.edges.flatMap((e): [string, LayoutEdge][] => {
      const before = Object.hasOwn(prevEdges, e.id) ? prevEdges[e.id] : undefined;
      if (before && keep) return [[e.id, before]];
      return before?.style !== undefined ? [[e.id, { style: before.style }]] : [];
    }),
  );
  const out: Layout = {
    format_version: view.layout?.format_version ?? view.formatVersion,
    diagram: { idref: view.diagram.id },
    nodes,
  };
  if (Object.keys(edges).length > 0) out.edges = edges;
  return out;
}
