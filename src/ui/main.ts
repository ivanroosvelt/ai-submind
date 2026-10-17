// ai-submind web UI (FEAT-007, FEAT-009, API-002, DEC-017, DEC-018): tree of models and diagrams, class and
// sequence diagrams drawn with @joint/core and own shapes, zoom/pan, selection with a detail panel and
// navigation between diagrams (drill-down to linked flows, REQ-042), findings panel, layout saved (the only
// write, REQ-032) and live refresh through SSE. Plain TypeScript and DOM APIs.
import { dia, highlighters, linkTools, shapes } from "@joint/core";
import type { Finding } from "../format/findings.js";
import type { Diagram, Layout, LayoutEdge, LayoutNode } from "../format/types.js";
import { autoLayout, classGraph, type DiagramInput } from "../layout/class-layout.js";
import { autoLayoutSequence, sequenceGeometry } from "../layout/sequence-layout.js";
import {
  executionCell,
  fragmentCell,
  lifelineCell,
  lifelineEndCell,
  linkCell,
  messageCell,
  nodeCell,
} from "./shapes.js";

interface ModelInfo {
  id: string;
  name?: string;
  file: string;
  errors: number;
  warnings: number;
}
interface DiagramInfo {
  id: string;
  name: string;
  kind: Diagram["kind"];
  model: string;
  errors: number;
  warnings: number;
}
/** Drill-down target computed by the server (API-002, REQ-042); `diagram`: a model's first diagram. */
interface Target {
  id: string;
  kind: "element" | "diagram" | "model";
  diagram?: string;
}
type View = DiagramInput & {
  diagram: Diagram;
  file: string;
  revision: string;
  targets: Record<string, Target[]>;
};

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`index.html has no #${id}`);
  return el;
}
const tree = $("tree");
const canvas = $("canvas");
const detail = $("detail");
const findingsPanel = $("findings");
const banner = $("banner");
const title = $("title");

/** Element factory with text content; never parses HTML (data comes from files anyone can edit). */
function h(tag: string, text?: string, cls?: string, ...children: HTMLElement[]): HTMLElement {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls !== undefined) el.className = cls;
  el.append(...children);
  return el;
}

function notice(text: string, kind: "info" | "error" = "info"): void {
  banner.textContent = text;
  banner.className = kind;
  banner.hidden = text === "";
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(path, init);
  if (res.status === 401) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Session expired: open the URL printed by ai-submind serve.",
    );
  }
  const body = (await res.json().catch(() => ({}))) as {
    error?: { code: string; message: string };
  };
  if (!res.ok)
    throw new ApiError(res.status, body.error?.code ?? "", body.error?.message ?? res.statusText);
  return body;
}

// --- canvas ---------------------------------------------------------------------------------------------

const graph = new dia.Graph({}, { cellNamespace: shapes });
const paper = new dia.Paper({
  el: canvas,
  model: graph,
  width: "100%",
  height: "100%",
  gridSize: 10,
  async: true,
  background: { color: "#fafafa" },
  cellViewNamespace: shapes,
  // Sequence diagrams: only lifelines (horizontally) and their end handles (vertically) move (DEC-018).
  interactive: (v: dia.CellView) =>
    current?.diagram.kind === "sequence" &&
    !["submind.Lifeline", "submind.LifelineEnd"].includes(v.model.get("type") as string)
      ? false
      : { linkMove: false, labelMove: false },
});

function zoom(x: number, y: number, delta: number): void {
  const s = paper.scale().sx;
  paper.scaleUniformAtPoint(Math.min(4, Math.max(0.1, s * (delta > 0 ? 1.1 : 1 / 1.1))), { x, y });
}
paper.on("blank:mousewheel", (evt: dia.Event, x: number, y: number, delta: number) => {
  evt.preventDefault();
  zoom(x, y, delta);
});
paper.on(
  "cell:mousewheel",
  (_v: dia.CellView, evt: dia.Event, x: number, y: number, delta: number) => {
    evt.preventDefault();
    zoom(x, y, delta);
  },
);

