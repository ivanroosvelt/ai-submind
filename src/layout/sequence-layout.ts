// Geometry and auto-layout of sequence diagrams (DEC-018, REQ-040, ENT-005). Pure and DOM-free, like
// class-layout.ts: the UI draws exactly this geometry and the MCP tool `auto_layout_diagram` persists the
// layout it implies. Vertical positions always follow the temporal order of the interaction's fragments;
// a layout only sets each lifeline's x, minimum width and minimum length (spec §8).
import type { Layout, LayoutEdge, LayoutNode } from "../format/types.js";
import type { DiagramInput } from "./class-layout.js";
import { CHAR_WIDTH, LINE_HEIGHT, MIN_WIDTH, PAD_X, PAD_Y, type Row } from "./size.js";

/** Spacing in px. `row`: between two events; `stub`: length of a lost/found message. */
export const SEQUENCE = {
  margin: 20,
  gap: 40,
  row: 32,
  fragmentPad: 24,
  indent: 10,
  label: LINE_HEIGHT + 2 * PAD_Y,
  ref: 40,
  execution: 12,
  shift: 6,
  self: 36,
  stub: 48,
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface LifelineGeometry {
  id: string;
  node: unknown;
  /** Header box: top-left corner (`y` is the header top, also persisted), width and height. */
  x: number;
  y: number;
  width: number;
  headerHeight: number;
  /** Header text rows (stereotypes, `name : Classifier`). */
  rows: Row[];
  /** Y where the line ends (an X if destroyed). */
  bottom: number;
  /** Starts at the row of a create message. */
  created: boolean;
  /** Ends at the row of a delete message. */
  destroyed: boolean;
}

export interface MessageGeometry {
  id: string;
  node: unknown;
  sort: string;
  kind: string;
  /** Name and arguments: `rent(customer)`. */
  label: string;
  /** Polyline from the sender to the receiver (a self-message loops to the right). */
  points: Point[];
  line: "solid" | "dashed";
  head: "filled" | "open";
  /** Filled circle at the end (lost) or at the start (found). */
  lost: boolean;
  found: boolean;
  /** Where the label goes: centered above `at`, or starting at it (self-messages). */
  labelAt: Point;
  labelAnchor: "middle" | "start";
}

export interface ExecutionGeometry {
  id: string;
  node: unknown;
  lifeline: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Nesting level on its lifeline (0 = outermost). */
  depth: number;
}

export interface OperandGeometry {
  id: string;
  node: unknown;
  /** Top of the operand: the fragment top for the first one, its dashed separator for the others. */
  y: number;
  guard: string;
}

export interface FragmentGeometry {
  id: string;
  node: unknown;
  type: "combined_fragment" | "interaction_use";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Operator (`opt`, `alt`…) or `ref`. */
  label: string;
  /** Interaction use: name of the used interaction (and arguments). */
  text: string;
  /** Interaction use: ID of the used interaction. */
  interaction?: string;
  /** Nesting level (0 = top level). */
  depth: number;
  operands: OperandGeometry[];
}

export interface SequenceGeometry {
  /** ID of the interaction shown, if any. */
  interaction?: string;
  lifelines: LifelineGeometry[];
  messages: MessageGeometry[];
  executions: ExecutionGeometry[];
  fragments: FragmentGeometry[];
  width: number;
  height: number;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const ref = (v: unknown): string => (isObj(v) ? str(v.idref) : "");
const objs = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const textWidth = (s: string): number => Array.from(s).length * CHAR_WIDTH;
/** Comparison by UTF-16 code units (spec §9.5). */
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

interface Lifeline {
  id: string;
  node: Obj;
  rows: Row[];
  width: number;
  headerHeight: number;
  index: number;
}

/** Header text and size of a lifeline: `name : Classifier` (UML), with a stereotype line if any. */
function lifeline(node: Obj, index: number, names: (id: string) => string | undefined): Lifeline {
  const id = str(node.id);
  const name = str(node.name);
  const rep = ref(node.represents);
  const type = rep === "" ? "" : (names(rep) ?? rep);
  const main = type === "" ? name || id : `${name} : ${type}`.trimStart();
  const stereotypes = (Array.isArray(node.stereotypes) ? node.stereotypes : []).filter(
    (s): s is string => typeof s === "string" && s !== "",
  );
  const lines = [...(stereotypes.length > 0 ? [`«${stereotypes.join(", ")}»`] : []), main];
  const rows = lines.map((text, i) => ({
    text,
    y: PAD_Y + i * LINE_HEIGHT + LINE_HEIGHT - 4,
    center: true,
  }));
  const width = Math.max(MIN_WIDTH, Math.ceil(Math.max(...lines.map(textWidth)) + 2 * PAD_X));
  return { id, node, rows, width, headerHeight: lines.length * LINE_HEIGHT + 2 * PAD_Y, index };
}

/** Message label: name and arguments. */
function label(m: Obj): string {
  const args = Array.isArray(m.arguments) ? m.arguments.map(str) : [];
  return `${str(m.name)}${args.length > 0 ? `(${args.join(", ")})` : ""}`;
}

/** Fragments flattened in temporal order (spec §6.5), with the boundaries of fragments and operands. */
type Item =
  | { k: "occ"; id: string; lifeline: string }
  | { k: "start"; f: Obj; depth: number }
  | { k: "operand"; f: Obj; op: Obj; index: number }
  | { k: "end"; f: Obj }
  | { k: "use"; f: Obj; depth: number };

function flatten(list: unknown, depth = 0, out: Item[] = []): Item[] {
  for (const f of objs(list)) {
    if (f.type === "occurrence") out.push({ k: "occ", id: str(f.id), lifeline: ref(f.covered) });
    else if (f.type === "interaction_use") out.push({ k: "use", f, depth });
    else if (f.type === "combined_fragment") {
      out.push({ k: "start", f, depth });
      objs(f.operands).forEach((op, index) => {
        out.push({ k: "operand", f, op, index });
        flatten(op.fragments, depth + 1, out);
      });
      out.push({ k: "end", f });
    }
  }
  return out;
}

interface Context {
  inter: Obj | undefined;
  lifelines: Lifeline[];
  messages: Obj[];
  names: (id: string) => string | undefined;
  entry: (id: string) => LayoutNode | undefined;
}

function context(view: DiagramInput): Context {
  const names = (id: string): string | undefined =>
    Object.hasOwn(view.names, id) ? view.names[id] : undefined;
  const nodes = view.layout?.nodes ?? {};
  const entry = (id: string): LayoutNode | undefined =>
    Object.hasOwn(nodes, id) ? nodes[id] : undefined;
  const found = view.elements.find((e) => e.type === "interaction" && isObj(e.node))?.node;
  const inter = isObj(found) ? found : undefined;
  const lifelines = objs(inter?.lifelines).map((l, i) => {
    const x = lifeline(l, i, names);
    return { ...x, width: Math.max(x.width, entry(x.id)?.width ?? 0) };
  });
  return { inter, lifelines, messages: objs(inter?.messages), names, entry };
}

/** Minimum distance between the centers of two neighbouring lifelines: headers and message labels. */
function spacing(ctx: Context, a: Lifeline, b: Lifeline, coveredBy: Map<string, string>): number {
  let need = a.width / 2 + SEQUENCE.gap + b.width / 2;
  for (const m of ctx.messages) {
    const from = coveredBy.get(ref(m.send_event));
    const to = coveredBy.get(ref(m.receive_event));
    const w = textWidth(label(m)) + 2 * PAD_X;
    if ((from === a.id && to === b.id) || (from === b.id && to === a.id))
      need = Math.max(need, w + SEQUENCE.execution);
    else if (from === a.id && (to === a.id || to === undefined))
      need = Math.max(need, SEQUENCE.self + w + b.width / 2);
  }
  // ponytail: only messages between neighbours make room; a long label that spans several lifelines
  // may overlap them. Spread the need over the spanned gaps if it matters.
  return Math.ceil(need);
}

/** Header x of `list`, packed left to right from `start` (center of the first one). */
function pack(
  ctx: Context,
  list: readonly Lifeline[],
  start: number,
  coveredBy: Map<string, string>,
): Map<string, number> {
  const out = new Map<string, number>();
  let center = start;
  list.forEach((l, i) => {
    const prev = list[i - 1];
    if (prev) center += spacing(ctx, prev, l, coveredBy);
    out.set(l.id, Math.round(center - l.width / 2));
  });
  return out;
}

function coveredMap(inter: Obj | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const it of flatten(inter?.fragments)) if (it.k === "occ") out.set(it.id, it.lifeline);
  return out;
}

/**
 * Header x of every lifeline. `keep`: an entry's x is kept and lifelines without one are packed to the
 * right of the others in array order. Otherwise all are packed from the margin in the order of their
 * current x (array order for those without an entry, after the rest).
 */
function headerXs(ctx: Context, keep: boolean): Map<string, number> {
  const coveredBy = coveredMap(ctx.inter);
  const has = (l: Lifeline): boolean => ctx.entry(l.id) !== undefined;
  const xOf = (l: Lifeline): number => ctx.entry(l.id)?.x ?? 0;
  if (!keep) {
    const order = [
      ...ctx.lifelines.filter(has).sort((a, b) => xOf(a) - xOf(b) || a.index - b.index),
      ...ctx.lifelines.filter((l) => !has(l)),
    ];
    const head = order[0];
    return pack(ctx, order, SEQUENCE.margin + (head ? head.width / 2 : 0), coveredBy);
  }
  const placed = ctx.lifelines.filter(has);
  const free = ctx.lifelines.filter((l) => !has(l));
  const right = Math.max(SEQUENCE.margin - SEQUENCE.gap, ...placed.map((l) => xOf(l) + l.width));
  const head = free[0];
  const out = pack(ctx, free, right + SEQUENCE.gap + (head ? head.width / 2 : 0), coveredBy);
  for (const l of placed) out.set(l.id, xOf(l));
  return out;
}

function compute(ctx: Context, xs: Map<string, number>): SequenceGeometry {
  const { inter, lifelines, messages } = ctx;
  const empty: SequenceGeometry = {
    lifelines: [],
    messages: [],
    executions: [],
    fragments: [],
    width: 2 * SEQUENCE.margin,
    height: 2 * SEQUENCE.margin,
  };
  if (!inter) return empty;
  const byId = new Map(lifelines.map((l) => [l.id, l]));
  const center = (id: string): number => {
    const l = byId.get(id);
    return l ? (xs.get(id) ?? 0) + l.width / 2 : 0;
  };
  const sendOf = new Map<string, Obj>();
  const receiveOf = new Map<string, Obj>();
  for (const m of messages) {
    if (ref(m.send_event)) sendOf.set(ref(m.send_event), m);
    if (ref(m.receive_event)) receiveOf.set(ref(m.receive_event), m);
  }
  const items = flatten(inter.fragments);
  const coveredBy = new Map<string, string>();
  for (const it of items) if (it.k === "occ") coveredBy.set(it.id, it.lifeline);

  // Rows, in temporal order. A receive right after the send of the same message on another lifeline
  // shares its row; a created lifeline's header is centered on the row of its create message.
  const created = new Set(
    [...receiveOf]
      .filter(([, m]) => m.sort === "create_message")
      .map(([occ]) => coveredBy.get(occ)),
  );
  const top =
    SEQUENCE.margin +
    Math.max(0, ...lifelines.filter((l) => !created.has(l.id)).map((l) => l.headerHeight));
  const rowOf = new Map<string, number>();
  const createdTop = new Map<string, number>();
  const destroyedAt = new Map<string, number>();
  const frames = new Map<Obj, { top: number; bottom: number; depth: number; ops: number[] }>();
  let y = top;
  items.forEach((it, i) => {
    switch (it.k) {
      case "occ": {
        const prev = items[i - 1];
        const m = receiveOf.get(it.id);
        if (
          m &&
          prev?.k === "occ" &&
          ref(m.send_event) === prev.id &&
          prev.lifeline !== it.lifeline
        ) {
          rowOf.set(it.id, rowOf.get(prev.id) ?? y);
        } else {
          // A create message makes room for the header it creates (pair or lone receive).
          const next = items[i + 1];
          const sent = sendOf.get(it.id);
          const create =
            m?.sort === "create_message"
              ? it.lifeline
              : sent?.sort === "create_message" &&
                  next?.k === "occ" &&
                  ref(sent.receive_event) === next.id
                ? next.lifeline
                : undefined;
          const h = create === undefined ? 0 : (byId.get(create)?.headerHeight ?? 0);
          y += Math.max(SEQUENCE.row, h / 2 + SEQUENCE.row / 2);
          rowOf.set(it.id, y);
          if (create !== undefined) {
            createdTop.set(create, y - h / 2);
            y += h / 2;
          }
        }
        if (m?.sort === "delete_message") destroyedAt.set(it.lifeline, rowOf.get(it.id) ?? y);
        break;
      }
      case "start":
        y += SEQUENCE.row / 2;
        frames.set(it.f, { top: y, bottom: y, depth: it.depth, ops: [] });
        break;
      case "operand": {
        const fr = frames.get(it.f);
        if (it.index > 0) y += SEQUENCE.row / 2;
        fr?.ops.push(it.index === 0 ? fr.top : y);
        y += SEQUENCE.label;
        break;
      }
      case "end": {
        y += SEQUENCE.row / 2;
        const fr = frames.get(it.f);
        if (fr) fr.bottom = y;
        break;
      }
      case "use":
        y += SEQUENCE.row / 2;
        frames.set(it.f, { top: y, bottom: y + SEQUENCE.ref, depth: it.depth, ops: [] });
        y += SEQUENCE.ref;
        break;
    }
  });
  const end = y + SEQUENCE.row;

  // Executions: stacked per lifeline by start row (outermost first).
  const executions: ExecutionGeometry[] = [];
  const execs = objs(inter.executions)
    .map((e) => {
      const s = rowOf.get(ref(e.start));
      const f = rowOf.get(ref(e.finish));
      return { e, lifeline: ref(e.covered), s, f };
    })
    .filter(
      (x): x is { e: Obj; lifeline: string; s: number; f: number } =>
        x.s !== undefined && x.f !== undefined && byId.has(x.lifeline),
    )
    .sort(
      (a, b) =>
        cmp(a.lifeline, b.lifeline) || a.s - b.s || b.f - a.f || cmp(str(a.e.id), str(b.e.id)),
    );
  // An execution nests in an earlier one of its lifeline that is still running when it starts, or that
  // contains it (a zero-length one at its finish); one starting at another's finish is chained, not nested.
  const open: { lifeline: string; s: number; f: number }[] = [];
  for (const x of execs) {
    const bottom = Math.max(x.f, x.s + SEQUENCE.row / 2);
    const depth = open.filter(
      (o) => o.lifeline === x.lifeline && o.s <= x.s && (x.s < o.f || x.f <= o.f),
    ).length;
    const g: ExecutionGeometry = {
      id: str(x.e.id),
      node: x.e,
      lifeline: x.lifeline,
      x: center(x.lifeline) - SEQUENCE.execution / 2 + depth * SEQUENCE.shift,
      y: x.s,
      width: SEQUENCE.execution,
      height: bottom - x.s,
      depth,
    };
    open.push(x);
    executions.push(g);
  }
  /** X where a message meets a lifeline at `row`, from side `dir` (-1 left, +1 right). */
  const edge = (id: string, row: number, dir: number): number => {
    const inner = executions
      .filter((e) => e.lifeline === id && e.y <= row && row <= e.y + e.height)
      .reduce<ExecutionGeometry | undefined>(
        (a, e) => (!a || e.depth > a.depth ? e : a),
        undefined,
      );
    if (!inner) return center(id);
    return dir < 0 ? inner.x : inner.x + inner.width;
  };

  // Messages.
  const out: MessageGeometry[] = [];
  for (const m of [...messages].sort((a, b) => cmp(str(a.id), str(b.id)))) {
    const send = ref(m.send_event);
    const receive = ref(m.receive_event);
    const from = coveredBy.get(send);
    const to = coveredBy.get(receive);
    const r1 = rowOf.get(send);
    const r2 = rowOf.get(receive);
    const okFrom = from !== undefined && byId.has(from) && r1 !== undefined;
    const okTo = to !== undefined && byId.has(to) && r2 !== undefined;
    if (!okFrom && !okTo) continue;
    const sort = str(m.sort);
    const kind = str(m.kind);
    let points: Point[];
    let labelAt: Point;
    let labelAnchor: MessageGeometry["labelAnchor"] = "middle";
    if (okFrom && okTo && from === to) {
      const loop = center(from) + SEQUENCE.execution + SEQUENCE.self;
      points = [
        { x: edge(from, r1, 1), y: r1 },
        { x: loop, y: r1 },
        { x: loop, y: r2 },
        { x: edge(to, r2, 1), y: r2 },
      ];
      labelAt = { x: loop + 4, y: (r1 + r2) / 2 + 4 };
      labelAnchor = "start";
    } else if (okFrom && okTo) {
      const dir = center(to) >= center(from) ? 1 : -1;
      const target = byId.get(to);
      const tx =
        sort === "create_message" && target && createdTop.has(to)
          ? (xs.get(to) ?? 0) + (dir > 0 ? 0 : target.width)
          : sort === "delete_message"
            ? center(to)
            : edge(to, r2, -dir);
      const sx = edge(from, r1, dir);
      points = [
        { x: sx, y: r1 },
        { x: tx, y: r2 },
      ];
      labelAt = { x: (sx + tx) / 2, y: Math.min(r1, r2) - 4 };
    } else if (okFrom) {
      const sx = edge(from, r1, 1);
      const ex = center(from) + SEQUENCE.stub + SEQUENCE.execution;
      points = [
        { x: sx, y: r1 },
        { x: ex, y: r1 },
      ];
      labelAt = { x: (sx + ex) / 2, y: r1 - 4 };
    } else {
      const ex = edge(to ?? "", r2 ?? 0, -1);
      const sx = center(to ?? "") - SEQUENCE.stub - SEQUENCE.execution;
      points = [
        { x: sx, y: r2 ?? 0 },
        { x: ex, y: r2 ?? 0 },
      ];
      labelAt = { x: (sx + ex) / 2, y: (r2 ?? 0) - 4 };
    }
    out.push({
      id: str(m.id),
      node: m,
      sort,
      kind,
      label: label(m),
      points,
      line: sort === "reply" || sort === "create_message" ? "dashed" : "solid",
      head: sort === "synch_call" ? "filled" : "open",
      lost: kind === "lost" && okFrom && !okTo,
      found: kind === "found" && okTo && !okFrom,
      labelAt,
      labelAnchor,
    });
  }

  // Fragments: over their covered lifelines, enclosing nested ones with an indent.
  const fragments: FragmentGeometry[] = [];
  const extent = (f: Obj): [number, number] => {
    const covered = objs(f.covered)
      .map((r) => ref(r))
      .filter((id) => byId.has(id));
    const centers = (covered.length > 0 ? covered : [...byId.keys()]).map(center);
    if (centers.length === 0) centers.push(SEQUENCE.margin + SEQUENCE.fragmentPad);
    let left = Math.min(...centers) - SEQUENCE.fragmentPad;
    let right = Math.max(...centers) + SEQUENCE.fragmentPad;
    for (const op of objs(f.operands)) {
      for (const child of objs(op.fragments)) {
        if (child.type === "occurrence") continue;
        const [l, r] = extent(child);
        left = Math.min(left, l - SEQUENCE.indent);
        right = Math.max(right, r + SEQUENCE.indent);
      }
    }
    // Room for the label tab and the first guard, or for the ref text.
    const tab = textWidth(f.type === "interaction_use" ? "ref" : str(f.operator)) + 2 * PAD_X;
    const guards = objs(f.operands).map((o) => textWidth(str(o.guard)));
    const text = f.type === "interaction_use" ? textWidth(useText(f)) + 2 * PAD_X : 0;
    right = Math.max(right, left + tab + Math.max(0, ...guards) + 2 * PAD_X, left + tab + text);
    return [left, right];
  };
  const useText = (f: Obj): string => {
    const used = ref(f.interaction);
    const args = Array.isArray(f.arguments) ? f.arguments.map(str) : [];
    return `${ctx.names(used) ?? used}${args.length > 0 ? `(${args.join(", ")})` : ""}`;
  };
  for (const it of items) {
    if (it.k !== "start" && it.k !== "use") continue;
    const fr = frames.get(it.f);
    if (!fr) continue;
    const [left, right] = extent(it.f);
    const g: FragmentGeometry = {
      id: str(it.f.id),
      node: it.f,
      type: it.k === "use" ? "interaction_use" : "combined_fragment",
      x: left,
      y: fr.top,
      width: right - left,
      height: fr.bottom - fr.top,
      label: it.k === "use" ? "ref" : str(it.f.operator),
      text: it.k === "use" ? useText(it.f) : "",
      depth: it.depth,
      operands: objs(it.f.operands).map((op, i) => ({
        id: str(op.id),
        node: op,
        y: fr.ops[i] ?? fr.top,
        guard: str(op.guard),
      })),
    };
    if (it.k === "use") g.interaction = ref(it.f.interaction);
    fragments.push(g);
  }

  const geometry: LifelineGeometry[] = lifelines.map((l) => {
    const headerTop = createdTop.get(l.id) ?? SEQUENCE.margin;
    const destroyed = destroyedAt.get(l.id);
    const length = ctx.entry(l.id)?.height ?? 0;
    return {
      id: l.id,
      node: l.node,
      x: xs.get(l.id) ?? 0,
      y: headerTop,
      width: l.width,
      headerHeight: l.headerHeight,
      rows: l.rows,
      // ponytail: a destroyed lifeline always ends at its X; its `height` is ignored.
      bottom: destroyed ?? Math.max(end, headerTop + length),
      created: createdTop.has(l.id),
      destroyed: destroyed !== undefined,
    };
  });
  const xsAll = [
    ...geometry.map((l) => l.x + l.width),
    ...out.flatMap((m) =>
      m.points.map((p) => p.x + (m.labelAnchor === "start" ? textWidth(m.label) : 0)),
    ),
    ...fragments.map((f) => f.x + f.width),
  ];
  return {
    interaction: str(inter.id),
    lifelines: geometry,
    messages: out,
    executions,
    fragments,
    width: Math.ceil(Math.max(0, ...xsAll) + SEQUENCE.margin),
    height: Math.ceil(Math.max(end, ...geometry.map((l) => l.bottom)) + SEQUENCE.margin),
  };
}

/** Geometry of a sequence diagram with its layout: x kept, lifelines without a position to the right. */
export function sequenceGeometry(view: DiagramInput): SequenceGeometry {
  const ctx = context(view);
  return compute(ctx, headerXs(ctx, true));
}

/** Object from entries sorted by key (spec §9.5); `Object.fromEntries` also keeps a `__proto__` key. */
const sorted = <T>(entries: [string, T][]): Record<string, T> =>
  Object.fromEntries(entries.sort(([a], [b]) => cmp(a, b)));

/**
 * Layout document of a sequence diagram (DEC-018). Without `keep` (auto-layout): lifelines are packed from
 * the margin in the order of their current x, each with its x and derived header y; explicit widths,
 * lengths and styles are kept, entries of elements no longer shown are dropped and message entries keep
 * only their style. With `keep` (a manual adjustment): every existing entry is kept as is, orphans
 * included (spec §8: LAYOUT_ORPHAN is a warning), and only lifelines without one get an entry, to the right.
 */
export function autoLayoutSequence(view: DiagramInput, options: { keep?: boolean } = {}): Layout {
  const keep = options.keep === true;
  const ctx = context(view);
  const g = compute(ctx, headerXs(ctx, keep));
  const prev = view.layout?.nodes ?? {};
  const prevEdges = view.layout?.edges ?? {};
  const nodes = sorted<LayoutNode>([
    ...(keep ? Object.entries(prev) : []),
    ...g.lifelines
      .filter((l) => !keep || ctx.entry(l.id) === undefined)
      .map((l): [string, LayoutNode] => {
        const before = ctx.entry(l.id);
        const entry: LayoutNode = { x: l.x, y: l.y };
        if (before?.width !== undefined) entry.width = before.width;
        if (before?.height !== undefined) entry.height = before.height;
        if (before?.style !== undefined) entry.style = before.style;
        return [l.id, entry];
      }),
  ]);
  const edges = sorted<LayoutEdge>(
    keep
      ? Object.entries(prevEdges)
      : g.messages.flatMap((m): [string, LayoutEdge][] => {
          const style = Object.hasOwn(prevEdges, m.id) ? prevEdges[m.id]?.style : undefined;
          return style === undefined ? [] : [[m.id, { style }]];
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
