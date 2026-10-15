// Query graph (DEC-012): ownership, references and relation elements as edges where A→B means "A depends
// on B". Built lazily once per engine generation.
import { compareCodeUnits } from "../format/canonical.js";
import { isLoaded, originalPointer, type ParsedDocument } from "../format/document.js";
import {
  indexDocuments,
  type ElementType,
  type IndexedElement,
  type RefSite,
} from "../format/semantic.js";
import type { Model, Ref } from "../format/types.js";

export const EDGE_KINDS = [
  "owns",
  "member",
  "shows",
  "reference",
  "association",
  "generalization",
  "dependency",
  "realization",
] as const;

export type EdgeKind = (typeof EDGE_KINDS)[number];

export interface Edge {
  kind: EdgeKind;
  from: string;
  to: string;
  /** Key that holds the reference (`member`, `shows`, `reference`), e.g. `type` or `covered`. */
  key?: string;
  /** Relation element the edge is derived from (`association` … `realization`). */
  via?: string;
  /** `false` only for undirected associations, which are traversed both ways. */
  directed: boolean;
  /** Both ends exist in the loaded documents. */
  resolved: boolean;
  file: string;
  /** Pointer in the file as read: the child, the reference or the relation element. */
  pointer: string;
}

/** Element types that connect everything: only path endpoints unless `throughHubs` (DEC-012). */
export const HUB_TYPES: readonly ElementType[] = ["model", "diagram"];

const KIND_ORDER = new Map<EdgeKind, number>(EDGE_KINDS.map((k, i) => [k, i]));

/** Order of the edges seen from `end`: kind, other end, key, via, pointer. */
export function compareEdges(end: "from" | "to"): (a: Edge, b: Edge) => number {
  return (a, b) =>
    (KIND_ORDER.get(a.kind) ?? 0) - (KIND_ORDER.get(b.kind) ?? 0) ||
    compareCodeUnits(a[end], b[end]) ||
    compareCodeUnits(a.key ?? "", b.key ?? "") ||
    compareCodeUnits(a.via ?? "", b.via ?? "") ||
    compareCodeUnits(a.file, b.file) ||
    compareCodeUnits(a.pointer, b.pointer);
}

/** Occurrences in file and pointer order. */
export const compareLocations = (a: IndexedElement, b: IndexedElement): number =>
  compareCodeUnits(a.file, b.file) || compareCodeUnits(a.pointer, b.pointer);

/** Last segment of a reference pointer that is not an array index: the key that holds it. */
const keyOf = (ptr: string): string =>
  ptr
    .split("/")
    .filter((s) => !/^\d+$/.test(s))
    .at(-1) ?? "";

const RULE_KIND = (r: RefSite): EdgeKind =>
  r.rule === "member"
    ? "member"
    : r.rule === "class_diagram_element" || r.rule === "sequence_diagram_element"
      ? "shows"
      : "reference";

const push = <K, V>(map: Map<K, V[]>, key: K, value: V): void => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

interface Adjacency {
  out: Map<string, Edge[]>;
  in: Map<string, Edge[]>;
  children: Map<string, string[]>;
}

/** Elements, references and edges of the loaded documents at one engine generation. */
export class Graph {
  readonly byId: ReadonlyMap<string, readonly IndexedElement[]>;
  readonly refs: readonly RefSite[];
  /** Every document of knowledge/, loaded or not, by path. */
  readonly documents: ReadonlyMap<string, ParsedDocument>;
  /** Model ID of each loaded model file. */
  readonly modelOfFile: ReadonlyMap<string, string>;
  private adjacency: Adjacency | undefined;
  private allEdges: Edge[] | undefined;

  constructor(
    readonly generation: number,
    documents: Iterable<ParsedDocument>,
  ) {
    const docs = new Map<string, ParsedDocument>();
    for (const d of documents) docs.set(d.path, d);
    this.documents = docs;
    const loaded = [...docs.values()].filter(isLoaded);
    const { byId, refs } = indexDocuments(loaded);
    this.byId = byId;
    this.refs = refs;
    const models = new Map<string, string>();
    for (const d of loaded) {
      if (d.kind === "model" && d.data !== undefined) models.set(d.path, (d.data as Model).id);
    }
    this.modelOfFile = models;
  }