let pan: { x: number; y: number; tx: number; ty: number } | undefined;
paper.on("blank:pointerdown", (evt: dia.Event) => {
  const { tx, ty } = paper.translate();
  pan = { x: evt.clientX ?? 0, y: evt.clientY ?? 0, tx, ty };
});
paper.on("blank:pointermove", (evt: dia.Event) => {
  if (pan)
    paper.translate(pan.tx + (evt.clientX ?? 0) - pan.x, pan.ty + (evt.clientY ?? 0) - pan.y);
});
paper.on("blank:pointerup", () => {
  pan = undefined;
});

const fit = (): void => {
  paper.transformToFitContent({ padding: 24, maxScale: 1, useModelGeometry: true });
};
$("fit").addEventListener("click", fit);
$("zoom-in").addEventListener("click", () => {
  const r = canvas.getBoundingClientRect();
  const p = paper.clientToLocalPoint(r.left + r.width / 2, r.top + r.height / 2);
  zoom(p.x, p.y, 1);
});
$("zoom-out").addEventListener("click", () => {
  const r = canvas.getBoundingClientRect();
  const p = paper.clientToLocalPoint(r.left + r.width / 2, r.top + r.height / 2);
  zoom(p.x, p.y, -1);
});

// --- state ----------------------------------------------------------------------------------------------

let current: View | undefined;
let selected: string | undefined;
/** Highest engine generation this page reflects; events up to it are its own or already shown. */
let known = 0;
/** Highest generation announced by the event stream. */
let announced = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Saves run one after another: each reads the revision left by the previous one. */
let saves: Promise<void> = Promise.resolve();
/** Saves queued or in flight. */
let pendingSaves = 0;
/** Set while cells are replaced, so that the changes it causes are not saved. */
let rendering = false;
/** Parts of the shown interaction (lifelines, messages, executions, fragments) by ID, for the detail. */
let parts = new Map<string, { type: string; node: unknown }>();
/** Elements to select once the diagram being opened is shown (first one on the canvas). */
let revealing: string[] = [];

/** Cell by ID; JointJS types it as always present. */
const cellOf = (id: string): dia.Cell | undefined => graph.getCell(id);

const nameOf = (id: string): string | undefined =>
  current && Object.hasOwn(current.names, id) ? current.names[id] : undefined;

/** Drill-down targets of `id` in the open diagram (REQ-042). */
const targetsOf = (id: string): Target[] =>
  (current && Object.hasOwn(current.targets, id) ? current.targets[id] : undefined) ?? [];
const linked = (id: string): boolean => targetsOf(id).length > 0;

function render(view: View, first: boolean): void {
  current = view;
  title.textContent = `${view.diagram.name} · ${view.diagram.id}`;
  notice("");
  if (view.diagram.kind === "sequence") {
    renderSequence(view, first);
    return;
  }
  parts = new Map();
  const g = classGraph(view.elements, nameOf);
  // Nodes without a position are placed by the shared auto-layout and saved only when something moves.
  const placed = autoLayout(view, { keep: true });
  rendering = true;
  graph.resetCells([
    ...g.nodes.map((n) => nodeCell(n, placed.nodes?.[n.id] ?? { x: 0, y: 0 }, linked(n.id))),
    ...g.edges.map((e) => linkCell(e, placed.edges?.[e.id], linked(e.id))),
  ]);
  rendering = false;
  if (first) {
    paper.once("render:done", fit);
  }
  showDetail(selected !== undefined && cellOf(selected) ? selected : undefined);
}

