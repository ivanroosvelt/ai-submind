// Query facade (FEAT-004, PLAN-002 S6): structural and lexical queries over an engine, with results
// computed once per engine generation and a lexical index kept up to date from change events.
import { compareCodeUnits } from "../format/canonical.js";
import { isLoaded, type DocumentStatus } from "../format/document.js";
import type { Finding } from "../format/findings.js";
import type { IndexedElement } from "../format/semantic.js";
import { SUPPORTED_VERSION } from "../format/schema.js";
import type { ElementType } from "../format/semantic.js";
import type { Diagram, Layout, Model } from "../format/types.js";
import type { ChangeEvent, Engine } from "../engine/engine.js";
import { invalid } from "./errors.js";
import {
  compareElements,
  compileFilter,
  resolveId,
  summarize,
  type ElementSummary,
  type FindFilter,
} from "./filters.js";
import { EDGE_KINDS, Graph, type Edge, type EdgeKind } from "./graph.js";
import { LexicalIndex, type Field } from "./lexical.js";
import {
  boolArg,
  checkArgs,
  LIMITS,
  listOf,
  oneOf,
  pageOf,
  SEARCH_TEXT,
  type PageArgs,
  type QueryPage,
} from "./limits.js";
import { metaOf, type QueryMeta, type QueryResult } from "./meta.js";
import { tokenize } from "./text.js";
import {
  impact,
  paths,
  type ImpactArgs,
  type ImpactResult,
  type PathArgs,
  type PathResult,
} from "./traverse.js";

export interface ModelInfo {
  /** Model ID; for a model that is not loaded, the file name without `.json`. */
  id: string;
  name?: string;
  file: string;
  status: DocumentStatus;
  loaded: boolean;
  /** No error finding in the model file. */
  valid: boolean;
  errors: number;
  warnings: number;
  /** Elements of the model, without the model itself and its diagrams. */
  elements: number;
  diagrams: number;
}

export interface DiagramInfo {
  id: string;
  name: string;
  kind: Diagram["kind"];
  model: string;
  file: string;
  layout: { path: string; status: DocumentStatus } | null;
  /** No error finding under the diagram nor in its layout. */
  valid: boolean;
  errors: number;
  warnings: number;
  /** Entries of the diagram's `elements`. */
  elements: number;
}

export interface ElementDetail extends ElementSummary {
  /** Package that has the element as a member. */
  package?: string;
  /** IDs whose structural container is this element, sorted. */
  children: string[];
  /** Content of the element as loaded. */
  node: unknown;
  /** Its document is loaded read-only. */
  readOnly: boolean;
}

/** A diagram with what is needed to draw it (API-002 `GET /api/diagram`, MCP `auto_layout_diagram`). */
export interface DiagramView {
  diagram: Diagram;
  model: string;
  file: string;
  /** Shown elements that exist, in the diagram's order (the first occurrence of a duplicated ID). */
  elements: { id: string; type: ElementType; node: unknown }[];
  /** Names of the shown elements and of every element they reference, by ID. */
  names: Record<string, string>;
  /** The diagram's layout as loaded, or `null` if it has none (or it is not loaded). */
  layout: Layout | null;
  /** Format version a new layout is written with. */
  formatVersion: string;
}

export type RelationGroup =
  | "association"
  | "generalization"
  | "dependency"
  | "realization"
  | "ownership"
  | "diagram"
  | "typing"
  | "sequence";

export const RELATION_GROUPS: readonly RelationGroup[] = [
  "association",
  "generalization",
  "dependency",
  "realization",
  "ownership",
  "diagram",
  "typing",
  "sequence",
];

export interface RelationsArgs extends PageArgs {
  /** Default: `both`. */
  direction?: "out" | "in" | "both";
  kinds?: readonly EdgeKind[];
  keys?: readonly string[];
  /** Edges in any of these groups (REQ-017). */
  groups?: readonly RelationGroup[];
}

