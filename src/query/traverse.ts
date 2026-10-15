// Transitive impact (REQ-018) and paths between elements (REQ-019) over the query graph (DEC-012).
import { compareCodeUnits } from "../format/canonical.js";
import type { ElementType } from "../format/semantic.js";
import { EDGE_KINDS, type Edge, type EdgeKind, type Graph } from "./graph.js";
import { nameOf } from "./filters.js";
import { boolArg, intArg, LIMITS, listOf, oneOf } from "./limits.js";

export type ImpactDirection = "dependents" | "dependencies" | "both";

export interface ImpactArgs {
  /** `dependents` (default): what depends on the root, following edges backwards. */
  direction?: ImpactDirection;
  /** Maximum depth (≥ 1); unlimited by default. */
  maxDepth?: number;
  kinds?: readonly EdgeKind[];
  /** Maximum number of items. */
  limit?: number;
}

export interface ImpactItem {
  id: string;
  type: ElementType;
  name?: string;
  depth: number;
  /** First edge that reached the element. */
  via: Edge;
}

export interface ImpactResult {
  root: string;
  /** Ordered by depth, then ID; the root is never included. */
  items: ImpactItem[];
  /** Files of the items and layouts of the diagrams reached, sorted. */
  files: string[];
  truncated: boolean;
  truncatedBy?: "limit" | "maxDepth";
}

export interface PathArgs {
  /** Follow edges only from→to (undirected associations both ways). Default: false. */
  directed?: boolean;
  /** `shortest` (default): only the shortest length with paths; `all`: every length up to `maxLength`. */
  mode?: "shortest" | "all";
  maxLength?: number;
  maxPaths?: number;
  kinds?: readonly EdgeKind[];
  /** Allow models and diagrams as intermediate steps. Default: false. */
  throughHubs?: boolean;
}

export interface GraphPath {
  nodes: string[];
  edges: Edge[];
}

export interface PathResult {
  paths: GraphPath[];
  truncated: boolean;
  truncatedBy?: "maxPaths" | "budget";
}

/** Maximum DFS steps of a path search, whatever the arguments. */
export const PATH_BUDGET = 200_000;

const IMPACT_DIRECTIONS: readonly ImpactDirection[] = ["dependents", "dependencies", "both"];

interface Step {
  to: string;
  edge: Edge;
}

/**
 * Steps from `id`: forwards along outgoing edges (`out`), backwards along incoming ones (`in`);
 * undirected edges always both ways. Unresolved edges are never followed.
 */
function steps(
  g: Graph,
  id: string,
  out: boolean,
  inc: boolean,
  kinds: ReadonlySet<EdgeKind> | undefined,
): Step[] {
  const list: Step[] = [];
  const ok = (e: Edge): boolean => e.resolved && (!kinds || kinds.has(e.kind));
  for (const e of g.incoming(id))
    if (ok(e) && (inc || !e.directed)) list.push({ to: e.from, edge: e });
  for (const e of g.outgoing(id))
    if (ok(e) && (out || !e.directed)) list.push({ to: e.to, edge: e });
  return list;
}

/** Breadth-first impact from `root` (which must exist). Terminates on cycles: each ID is visited once. */
export function impact(g: Graph, root: string, args: ImpactArgs = {}): ImpactResult {
  const direction = oneOf("direction", args.direction, IMPACT_DIRECTIONS, "dependents");
  const maxDepth = intArg("maxDepth", args.maxDepth, Number.MAX_SAFE_INTEGER, 1);
  const kinds = listOf("kinds", args.kinds, EDGE_KINDS);
  const limit = intArg("limit", args.limit, LIMITS.impact.default, 1, LIMITS.impact.max);
  const out = direction !== "dependents";
  const inc = direction !== "dependencies";

  const visited = new Set([root]);
  const items: ImpactItem[] = [];
  let truncatedBy: ImpactResult["truncatedBy"];
  let frontier = [root];
  for (let depth = 1; frontier.length > 0 && truncatedBy === undefined; depth++) {
    const next: ImpactItem[] = [];
    for (const id of frontier) {
      for (const s of steps(g, id, out, inc, kinds)) {
        if (visited.has(s.to)) continue;
        if (depth > maxDepth) {
          truncatedBy = "maxDepth";
          break;
        }
        // The whole level is collected (up to the hard maximum) and cut after sorting, so a result truncated
        // by `limit` is a prefix of the full one in (depth, id) order.
        if (items.length + next.length >= LIMITS.impact.max) {
          truncatedBy = "limit";
          break;
        }
        visited.add(s.to);
        const el = g.byId.get(s.to)?.[0];
        if (!el) continue;
        const item: ImpactItem = { id: s.to, type: el.type, depth, via: s.edge };
        const name = nameOf(el);
        if (name !== undefined) item.name = name;
        next.push(item);
      }
      if (truncatedBy !== undefined) break;
    }
    next.sort((a, b) => compareCodeUnits(a.id, b.id));
    if (items.length + next.length > limit) {
      next.length = limit - items.length;
      truncatedBy = "limit";
    }
    items.push(...next);
    frontier = next.map((x) => x.id);
  }

  const files = new Set<string>();
  for (const x of items) {
    for (const el of g.byId.get(x.id) ?? []) files.add(el.file);
    const layout = `layout/${x.id}.json`;
    if (x.type === "diagram" && g.documents.has(layout)) files.add(layout);
  }
  const result: ImpactResult = {
    root,
    items,
    files: [...files].sort(compareCodeUnits),
    truncated: truncatedBy !== undefined,
  };
  if (truncatedBy !== undefined) result.truncatedBy = truncatedBy;
  return result;
}