/** Sequence diagram from the shared geometry (DEC-018): rows always follow the event order. */
function renderSequence(view: View, first: boolean): void {
  const g = sequenceGeometry(view);
  const nodes = view.layout?.nodes ?? {};
  const edges = view.layout?.edges ?? {};
  parts = new Map();
  for (const x of [...g.lifelines, ...g.messages, ...g.executions, ...g.fragments]) {
    const type =
      "sort" in x
        ? "message"
        : "lifeline" in x
          ? "execution"
          : "headerHeight" in x
            ? "lifeline"
            : x.type;
    parts.set(x.id, { type, node: x.node });
  }
  rendering = true;
  graph.resetCells([
    // Combined fragments behind (outline only); interaction uses opaque above lifelines (UML).
    ...g.fragments
      .filter((f) => f.type === "combined_fragment")
      .map((f) => fragmentCell(f, linked(f.id))),
    ...g.lifelines.map((l) =>
      lifelineCell(l, Object.hasOwn(nodes, l.id) ? nodes[l.id]?.style : undefined, linked(l.id)),
    ),
    ...g.executions.map((e) => executionCell(e, linked(e.id))),
    ...g.fragments
      .filter((f) => f.type === "interaction_use")
      .map((f) => fragmentCell(f, linked(f.id))),
    ...g.messages.map((m) =>
      messageCell(m, Object.hasOwn(edges, m.id) ? edges[m.id] : undefined, linked(m.id)),
    ),
    ...g.lifelines.filter((l) => !l.destroyed).map((l) => lifelineEndCell(l)),
  ]);
  rendering = false;
  if (first) paper.once("render:done", fit);
  showDetail(selected !== undefined && parts.has(selected) ? selected : undefined);
}

async function open(id: string, first = true): Promise<void> {
  if (first) selected = undefined;
  try {
    const view = (await api(`/api/diagram?id=${encodeURIComponent(id)}`)) as View;
    known = Math.max(known, announced);
    render(view, first);
    const target = revealing.find((x) => cellOf(x));
    revealing = [];
    if (target !== undefined) showDetail(target);
    for (const b of tree.querySelectorAll("button[data-id]")) {
      b.classList.toggle("active", (b as HTMLElement).dataset.id === id);
    }
  } catch (e) {
    notice(e instanceof Error ? e.message : String(e), "error");
  }
}

// --- layout persistence (REQ-029) -----------------------------------------------------------------------

const round = (n: number): number => Math.round(n);