export type Relation = Edge & { direction: "out" | "in" };

export interface SearchArgs {
  /** `any` (default): some term matches; `all`: every term matches. */
  mode?: "any" | "all";
  /** Query terms of 3+ characters also match as prefixes. Default: true. */
  prefix?: boolean;
}

export type SearchHit = ElementSummary & { score: number; fields: Field[]; terms: string[] };

const TYPING_KEYS = new Set(["type", "return_type", "exceptions"]);
const SEQUENCE_KEYS = new Set([
  "represents",
  "send_event",
  "receive_event",
  "signature",
  "covered",
  "interaction",
  "start",
  "finish",
]);

/** Share of documents touched by pending changes above which the lexical index is rebuilt. */
const REBUILD_RATIO = 0.3;
/** Pending change events kept for the incremental lexical update; beyond it the index is rebuilt. */
export const MAX_PENDING = 64;

const keys = (...lists: readonly string[][]): ReadonlySet<string> => new Set(lists.flat());
const PAGE_KEYS = ["offset", "limit"];
const FIND_KEYS = [
  "type",
  "model",
  "package",
  "diagram",
  "owner",
  "interaction",
  "name",
  "match",
  "tags",
  "stereotypes",
  "hasCodeRef",
  "codeRefPath",
  "hasDocumentation",
  "visibility",
];
/** Arguments accepted by each operation (DEC-012). */
const ARGS = {
  listModels: keys(PAGE_KEYS),
  listDiagrams: keys(PAGE_KEYS, ["model", "kind"]),
  find: keys(PAGE_KEYS, FIND_KEYS),
  relations: keys(PAGE_KEYS, ["direction", "kinds", "keys", "groups"]),
  impact: keys(["direction", "maxDepth", "kinds", "limit"]),
  paths: keys(["directed", "mode", "maxLength", "maxPaths", "kinds", "throughHubs"]),
  search: keys(PAGE_KEYS, FIND_KEYS, ["mode", "prefix"]),
};

interface Snapshot {
  generation: number;
  graph: Graph;
  meta: QueryMeta;
}

export function createQuery(engine: Engine): Query {
  return new Query(engine);
}

export class Query {
  private snapshot: Snapshot | undefined;
  private readonly lexical = new LexicalIndex();
  /** Generation the lexical index reflects; -1 = never built. */
  private lexicalGeneration = -1;
  private pending: { generation: number; event: ChangeEvent }[] = [];
  private readonly onChange = (event: ChangeEvent): void => {
    // Without an index, or with too many pending diffs, the next search rebuilds anyway: dropping the
    // events keeps memory bounded, and the contiguity check in syncLexical forces that rebuild.
    if (this.lexicalGeneration < 0 || this.pending.length >= MAX_PENDING) {
      this.pending = [];
      return;
    }
    this.pending.push({ generation: this.engine.generation, event });
  };

  /** Pending change events (bounded by `MAX_PENDING`; exposed for tests). */
  get pendingEvents(): number {
    return this.pending.length;
  }

  constructor(private readonly engine: Engine) {
    engine.on("change", this.onChange);
  }

  /** Stops listening to the engine. */
  dispose(): void {
    this.engine.off("change", this.onChange);
    this.pending = [];
  }