/**
 * Simple paths from `from` to `to` (both must exist), by iterative deepening over the length guided by
 * the distances to `to`. Neighbors in ID order; between two neighbors only the first edge is used.
 */
export function paths(g: Graph, from: string, to: string, args: PathArgs = {}): PathResult {
  const directed = boolArg("directed", args.directed) ?? false;
  const mode = oneOf("mode", args.mode, ["shortest", "all"] as const, "shortest");
  const maxLength = intArg(
    "maxLength",
    args.maxLength,
    LIMITS.pathLength.default,
    1,
    LIMITS.pathLength.max,
  );
  const maxPaths = intArg(
    "maxPaths",
    args.maxPaths,
    LIMITS.maxPaths.default,
    1,
    LIMITS.maxPaths.max,
  );
  const kinds = listOf("kinds", args.kinds, EDGE_KINDS);
  const throughHubs = boolArg("throughHubs", args.throughHubs) ?? false;

  if (from === to) return { paths: [{ nodes: [from], edges: [] }], truncated: false };

  const passable = (id: string): boolean => throughHubs || !g.isHub(id);
  const cache = new Map<string, Step[]>();
  /** Forward neighbors: one step per neighbor (the first edge in edge order), sorted by ID. */
  const forward = (id: string): Step[] => {
    let list = cache.get(id);
    if (!list) {
      const seen = new Map<string, Step>();
      for (const s of steps(g, id, true, !directed, kinds)) {
        if (s.to !== id && !seen.has(s.to)) seen.set(s.to, s);
      }
      list = [...seen.values()].sort((a, b) => compareCodeUnits(a.to, b.to));
      cache.set(id, list);
    }
    return list;
  };

  // Distances to `to` along reversed steps; hubs other than `to` are not expanded.
  const dist = new Map([[to, 0]]);
  const queue = [to];
  for (let i = 0; i < queue.length && i < PATH_BUDGET; i++) {
    const v = queue[i] ?? to;
    const d = dist.get(v) ?? 0;
    if (d >= maxLength || (v !== to && !passable(v))) continue;
    for (const s of steps(g, v, !directed, true, kinds)) {
      if (dist.has(s.to)) continue;
      dist.set(s.to, d + 1);
      queue.push(s.to);
    }
  }
  // A distance search cut by the budget may miss nodes: the result is then reported as truncated.
  const distCut = queue.length > PATH_BUDGET;
  const start = dist.get(from);
  if (start === undefined) {
    return distCut
      ? { paths: [], truncated: true, truncatedBy: "budget" }
      : { paths: [], truncated: false };
  }

  const found: GraphPath[] = [];
  let truncatedBy: PathResult["truncatedBy"];
  let visits = 0;
  const nodes = [from];
  const edges: Edge[] = [];
  const onPath = new Set([from]);
  const dfs = (v: string, length: number): void => {
    for (const s of forward(v)) {
      if (truncatedBy !== undefined) return;
      if (++visits > PATH_BUDGET) {
        truncatedBy = "budget";
        return;
      }
      const depth = edges.length + 1;
      if (onPath.has(s.to)) continue;
      if (s.to === to) {
        if (depth !== length) continue;
        if (found.length === maxPaths) {
          truncatedBy = "maxPaths";
          return;
        }
        found.push({ nodes: [...nodes, to], edges: [...edges, s.edge] });
        continue;
      }
      const rest = dist.get(s.to);
      if (rest === undefined || depth + rest > length || !passable(s.to)) continue;
      nodes.push(s.to);
      edges.push(s.edge);
      onPath.add(s.to);
      dfs(s.to, length);
      onPath.delete(s.to);
      edges.pop();
      nodes.pop();
    }
  };
  for (let length = start; length <= maxLength && truncatedBy === undefined; length++) {
    dfs(from, length);
    if (mode === "shortest" && found.length > 0) break;
  }
  if (distCut) truncatedBy ??= "budget";
  const result: PathResult = { paths: found, truncated: truncatedBy !== undefined };
  if (truncatedBy !== undefined) result.truncatedBy = truncatedBy;
  return result;
}