/** Layout with the positions and vertices on screen; sizes, styles and other entries are kept. */
function layoutOnScreen(view: View): Layout {
  const before = view.layout;
  const nodes: Record<string, LayoutNode> = { ...before?.nodes };
  const edges: Record<string, LayoutEdge> = { ...before?.edges };
  for (const el of graph.getElements()) {
    const id = String(el.id);
    const { x, y } = el.position();
    // defineProperty: an ID `__proto__` stays a key (an assignment would set the prototype).
    const entry = {
      ...(Object.hasOwn(nodes, id) ? nodes[id] : undefined),
      x: round(x),
      y: round(y),
    };
    Object.defineProperty(nodes, id, {
      value: entry,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  for (const link of graph.getLinks()) {
    const id = String(link.id);
    const entry: LayoutEdge = { ...(Object.hasOwn(edges, id) ? edges[id] : undefined) };
    const vertices = link.vertices().map((p) => ({ x: round(p.x), y: round(p.y) }));
    if (vertices.length > 0) entry.vertices = vertices;
    else delete entry.vertices;
    if (Object.keys(entry).length > 0)
      Object.defineProperty(edges, id, {
        value: entry,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    else Reflect.deleteProperty(edges, id);
  }
  return {
    format_version: before?.format_version ?? view.formatVersion,
    diagram: { idref: view.diagram.id },
    nodes,
    edges,
  };
}

/** Saves `layout(view)` for the open diagram, if any; a conflict reloads it. */
async function save(layout: (view: View) => Layout = layoutOnScreen): Promise<void> {
  const view = current;
  if (!view) return;
  const next = layout(view);
  try {
    const r = (await api(`/api/layout?diagram=${encodeURIComponent(view.diagram.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ layout: next, revision: view.revision }),
    })) as { revision: string; generation: number };
    view.revision = r.revision;
    view.layout = next;
    known = Math.max(known, r.generation);
  } catch (e) {
    if (e instanceof ApiError && e.code === "REVISION_CONFLICT") {
      notice(
        "The diagram changed on disk since it was opened: your last move was not saved; reloaded.",
        "error",
      );
      await open(view.diagram.id, false);
      return;
    }
    notice(`Layout not saved: ${e instanceof Error ? e.message : String(e)}`, "error");
  }
}

/** Queues a save after the previous ones. */
function enqueue(run: () => Promise<void>): void {
  pendingSaves++;
  saves = saves.then(run).finally(() => {
    pendingSaves--;
    // Changes announced while saving that are not this page's own writes.
    if (pendingSaves === 0 && saveTimer === undefined && announced > known) void refresh();
  });
}

function scheduleSave(): void {
  if (rendering || current?.diagram.kind !== "class") return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    enqueue(() => save());
  }, 400);
}
graph.on("change:position change:vertices", scheduleSave);

// Whole layout recomputed by the shared module, as the MCP tool `auto_layout_diagram` does (DEC-017),
// and saved through the same layout write (REQ-032).
$("auto-layout").addEventListener("click", () => {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  enqueue(async () => {
    await save((view) =>
      view.diagram.kind === "sequence" ? autoLayoutSequence(view) : autoLayout(view),
    );
    if (current) render(current, true);
  });
});

// Sequence diagrams (DEC-018): a lifeline moves only horizontally (its x sets the order) and its end handle
// only vertically (the length, a minimum); on drop the layout is saved and everything is redrawn.
const fixedAxis = new Map<string, { x: number; y: number }>();
graph.on("change:position", (cell: dia.Element) => {
  const type = cell.get("type") as string;
  if (rendering || (type !== "submind.Lifeline" && type !== "submind.LifelineEnd")) return;
  const id = String(cell.id);
  let at = fixedAxis.get(id);
  if (!at) {
    // ponytail: JointJS types previous() as any; the position before the first change of the drag.
    at = { ...(cell.previous("position") as { x: number; y: number }) };
    fixedAxis.set(id, at);
  }
  const p = cell.position();
  if (type === "submind.Lifeline" && p.y !== at.y) cell.position(p.x, at.y);
  if (type === "submind.LifelineEnd" && p.x !== at.x) cell.position(at.x, p.y);
});
paper.on("element:pointerup", (v: dia.ElementView) => {
  const view = current;
  const cell = v.model;
  const type = cell.get("type") as string;
  const id = String(cell.id);
  if (view?.diagram.kind !== "sequence" || !fixedAxis.has(id)) return;
  fixedAxis.delete(id);
  // Existing entries are kept as they are (orphans included); only this lifeline's entry changes.
  const next = autoLayoutSequence(view, { keep: true });
  const lifeline = type === "submind.LifelineEnd" ? id.slice("end:".length) : id;
  const nodes = next.nodes ?? {};
  const before = Object.hasOwn(nodes, lifeline) ? nodes[lifeline] : undefined;
  const header = cellOf(lifeline);
  if (!before || !header?.isElement()) return;
  const entry = { ...before };
  // The length is measured from the drawn header top, not from a persisted `y` (spec §8: derived).
  if (type === "submind.Lifeline") entry.x = round(cell.position().x);
  else entry.height = Math.max(1, round(cell.position().y + 3 - header.position().y));
  next.nodes = Object.fromEntries([...Object.entries(nodes), [lifeline, entry]]);
  view.layout = next;
  // ponytail: messages, executions and fragments follow a dragged lifeline on drop (full redraw), not while
  // dragging; redraw on every move if live feedback matters.
  render(view, false);
  clearTimeout(saveTimer);
  saveTimer = undefined;
  enqueue(() => save(() => next));
});

// --- selection and detail (REQ-031) ---------------------------------------------------------------------

/** Lifeline covered by occurrence `id` of the open sequence diagram (nested operands included). */
function coveredBy(id: string): string | undefined {
  interface Frag {
    id?: unknown;
    type?: unknown;
    covered?: { idref?: unknown };
    operands?: { fragments?: Frag[] }[];
  }
  const walk = (list: Frag[] | undefined): string | undefined => {
    for (const f of list ?? []) {
      if (f.id === id && f.type === "occurrence" && typeof f.covered?.idref === "string")
        return f.covered.idref;
      for (const o of f.operands ?? []) {
        const hit = walk(o.fragments);
        if (hit !== undefined) return hit;
      }
    }
    return undefined;
  };
  if (current?.diagram.kind !== "sequence") return undefined;
  for (const e of current.elements) {
    const hit = walk((e.node as { fragments?: Frag[] }).fragments);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * Selects `id` or, if it has no cell, the closest element that has one: the message an occurrence is an
 * event of, then its owners up the chain (operand → fragment, lifeline/occurrence → interaction…). On the
 * current canvas first; otherwise it opens the first diagram that shows one of them and selects it there
 * (navigation lifeline ↔ class, interaction use → used interaction). Uses the incoming relations.
 */
async function reveal(id: string): Promise<void> {
  interface Rel {
    items: { kind: string; from: string }[];
  }
  // An occurrence has no cell of its own: it sits on the lifeline it covers.
  const lifeline = coveredBy(id);
  if (lifeline !== undefined && cellOf(lifeline)) {
    showDetail(lifeline);
    return;
  }
  try {
    const chain: string[] = [];
    let diagram: string | undefined;
    for (let x: string | undefined = id; x !== undefined && !chain.includes(x);) {
      const { items } = (await api(`/api/relations?id=${encodeURIComponent(x)}`)) as Rel;
      const events = items.filter((e) => e.kind === "send_event" || e.kind === "receive_event");
      chain.push(x, ...events.map((e) => e.from));
      const here = chain.find((y) => cellOf(y));
      if (here !== undefined) {
        showDetail(here);
        return;
      }
      diagram = items.find((e) => e.kind === "shows")?.from;
      if (diagram !== undefined) break;
      x = items.find((e) => e.kind === "owns")?.from;
    }
    if (diagram === undefined) {
      notice(`${id} is not shown in any diagram.`);
      return;
    }
    if (diagram !== current?.diagram.id) {
      revealing = chain;
      location.hash = encodeURIComponent(diagram);
    }
  } catch (e) {
    notice(e instanceof Error ? e.message : String(e), "error");
  }
}

/** Opens target `t` (REQ-042): an element through a diagram that shows it, a diagram, a model's first. */
function navigate(t: Target): void {
  if (t.kind === "element") {
    void reveal(t.id);
    return;
  }
  const diagram = t.kind === "diagram" ? t.id : t.diagram;
  if (diagram === undefined) notice(`Model ${nameOf(t.id) ?? t.id} has no diagrams.`);
  else if (diagram !== current?.diagram.id) location.hash = encodeURIComponent(diagram);
}

/** "Navigates to" section of the detail for `id`, empty without targets. */
function navSection(id: string): HTMLElement[] {
  const list = targetsOf(id);
  if (list.length === 0) return [];
  const ul = h("ul", undefined, "incoming");
  for (const t of list) {
    const b = h("button", `${nameOf(t.id) ?? t.id} · ${t.kind}`, "ref");
    b.addEventListener("click", () => {
      navigate(t);
    });
    ul.append(h("li", undefined, undefined, b));
  }
  return [h("h3", "Navigates to"), ul];
}

function value(v: unknown): HTMLElement {
  if (v === null) return h("em", "unknown");
  if (Array.isArray(v)) {
    const ol = h("ol");
    for (const x of v) ol.append(h("li", undefined, undefined, value(x)));
    return ol;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.idref === "string") {
      const target = o.idref;
      const text = nameOf(target) ?? target;
      const b = h("button", text, "ref");
      b.title = cellOf(target) ? "Select" : "Open a diagram that shows it";
      b.addEventListener("click", () => {
        if (cellOf(target)) showDetail(target);
        else void reveal(target);
      });
      return b;
    }
    const dl = h("dl");
    for (const [k, x] of Object.entries(o))
      dl.append(h("dt", k), h("dd", undefined, undefined, value(x)));
    return dl;
  }
  return h("span", typeof v === "string" ? v : JSON.stringify(v));
}

function showDetail(id: string | undefined): void {
  selected = id;
  paper.removeTools();
  highlighters.stroke.removeAll(paper, "selection");
  detail.replaceChildren();
  const el =
    id === undefined ? undefined : (current?.elements.find((e) => e.id === id) ?? parts.get(id));
  if (id === undefined || !el) {
    detail.append(
      h("p", "Select an element to see its properties.", "hint"),
      ...(current ? navSection(current.diagram.id) : []),
    );
    return;
  }
  const cell = cellOf(id);
  if (cell) {
    const view = paper.requireView(cell);
    highlighters.stroke.add(view, cell.isLink() ? "line" : "body", "selection", {
      padding: cell.isLink() ? 0 : 4,
      attrs: { stroke: "#1e88e5", "stroke-width": 2 },
    });
    if (cell.isLink() && current?.diagram.kind === "class")
      view.addTools(new dia.ToolsView({ tools: [new linkTools.Vertices()] }));
  }
  const node = el.node as Record<string, unknown>;
  const incoming = h("ul", undefined, "incoming");
  detail.append(
    h("h2", typeof node.name === "string" && node.name !== "" ? node.name : id),
    h("p", `${el.type} · ${id}`, "hint"),
    value(Object.fromEntries(Object.entries(node).filter(([k]) => k !== "id"))),
    ...navSection(id),
    h("h3", "Referenced by"),
    incoming,
  );
  void api(`/api/relations?id=${encodeURIComponent(id)}`).then(
    (r) => {
      if (selected !== id) return;
      const { items } = r as {
        items: { kind: string; from: string; key?: string; name?: string }[];
      };
      if (items.length === 0) incoming.append(h("li", "nothing", "hint"));
      for (const e of items) {
        const text = `${e.name ?? e.from} · ${e.kind}${e.key !== undefined ? ` (${e.key})` : ""}`;
        const item = h("button", text, "ref");
        item.addEventListener("click", () => {
          if (cellOf(e.from)) showDetail(e.from);
          else void reveal(e.from);
        });
        incoming.append(h("li", undefined, undefined, item));
      }
    },
    (e: unknown) => {
      incoming.append(h("li", e instanceof Error ? e.message : String(e), "hint"));
    },
  );
}
paper.on("cell:pointerclick", (v: dia.CellView) => {
  const id = String(v.model.id);
  showDetail(id.startsWith("end:") ? id.slice("end:".length) : id);
});
// Double click on a marked element (↗) opens its first drill-down target (REQ-042): the flow behind a
// message or an operation, the interaction an interaction use uses, or the first of its links.
paper.on("cell:pointerdblclick", (v: dia.CellView) => {
  const first = targetsOf(String(v.model.id))[0];
  if (first) navigate(first);
});
paper.on("blank:pointerclick", () => {
  showDetail(undefined);
});

// --- tree and findings (REQ-028, REQ-033) ---------------------------------------------------------------

const counts = (x: { errors: number; warnings: number }): string =>
  x.errors + x.warnings === 0 ? "" : ` (${String(x.errors)}E ${String(x.warnings)}W)`;

async function loadTree(): Promise<DiagramInfo[]> {
  const { models, diagrams } = (await api("/api/diagrams")) as {
    models: ModelInfo[];
    diagrams: DiagramInfo[];
  };
  const root = h("ul");
  for (const m of models) {
    const item = h("li");
    item.append(
      h("span", `${m.name ?? m.id}${counts(m)}`, m.errors > 0 ? "model invalid" : "model"),
    );
    const list = h("ul");
    for (const d of diagrams.filter((x) => x.model === m.id)) {
      const b = h("button", `${d.name}${d.kind === "sequence" ? " (sequence)" : ""}${counts(d)}`);
      b.dataset.id = d.id;
      b.classList.toggle("active", d.id === current?.diagram.id);
      b.addEventListener("click", () => {
        location.hash = encodeURIComponent(d.id);
      });
      list.append(h("li", undefined, undefined, b));
    }
    item.append(list);
    root.append(item);
  }
  tree.replaceChildren(root);
  return diagrams;
}

async function loadFindings(): Promise<void> {
  const r = (await api("/api/findings")) as {
    errors: number;
    warnings: number;
    findings: Finding[];
  };
  const summary = h(
    "summary",
    `Findings: ${String(r.errors)} errors, ${String(r.warnings)} warnings`,
  );
  const box = h("details");
  box.toggleAttribute(
    "open",
    findingsPanel.querySelector("details")?.hasAttribute("open") ?? false,
  );
  box.append(summary);
  const list = h("ul");
  for (const f of r.findings) {
    const li = h("li", undefined, f.severity);
    li.append(
      h("b", `${f.severity} ${f.code}`),
      h("code", ` ${f.file}${f.pointer}`),
      h("span", ` ${f.message}`),
    );
    list.append(li);
  }
  box.append(list);
  findingsPanel.replaceChildren(box);
}

// --- live refresh (REQ-030) -----------------------------------------------------------------------------

async function refresh(): Promise<void> {
  known = Math.max(known, announced);
  await Promise.all([loadTree(), loadFindings()]).catch((e: unknown) => {
    notice(e instanceof Error ? e.message : String(e), "error");
  });
  if (current) await open(current.diagram.id, false);
}

const events = new EventSource("/api/events");
events.addEventListener("change", (ev: MessageEvent<string>) => {
  const data = JSON.parse(ev.data) as { generation: number };
  announced = Math.max(announced, data.generation);
  // While a save is pending or in flight its own event is expected; the save decides afterwards.
  if (pendingSaves > 0 || saveTimer !== undefined || announced <= known) return;
  void refresh();
});
events.addEventListener("error", () => {
  // EventSource retries forever; a daemon restarted with another token answers 401 to every retry.
  void fetch("/api/status").then(
    (res) => {
      if (res.status !== 401) return;
      events.close();
      notice("Session expired: open the URL printed by ai-submind serve.", "error");
    },
    () => undefined,
  );
  notice("Connection to ai-submind lost; retrying…", "error");
});
events.addEventListener("open", () => {
  if (banner.textContent.startsWith("Connection")) notice("");
});

// --- start ----------------------------------------------------------------------------------------------

async function start(): Promise<void> {
  const diagrams = await loadTree();
  await loadFindings();
  const wanted = decodeURIComponent(location.hash.slice(1));
  const first =
    diagrams.find((d) => d.id === wanted) ??
    diagrams.find((d) => d.kind === "class") ??
    diagrams[0];
  if (first) {
    if (first.id === wanted) await open(first.id);
    else location.hash = encodeURIComponent(first.id);
  } else notice("No diagrams yet: create one through MCP.");
}
window.addEventListener("hashchange", () => {
  void open(decodeURIComponent(location.hash.slice(1)));
});
start().catch((e: unknown) => {
  notice(e instanceof Error ? e.message : String(e), "error");
});