  listModels(args: PageArgs = {}): QueryResult<QueryPage<ModelInfo>> {
    checkArgs(args, ARGS.listModels);
    const { graph: g, meta } = this.current();
    const findings = this.findingsByFile();
    const models: ModelInfo[] = [];
    for (const doc of g.documents.values()) {
      if (doc.kind !== "model") continue;
      const loaded =
        doc.data !== undefined && (doc.status === "writable" || doc.status === "read_only");
      const data = loaded ? (doc.data as Model) : undefined;
      const count = { elements: 0, diagrams: 0 };
      for (const list of g.byId.values()) {
        for (const x of list) {
          if (x.file !== doc.path || x.type === "model") continue;
          if (x.type === "diagram") count.diagrams++;
          else count.elements++;
        }
      }
      const { errors, warnings } = countFindings(findings.get(doc.path) ?? []);
      const info: ModelInfo = {
        id: data?.id ?? doc.path.replace(/^models\//, "").replace(/\.json$/, ""),
        file: doc.path,
        status: doc.status,
        loaded,
        valid: errors === 0,
        errors,
        warnings,
        ...count,
      };
      if (data !== undefined && typeof data.name === "string") info.name = data.name;
      models.push(info);
    }
    models.sort((a, b) => compareCodeUnits(a.id, b.id) || compareCodeUnits(a.file, b.file));
    return { data: pageOf(models, args, LIMITS.list), meta };
  }

  listDiagrams(
    args: { model?: string; kind?: "class" | "sequence" } & PageArgs = {},
  ): QueryResult<QueryPage<DiagramInfo>> {
    checkArgs(args, ARGS.listDiagrams);
    const { graph: g, meta } = this.current();
    const model = args.model === undefined ? undefined : resolveId(g, args.model, "model");
    if (model && model.type !== "model") throw invalid("model", `${model.id} is a ${model.type}`);
    const kind =
      args.kind === undefined
        ? undefined
        : oneOf("kind", args.kind, ["class", "sequence"], "class");
    const findings = this.findingsByFile();
    const out: DiagramInfo[] = [];
    for (const list of g.byId.values()) {
      for (const x of list) {
        if (x.type !== "diagram" || (model && x.file !== model.file)) continue;
        const d = x.node as Diagram;
        if (kind !== undefined && d.kind !== kind) continue;
        const ptr = g.original(x.file, x.pointer);
        const own = (findings.get(x.file) ?? []).filter(
          (f) => f.pointer === ptr || f.pointer.startsWith(`${ptr}/`),
        );
        const path = `layout/${d.id}.json`;
        const layoutDoc = g.documents.get(path);
        const { errors, warnings } = countFindings([...own, ...(findings.get(path) ?? [])]);
        out.push({
          id: d.id,
          name: d.name,
          kind: d.kind,
          model: g.modelOfFile.get(x.file) ?? "",
          file: x.file,
          layout: layoutDoc ? { path, status: layoutDoc.status } : null,
          valid: errors === 0,
          errors,
          warnings,
          elements: d.elements?.length ?? 0,
        });
      }
    }
    out.sort((a, b) => compareCodeUnits(a.id, b.id) || compareCodeUnits(a.file, b.file));
    return { data: pageOf(out, args, LIMITS.list), meta };
  }

  /** Element by ID: `NOT_FOUND`, or `AMBIGUOUS_ID` with every location. */
  get(id: string): QueryResult<ElementDetail> {
    const { graph: g, meta } = this.current();
    const el = resolveId(g, id);
    const detail: ElementDetail = {
      ...summarize(g, el),
      children: [...g.children(el.id)],
      node: el.node,
      readOnly: g.documents.get(el.file)?.status === "read_only",
    };
    const pkg = g.incoming(el.id).find((e) => e.kind === "member");
    if (pkg) detail.package = pkg.from;
    return { data: detail, meta };
  }

  /** Diagram by ID with its shown elements resolved: `NOT_FOUND`, `AMBIGUOUS_ID`, `INVALID_ARGUMENT`. */
  diagram(id: string): QueryResult<DiagramView> {
    const { graph: g, meta } = this.current();
    const el = resolveId(g, id);
    if (el.type !== "diagram") throw invalid("id", `${el.id} is a ${el.type}`);
    const diagram = el.node as Diagram;
    const elements: DiagramView["elements"] = [];
    const names = new Map<string, string>();
    const name = (target: string): void => {
      const node = g.byId.get(target)?.[0]?.node as { name?: unknown } | undefined;
      if (typeof node?.name === "string") names.set(target, node.name);
    };
    const refs = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(refs);
      else if (typeof v === "object" && v !== null) {
        const idref = (v as { idref?: unknown }).idref;
        if (typeof idref === "string") name(idref);
        else Object.values(v).forEach(refs);
      }
    };
    for (const r of diagram.elements ?? []) {
      const x = g.byId.get(r.idref)?.[0];
      if (!x) continue;
      elements.push({ id: x.id, type: x.type, node: x.node });
      name(x.id);
      refs(x.node);
    }
    const doc = this.engine.document(`layout/${diagram.id}.json`);
    const layout = doc && isLoaded(doc) ? (doc.data as Layout) : null;
    return {
      data: {
        diagram,
        model: g.modelOfFile.get(el.file) ?? "",
        file: el.file,
        elements,
        names: Object.fromEntries([...names].sort(([a], [b]) => compareCodeUnits(a, b))),
        layout,
        formatVersion: SUPPORTED_VERSION,
      },
      meta,
    };
  }

