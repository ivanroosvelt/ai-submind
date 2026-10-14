// Validation phase 4 (spec §10.1–§10.3): references, allowed types and semantic rules over the set of
// loaded knowledge/ documents.
import { finding, pointer, type Finding } from "./findings.js";
import { originalPointer, type ParsedDocument } from "./document.js";
import type {
  AssociationEnd,
  Elements,
  Fragment,
  Interaction,
  Layout,
  Model,
  Operation,
  Ref,
  StructuredClassifier,
} from "./types.js";

export type ElementType =
  | "model"
  | "diagram"
  | "package"
  | "actor"
  | "class"
  | "interface"
  | "data_type"
  | "enumeration"
  | "primitive_type"
  | "association"
  | "association_end"
  | "generalization"
  | "dependency"
  | "realization"
  | "interaction"
  | "attribute"
  | "operation"
  | "parameter"
  | "lifeline"
  | "message"
  | "occurrence"
  | "combined_fragment"
  | "interaction_use"
  | "operand";

/** Collections of `elements` and the type of their items (spec §6.3). */
export const COLLECTIONS = {
  packages: "package",
  actors: "actor",
  classes: "class",
  interfaces: "interface",
  data_types: "data_type",
  enumerations: "enumeration",
  primitive_types: "primitive_type",
  associations: "association",
  generalizations: "generalization",
  dependencies: "dependency",
  realizations: "realization",
  interactions: "interaction",
} as const satisfies Record<keyof Elements, ElementType>;

export interface IndexedElement {
  id: string;
  type: ElementType;
  file: string;
  pointer: string;
  node: unknown;
  /** Interaction that contains the element (lifelines, messages, fragments, operands). */
  interaction?: string;
}

type Rule =
  | "member"
  | "classifier"
  | "classifier_or_actor"
  | "generalization_end"
  | "realization_client"
  | "realization_supplier"
  | "any_element"
  | "occurrence_event"
  | "operation"
  | "covered"
  | "used_interaction"
  | "class_diagram_element"
  | "sequence_diagram_element"
  | "diagram";

export interface RefSite {
  idref: string;
  file: string;
  pointer: string;
  rule: Rule;
  /** Interaction that contains the reference, for the "same interaction" rules. */
  interaction?: string;
  /** Element that contains the reference (only `members`: the package). */
  owner?: string;
}

const CLASSIFIERS: readonly ElementType[] = [
  "class",
  "interface",
  "data_type",
  "enumeration",
  "primitive_type",
];
const RELATIONS: readonly ElementType[] = [
  "association",
  "generalization",
  "dependency",
  "realization",
];
const NODE_TYPES: readonly ElementType[] = ["package", "actor", ...CLASSIFIERS];

/** Types allowed by each key that holds references (spec §10.2). */
const ALLOWED: Record<Rule, readonly ElementType[] | ((t: ElementType) => boolean)> = {
  member: [...NODE_TYPES, ...RELATIONS, "interaction"],
  classifier: CLASSIFIERS,
  classifier_or_actor: [...CLASSIFIERS, "actor"],
  generalization_end: [...CLASSIFIERS, "actor"],
  realization_client: ["class", "data_type"],
  realization_supplier: ["interface"],
  any_element: (t) => t !== "model" && t !== "diagram",
  occurrence_event: ["occurrence"],
  operation: ["operation"],
  covered: ["lifeline"],
  used_interaction: ["interaction"],
  class_diagram_element: [...NODE_TYPES, ...RELATIONS],
  sequence_diagram_element: ["interaction"],
  diagram: ["diagram"],
};

const admits = (rule: Rule, t: ElementType): boolean => {
  const a = ALLOWED[rule];
  return typeof a === "function" ? a(t) : a.includes(t);
};

/** Index of IDs and reference sites of the loaded documents. */
export interface KnowledgeIndex {
  byId: Map<string, IndexedElement[]>;
  refs: RefSite[];
}

interface Multiplicity {
  value: string;
  file: string;
  pointer: string;
}