  /** Pointer of `ptr` (into the loaded data of `file`) in the file as read. */
  original(file: string, ptr: string): string {
    const doc = this.documents.get(file);
    return doc ? originalPointer(doc, ptr) : ptr;
  }

  /** Type of `id` (of its first occurrence), if it exists. */
  typeOf(id: string): ElementType | undefined {
    return this.byId.get(id)?.[0]?.type;
  }

  isHub(id: string): boolean {
    const t = this.typeOf(id);
    return t !== undefined && HUB_TYPES.includes(t);
  }

  /** Every edge, in construction order. */
  get edges(): readonly Edge[] {
    this.allEdges ??= this.buildEdges();
    return this.allEdges;
  }

  /** Edges that leave `id`, sorted by `compareEdges("to")`. */
  outgoing(id: string): readonly Edge[] {
    return this.adj().out.get(id) ?? [];
  }

  /** Edges that arrive at `id`, sorted by `compareEdges("from")`. */
  incoming(id: string): readonly Edge[] {
    return this.adj().in.get(id) ?? [];
  }

  /** IDs whose structural container is `id`, sorted. */
  children(id: string): readonly string[] {
    return this.adj().children.get(id) ?? [];
  }

  private adj(): Adjacency {
    if (this.adjacency) return this.adjacency;
    const out = new Map<string, Edge[]>();
    const inc = new Map<string, Edge[]>();
    for (const e of this.edges) {
      push(out, e.from, e);
      push(inc, e.to, e);
    }
    for (const list of out.values()) list.sort(compareEdges("to"));
    for (const list of inc.values()) list.sort(compareEdges("from"));
    const children = new Map<string, string[]>();
    for (const [id, list] of out) {
      const ids = new Set(list.filter((e) => e.kind === "owns").map((e) => e.to));
      if (ids.size > 0) children.set(id, [...ids].sort(compareCodeUnits));
    }
    this.adjacency = { out, in: inc, children };
    return this.adjacency;
  }

  private buildEdges(): Edge[] {
    const edges: Edge[] = [];
    const exists = (id: string): boolean => this.byId.has(id);
    for (const list of this.byId.values()) {
      for (const x of list) {
        const pointer = this.original(x.file, x.pointer);
        if (x.parent !== undefined) {
          edges.push({
            kind: "owns",
            from: x.parent,
            to: x.id,
            directed: true,
            resolved: true,
            file: x.file,
            pointer,
          });
        }
        const derived = derivedEnds(x);
        if (derived) {
          edges.push({
            kind: derived.kind,
            from: derived.from,
            to: derived.to,
            via: x.id,
            directed: derived.directed,
            resolved: exists(derived.from) && exists(derived.to),
            file: x.file,
            pointer,
          });
        }
      }
    }
    for (const r of this.refs) {
      if (r.source === undefined) continue; // layout references are not part of the graph
      edges.push({
        kind: RULE_KIND(r),
        from: r.source,
        to: r.idref,
        key: keyOf(r.pointer),
        directed: true,
        resolved: exists(r.idref),
        file: r.file,
        pointer: this.original(r.file, r.pointer),
      });
    }
    return edges;
  }
}

/** Ends of the edge derived from a relation element (spec §6.3), or `undefined` for other types. */
function derivedEnds(
  x: IndexedElement,
): { kind: EdgeKind; from: string; to: string; directed: boolean } | undefined {
  const n = x.node as Record<string, unknown>;
  const id = (v: unknown): string => (v as Ref | undefined)?.idref ?? "";
  switch (x.type) {
    case "generalization":
      return { kind: x.type, from: id(n.specific), to: id(n.general), directed: true };
    case "dependency":
    case "realization":
      return { kind: x.type, from: id(n.client), to: id(n.supplier), directed: true };
    case "association": {
      const end = (v: unknown): string => id((v as { element?: Ref } | undefined)?.element);
      return {
        kind: "association",
        from: end(n.end1),
        to: end(n.end2),
        directed: n.direction === "directed",
      };
    }
    default:
      return undefined;
  }
}