  /** Elements that satisfy every condition, by ID. */
  find(filter: FindFilter & PageArgs = {}): QueryResult<QueryPage<ElementSummary>> {
    checkArgs(filter, ARGS.find);
    const { graph: g, meta } = this.current();
    const accept = compileFilter(g, filter);
    const found: IndexedElement[] = [];
    for (const list of g.byId.values()) for (const x of list) if (accept(x)) found.push(x);
    found.sort(compareElements);
    const page = pageOf(found, filter, LIMITS.find);
    return { data: { ...page, items: page.items.map((x) => summarize(g, x)) }, meta };
  }

  /** Edges that leave (`out`) or reach (`in`) an element, outgoing first. */
  relations(id: string, args: RelationsArgs = {}): QueryResult<QueryPage<Relation>> {
    checkArgs(args, ARGS.relations);
    const { graph: g, meta } = this.current();
    const el = resolveId(g, id);
    const direction = oneOf("direction", args.direction, ["out", "in", "both"], "both");
    const kinds = listOf("kinds", args.kinds, EDGE_KINDS);
    const keys = listOf("keys", args.keys);
    const groups = listOf("groups", args.groups, RELATION_GROUPS);
    const keep = (e: Edge): boolean =>
      (!kinds || kinds.has(e.kind)) &&
      (!keys || (e.key !== undefined && keys.has(e.key))) &&
      (!groups || [...groups].some((gr) => inGroup(g, e, gr)));
    const out: Relation[] = [];
    if (direction !== "in") {
      for (const e of g.outgoing(el.id)) if (keep(e)) out.push({ ...e, direction: "out" });
    }
    if (direction !== "out") {
      for (const e of g.incoming(el.id)) if (keep(e)) out.push({ ...e, direction: "in" });
    }
    return { data: pageOf(out, args, LIMITS.relations), meta };
  }

  /** What depends on an element (or what it depends on), transitively. */
  impact(id: string, args: ImpactArgs = {}): QueryResult<ImpactResult> {
    checkArgs(args, ARGS.impact);
    const { graph: g, meta } = this.current();
    return { data: impact(g, resolveId(g, id).id, args), meta };
  }

  /** Simple paths between two elements. */
  paths(from: string, to: string, args: PathArgs = {}): QueryResult<PathResult> {
    checkArgs(args, ARGS.paths);
    const { graph: g, meta } = this.current();
    const a = resolveId(g, from, "from");
    const b = resolveId(g, to, "to");
    return { data: paths(g, a.id, b.id, args), meta };
  }