class Indexer {
  readonly byId = new Map<string, IndexedElement[]>();
  readonly refs: RefSite[] = [];
  readonly multiplicities: Multiplicity[] = [];

  constructor(private readonly file: string) {}

  add(id: string, type: ElementType, ptr: string, node: unknown, interaction?: string): void {
    const entry: IndexedElement = { id, type, file: this.file, pointer: ptr, node };
    if (interaction !== undefined) entry.interaction = interaction;
    const list = this.byId.get(id);
    if (list) list.push(entry);
    else this.byId.set(id, [entry]);
  }

  ref(
    r: Ref | null | undefined,
    ptr: string,
    rule: Rule,
    interaction?: string,
  ): RefSite | undefined {
    if (!r) return undefined;
    const site: RefSite = { idref: r.idref, file: this.file, pointer: ptr, rule };
    if (interaction !== undefined) site.interaction = interaction;
    this.refs.push(site);
    return site;
  }

  refList(list: Ref[] | undefined, ptr: string, rule: Rule, interaction?: string): RefSite[] {
    return (list ?? []).flatMap(
      (r, i) => this.ref(r, `${ptr}/${String(i)}`, rule, interaction) ?? [],
    );
  }

  multiplicity(value: string | null | undefined, ptr: string): void {
    if (typeof value === "string")
      this.multiplicities.push({ value, file: this.file, pointer: `${ptr}/multiplicity` });
  }

  model(m: Model): void {
    this.add(m.id, "model", "", m);
    const elements = m.elements ?? {};
    for (const [coll, type] of Object.entries(COLLECTIONS) as [keyof Elements, ElementType][]) {
      (elements[coll] ?? []).forEach((e, i) => {
        const p = pointer("elements", coll, i);
        this.add(e.id, type, p, e);
        this.element(type, e, p);
      });
    }
    (m.diagrams ?? []).forEach((d, i) => {
      const p = pointer("diagrams", i);
      this.add(d.id, "diagram", p, d);
      this.refList(
        d.elements,
        `${p}/elements`,
        d.kind === "class" ? "class_diagram_element" : "sequence_diagram_element",
      );
    });
  }

  layout(l: Layout): void {
    this.ref(l.diagram, "/diagram", "diagram");
  }

  private element(type: ElementType, e: unknown, p: string): void {
    switch (type) {
      case "package": {
        const pkg = e as { id: string; members?: Ref[] };
        for (const site of this.refList(pkg.members, `${p}/members`, "member")) site.owner = pkg.id;
        break;
      }
      case "class":
      case "interface":
      case "data_type":
        this.features(e as StructuredClassifier, p);
        break;
      case "association":
        for (const key of ["end1", "end2"] as const) {
          const end = (e as Record<typeof key, AssociationEnd>)[key];
          const ep = `${p}/${key}`;
          this.add(end.id, "association_end", ep, end);
          this.ref(end.element, `${ep}/element`, "classifier_or_actor");
          this.multiplicity(end.multiplicity, ep);
        }
        break;
      case "generalization": {
        const g = e as { specific: Ref; general: Ref };
        this.ref(g.specific, `${p}/specific`, "generalization_end");
        this.ref(g.general, `${p}/general`, "generalization_end");
        break;
      }
      case "dependency": {
        const d = e as { client: Ref; supplier: Ref };
        this.ref(d.client, `${p}/client`, "any_element");
        this.ref(d.supplier, `${p}/supplier`, "any_element");
        break;
      }
      case "realization": {
        const r = e as { client: Ref; supplier: Ref };
        this.ref(r.client, `${p}/client`, "realization_client");
        this.ref(r.supplier, `${p}/supplier`, "realization_supplier");
        break;
      }
      case "interaction":
        this.interaction(e as Interaction, p);
        break;
      default:
        break;
    }
  }