  /** Lexical search (BM25F) ranked by score; `filter` applies after ranking. */
  search(
    text: string,
    args: FindFilter & SearchArgs & PageArgs = {},
  ): QueryResult<QueryPage<SearchHit>> {
    checkArgs(args, ARGS.search);
    if (typeof text !== "string" || tokenize(text).length === 0) {
      throw invalid("text", "must contain at least one letter or digit");
    }
    if (text.length > SEARCH_TEXT.maxLength) {
      throw invalid("text", `must have at most ${String(SEARCH_TEXT.maxLength)} characters`);
    }
    if (new Set(tokenize(text)).size > SEARCH_TEXT.maxTerms) {
      throw invalid("text", `must have at most ${String(SEARCH_TEXT.maxTerms)} distinct terms`);
    }
    const { graph: g, meta } = this.current();
    const mode = oneOf("mode", args.mode, ["any", "all"], "any");
    const prefix = boolArg("prefix", args.prefix) ?? true;
    const accept = compileFilter(g, args);
    this.syncLexical(g);
    const hits: SearchHit[] = [];
    for (const h of this.lexical.search(text, { mode, prefix })) {
      const el = [...(g.byId.get(h.id) ?? [])].sort(compareElements).find(accept);
      if (el) hits.push({ ...summarize(g, el), score: h.score, fields: h.fields, terms: h.terms });
    }
    return { data: pageOf(hits, args, LIMITS.search), meta };
  }

  private current(): Snapshot {
    const generation = this.engine.generation;
    if (this.snapshot?.generation !== generation) {
      const docs = this.engine
        .status()
        .documents.flatMap((d) => this.engine.document(d.path) ?? []);
      this.snapshot = {
        generation,
        graph: new Graph(generation, docs),
        meta: metaOf(this.engine),
      };
    }
    return this.snapshot;
  }

  private findingsByFile(): Map<string, Finding[]> {
    const out = new Map<string, Finding[]>();
    for (const f of this.engine.status().findings) {
      const list = out.get(f.file);
      if (list) list.push(f);
      else out.set(f.file, [f]);
    }
    return out;
  }

  /**
   * Brings the lexical index to the graph's generation: applies the pending diffs when they cover every
   * generation since the last sync and touch few documents; rebuilds otherwise.
   */
  private syncLexical(g: Graph): void {
    if (this.lexicalGeneration === g.generation) return;
    const chain = this.pending.filter((p) => p.generation > this.lexicalGeneration);
    const contiguous =
      this.lexicalGeneration >= 0 &&
      chain.length === g.generation - this.lexicalGeneration &&
      chain.every((p, i) => p.generation === this.lexicalGeneration + i + 1);
    const touched = new Set(chain.flatMap((p) => p.event.diff.documents));
    if (!contiguous || touched.size > REBUILD_RATIO * g.documents.size) {
      this.lexical.rebuild(g.byId);
    } else {
      const ids = new Set<string>();
      for (const { event } of chain) {
        const d = event.diff;
        for (const id of [...d.added, ...d.removed, ...d.changed]) ids.add(id);
      }
      // `update` re-reads every ID from the lookup, so all of them can go as `changed`.
      this.lexical.update(
        { added: [], removed: [], changed: [...ids] },
        (id) => g.byId.get(id) ?? [],
      );
    }
    this.pending = this.pending.filter((p) => p.generation > g.generation);
    this.lexicalGeneration = g.generation;
  }
}

function countFindings(list: readonly Finding[]): { errors: number; warnings: number } {
  let errors = 0;
  for (const f of list) if (f.severity === "error") errors++;
  return { errors, warnings: list.length - errors };
}

/** Whether edge `e` belongs to relation group `group` (REQ-017). */
function inGroup(g: Graph, e: Edge, group: RelationGroup): boolean {
  switch (group) {
    case "ownership":
      return e.kind === "owns" || e.kind === "member";
    case "diagram":
      return e.kind === "shows";
    case "typing":
      return e.key !== undefined && TYPING_KEYS.has(e.key);
    case "sequence":
      return e.key !== undefined && SEQUENCE_KEYS.has(e.key);
    default: {
      if (e.kind === group) return true;
      if (e.kind !== "reference") return false;
      const source = g.typeOf(e.from);
      return source === group || (group === "association" && source === "association_end");
    }
  }
}