  private features(c: StructuredClassifier, p: string): void {
    (c.attributes ?? []).forEach((a, i) => {
      const ap = `${p}/attributes/${String(i)}`;
      this.add(a.id, "attribute", ap, a);
      this.ref(a.type, `${ap}/type`, "classifier");
      this.multiplicity(a.multiplicity, ap);
    });
    (c.operations ?? []).forEach((o: Operation, i) => {
      const op = `${p}/operations/${String(i)}`;
      this.add(o.id, "operation", op, o);
      this.ref(o.return_type, `${op}/return_type`, "classifier");
      this.refList(o.exceptions, `${op}/exceptions`, "classifier");
      (o.parameters ?? []).forEach((q, k) => {
        const qp = `${op}/parameters/${String(k)}`;
        this.add(q.id, "parameter", qp, q);
        this.ref(q.type, `${qp}/type`, "classifier");
        this.multiplicity(q.multiplicity, qp);
      });
    });
  }

  private interaction(x: Interaction, p: string): void {
    (x.lifelines ?? []).forEach((l, i) => {
      const lp = `${p}/lifelines/${String(i)}`;
      this.add(l.id, "lifeline", lp, l, x.id);
      this.ref(l.represents, `${lp}/represents`, "classifier_or_actor");
    });
    (x.messages ?? []).forEach((m, i) => {
      const mp = `${p}/messages/${String(i)}`;
      this.add(m.id, "message", mp, m, x.id);
      this.ref(m.send_event, `${mp}/send_event`, "occurrence_event", x.id);
      this.ref(m.receive_event, `${mp}/receive_event`, "occurrence_event", x.id);
      this.ref(m.signature, `${mp}/signature`, "operation");
    });
    this.fragments(x.fragments, `${p}/fragments`, x.id);
  }

  private fragments(list: Fragment[] | undefined, p: string, inter: string): void {
    (list ?? []).forEach((f, i) => {
      const fp = `${p}/${String(i)}`;
      this.add(f.id, f.type, fp, f, inter);
      switch (f.type) {
        case "occurrence":
          this.ref(f.covered, `${fp}/covered`, "covered", inter);
          break;
        case "combined_fragment":
          this.refList(f.covered, `${fp}/covered`, "covered", inter);
          f.operands.forEach((o, j) => {
            const op = `${fp}/operands/${String(j)}`;
            this.add(o.id, "operand", op, o, inter);
            this.fragments(o.fragments, `${op}/fragments`, inter);
          });
          break;
        case "interaction_use":
          this.refList(f.covered, `${fp}/covered`, "covered", inter);
          this.ref(f.interaction, `${fp}/interaction`, "used_interaction", inter);
          break;
      }
    });
  }
}

/**
 * Edges of a graph that belong to some cycle: both ends in the same strongly connected component
 * (iterative Tarjan) and a component with more than one node, or a self-loop.
 */
export function edgesInCycles<E extends { from: string; to: string }>(edges: readonly E[]): E[] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.from);
    if (list) list.push(e.to);
    else adj.set(e.from, [e.to]);
  }
  interface Visit {
    index: number;
    low: number;
    onStack: boolean;
    comp: number;
  }
  const visits = new Map<string, Visit>();
  const compSize: number[] = [];
  const stack: string[] = [];
  const visit = (v: string): Visit => {
    const x: Visit = { index: visits.size, low: visits.size, onStack: true, comp: -1 };
    visits.set(v, x);
    stack.push(v);
    return x;
  };
  for (const start of adj.keys()) {
    if (visits.has(start)) continue;
    const work: { v: string; x: Visit; next: number }[] = [{ v: start, x: visit(start), next: 0 }];
    for (let frame = work.at(-1); frame; frame = work.at(-1)) {
      const succ = adj.get(frame.v) ?? [];
      const w = succ[frame.next];
      if (w !== undefined) {
        frame.next++;
        const seen = visits.get(w);
        if (!seen) work.push({ v: w, x: visit(w), next: 0 });
        else if (seen.onStack) frame.x.low = Math.min(frame.x.low, seen.index);
        continue;
      }
      work.pop();
      const parent = work.at(-1);
      if (parent) parent.x.low = Math.min(parent.x.low, frame.x.low);
      if (frame.x.low === frame.x.index) {
        const c = compSize.length;
        let size = 0;
        for (let w2 = stack.pop(); w2 !== undefined; w2 = stack.pop()) {
          const y = visits.get(w2);
          if (y) {
            y.onStack = false;
            y.comp = c;
          }
          size++;
          if (w2 === frame.v) break;
        }
        compSize.push(size);
      }
    }
  }
  return edges.filter((e) => {
    const c = visits.get(e.from)?.comp;
    return (
      c !== undefined && c === visits.get(e.to)?.comp && (e.from === e.to || (compSize[c] ?? 0) > 1)
    );
  });
}

export function indexDocuments(
  docs: readonly ParsedDocument[],
): KnowledgeIndex & { multiplicities: Multiplicity[] } {
  const byId = new Map<string, IndexedElement[]>();
  const refs: RefSite[] = [];
  const multiplicities: Multiplicity[] = [];
  for (const d of docs) {
    if (d.data === undefined || d.kind === "manifest") continue;
    const ix = new Indexer(d.path);
    if (d.kind === "model") ix.model(d.data as Model);
    else ix.layout(d.data as Layout);
    for (const [id, list] of ix.byId) {
      const all = byId.get(id);
      if (all) all.push(...list);
      else byId.set(id, list);
    }
    refs.push(...ix.refs);
    multiplicities.push(...ix.multiplicities);
  }
  return { byId, refs, multiplicities };
}

export interface SemanticOptions {
  /** Checks whether a `code_refs` path exists in the host repository; without it `CODE_REF_MISSING` is not emitted. */
  codeRefExists?: (path: string) => boolean;
}

function collectCodeRefs(
  node: unknown,
  ptr: string,
  out: { path: string; pointer: string }[],
): void {
  if (Array.isArray(node)) {
    node.forEach((x, i) => {
      collectCodeRefs(x, `${ptr}/${String(i)}`, out);
    });
  } else if (node !== null && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      const p = `${ptr}/${k}`;
      if (k === "code_refs" && Array.isArray(v)) {
        v.forEach((c: unknown, i) => {
          const path = (c as { path?: unknown } | null)?.path;
          if (typeof path === "string") out.push({ path, pointer: `${p}/${String(i)}/path` });
        });
      } else collectCodeRefs(v, p, out);
    }
  }
}

/** Phase 4 over the loaded documents (`writable` and `read_only`). Pointers refer to the files as read. */
export function checkKnowledge(
  docs: readonly ParsedDocument[],
  options: SemanticOptions = {},
): Finding[] {
  const out: Finding[] = [];
  const loaded = docs.filter((d) => d.data !== undefined);
  const { byId, refs, multiplicities } = indexDocuments(loaded);

  for (const d of loaded) {
    if (d.kind === "model") {
      const id = (d.data as Model).id;
      if (d.path !== `models/${id}.json`) {
        out.push(
          finding("FILE_ID_MISMATCH", d.path, "/id", `model ${id} must be in models/${id}.json`, [
            id,
          ]),
        );
      }
    } else if (d.kind === "layout") {
      const id = (d.data as Layout).diagram.idref;
      if (d.path !== `layout/${id}.json`) {
        out.push(
          finding(
            "FILE_ID_MISMATCH",
            d.path,
            "/diagram",
            `layout of diagram ${id} must be in layout/${id}.json`,
            [id],
          ),
        );
      }
    }
  }

  for (const [id, list] of byId) {
    if (list.length < 2) continue;
    for (const x of list) {
      out.push(
        finding(
          "ID_DUPLICATE",
          x.file,
          x.pointer,
          `id ${id} appears ${String(list.length)} times in knowledge/`,
          [id],
        ),
      );
    }
  }
  /** Unambiguous target of a reference (`undefined` if missing or duplicated). */
  const target = (id: string): IndexedElement | undefined => {
    const list = byId.get(id);
    return list?.length === 1 ? list[0] : undefined;
  };

  for (const r of refs) {
    if (!byId.has(r.idref)) {
      out.push(
        finding(
          "REF_UNRESOLVED",
          r.file,
          r.pointer,
          `reference to ${r.idref}, which does not exist`,
          [r.idref],
        ),
      );
      continue;
    }
    const t = target(r.idref);
    if (!t) continue; // ambiguous: already reported as ID_DUPLICATE
    const diagramRule = r.rule === "class_diagram_element" || r.rule === "sequence_diagram_element";
    if (!admits(r.rule, t.type)) {
      out.push(
        finding(
          diagramRule ? "DIAGRAM_ELEMENT_NOT_ALLOWED" : "REF_TYPE_MISMATCH",
          r.file,
          r.pointer,
          `${r.idref} is a ${t.type}, not allowed here`,
          [r.idref],
        ),
      );
    } else if (
      (r.rule === "occurrence_event" || r.rule === "covered") &&
      t.interaction !== r.interaction
    ) {
      out.push(
        finding(
          "REF_TYPE_MISMATCH",
          r.file,
          r.pointer,
          `${r.idref} belongs to another interaction`,
          [r.idref],
        ),
      );
    } else if (r.rule === "used_interaction" && t.id === r.interaction) {
      out.push(
        finding(
          "REF_TYPE_MISMATCH",
          r.file,
          r.pointer,
          `interaction ${r.idref} cannot use itself`,
          [r.idref],
        ),
      );
    }
  }

  // Generalizations: same collection at both ends and no cycles.
  const genEdges: { from: string; to: string; file: string; pointer: string; id: string }[] = [];
  for (const [, list] of byId) {
    for (const x of list) {
      if (x.type !== "generalization") continue;
      const g = x.node as { id: string; specific: Ref; general: Ref };
      const s = target(g.specific.idref);
      const p = target(g.general.idref);
      if (
        s &&
        p &&
        s.type !== p.type &&
        admits("generalization_end", s.type) &&
        admits("generalization_end", p.type)
      ) {
        out.push(
          finding(
            "REF_TYPE_MISMATCH",
            x.file,
            x.pointer,
            `${g.id} joins a ${s.type} with a ${p.type}`,
            [g.id],
          ),
        );
      }
      genEdges.push({
        from: g.specific.idref,
        to: g.general.idref,
        file: x.file,
        pointer: x.pointer,
        id: g.id,
      });
    }
  }
  for (const e of edgesInCycles(genEdges)) {
    out.push(
      finding(
        "GENERALIZATION_CYCLE",
        e.file,
        e.pointer,
        `${e.id} is part of a generalization cycle`,
        [e.id],
      ),
    );
  }

  // Packages: single membership and no cycles.
  const memberSites = new Map<string, RefSite[]>();
  const packageEdges: { from: string; to: string; site: RefSite }[] = [];
  for (const r of refs) {
    if (r.rule !== "member") continue;
    const list = memberSites.get(r.idref);
    if (list) list.push(r);
    else memberSites.set(r.idref, [r]);
    if (r.owner !== undefined && target(r.idref)?.type === "package") {
      packageEdges.push({ from: r.owner, to: r.idref, site: r });
    }
  }
  for (const [id, sites] of memberSites) {
    if (sites.length < 2) continue;
    for (const s of sites) {
      out.push(
        finding(
          "PACKAGE_MEMBERSHIP",
          s.file,
          s.pointer,
          `${id} belongs to ${String(sites.length)} packages`,
          [id],
        ),
      );
    }
  }
  for (const e of edgesInCycles(packageEdges)) {
    out.push(
      finding(
        "PACKAGE_MEMBERSHIP",
        e.site.file,
        e.site.pointer,
        `${e.to} is part of a package cycle`,
        [e.to],
      ),
    );
  }

  // Messages and occurrence specifications.
  const usedOccurrences = new Map<string, string>();
  for (const [, list] of byId) {
    for (const x of list) {
      if (x.type !== "message") continue;
      const m = x.node as {
        id: string;
        kind: string;
        send_event?: Ref | null;
        receive_event?: Ref | null;
      };
      const need = { complete: [true, true], lost: [true, false], found: [false, true] }[m.kind];
      if (need && (Boolean(m.send_event) !== need[0] || Boolean(m.receive_event) !== need[1])) {
        out.push(
          finding(
            "MESSAGE_EVENTS",
            x.file,
            x.pointer,
            `events of ${m.id} do not match kind ${m.kind}`,
            [m.id],
          ),
        );
      }
      for (const [key, ev] of [
        ["send_event", m.send_event],
        ["receive_event", m.receive_event],
      ] as const) {
        if (!ev) continue;
        const prev = usedOccurrences.get(ev.idref);
        if (prev !== undefined) {
          out.push(
            finding(
              "OCCURRENCE_REUSED",
              x.file,
              `${x.pointer}/${key}`,
              `${ev.idref} is already an event of ${prev}`,
              [ev.idref, prev],
            ),
          );
        } else usedOccurrences.set(ev.idref, m.id);
      }
    }
  }
  for (const [id, list] of byId) {
    for (const x of list) {
      if (x.type === "occurrence" && !usedOccurrences.has(id)) {
        out.push(
          finding("OCCURRENCE_UNUSED", x.file, x.pointer, `${id} is not an event of any message`, [
            id,
          ]),
        );
      }
    }
  }

  for (const m of multiplicities) {
    const [lower, upper] = m.value.split("..");
    // BigInt: bounds are unbounded digit strings (schema pattern), beyond Number precision.
    if (upper !== undefined && upper !== "*" && BigInt(lower ?? "0") > BigInt(upper)) {
      out.push(
        finding(
          "MULTIPLICITY_INVALID",
          m.file,
          m.pointer,
          `multiplicity ${m.value}: lower bound greater than upper bound`,
          [],
        ),
      );
    }
  }

  // Layout: keys of elements not shown by their diagram.
  for (const d of loaded) {
    if (d.kind !== "layout") continue;
    const l = d.data as Layout;
    const diagram = target(l.diagram.idref);
    if (diagram?.type !== "diagram") continue;
    const { nodes, edges } = shownInLayout(
      diagram.node as { kind: string; elements?: Ref[] },
      target,
    );
    for (const [map, allowed] of [
      ["nodes", nodes],
      ["edges", edges],
    ] as const) {
      for (const key of Object.keys(l[map] ?? {})) {
        if (!allowed.has(key)) {
          out.push(
            finding(
              "LAYOUT_ORPHAN",
              d.path,
              pointer(map, key),
              `${key} is not shown as a diagram ${map === "nodes" ? "node" : "edge"}`,
              [key],
            ),
          );
        }
      }
    }
  }

  if (options.codeRefExists) {
    for (const d of loaded) {
      const sites: { path: string; pointer: string }[] = [];
      collectCodeRefs(d.data, "", sites);
      for (const s of sites) {
        if (!options.codeRefExists(s.path)) {
          out.push(
            finding(
              "CODE_REF_MISSING",
              d.path,
              s.pointer,
              `path ${s.path} does not exist in the repository`,
              [],
            ),
          );
        }
      }
    }
  }
  const byPath = new Map(loaded.map((d) => [d.path, d]));
  return out.map((f) => {
    const doc = byPath.get(f.file);
    return doc?.pointerMap ? { ...f, pointer: originalPointer(doc, f.pointer) } : f;
  });
}

/** IDs a diagram admits as keys of its layout's `nodes` and `edges` (spec §8). */
function shownInLayout(
  diagram: { kind: string; elements?: Ref[] },
  target: (id: string) => IndexedElement | undefined,
): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const r of diagram.elements ?? []) {
    const t = target(r.idref);
    if (!t) continue;
    if (diagram.kind === "sequence" && t.type === "interaction") {
      const x = t.node as Interaction;
      for (const l of x.lifelines ?? []) nodes.add(l.id);
      for (const m of x.messages ?? []) edges.add(m.id);
    } else if (NODE_TYPES.includes(t.type)) nodes.add(t.id);
    else if (RELATIONS.includes(t.type)) edges.add(t.id);
  }
  return { nodes, edges };
}
