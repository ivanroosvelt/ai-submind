// ai-submind web UI (FEAT-007, API-002, DEC-017): tree of models and diagrams, class diagrams drawn with
// @joint/core and own shapes, zoom/pan, selection with a detail panel, findings panel, layout saved with
// debounce (the only write, REQ-032) and live refresh through SSE. Plain TypeScript and DOM APIs.
import { dia, highlighters, linkTools, shapes } from "@joint/core";
import type { Finding } from "../format/findings.js";
import type { Diagram, Layout, LayoutEdge, LayoutNode } from "../format/types.js";
import { autoLayout, classGraph, type DiagramInput } from "../layout/class-layout.js";
import { linkCell, nodeCell } from "./shapes.js";

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
type View = DiagramInput & { diagram: Diagram; file: string; revision: string };

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
  interactive: { linkMove: false, labelMove: false },
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

/** Cell by ID; JointJS types it as always present. */
const cellOf = (id: string): dia.Cell | undefined => graph.getCell(id);

const nameOf = (id: string): string | undefined =>
  current && Object.hasOwn(current.names, id) ? current.names[id] : undefined;

function render(view: View, first: boolean): void {
  current = view;
  title.textContent = `${view.diagram.name} · ${view.diagram.id}`;
  if (view.diagram.kind !== "class") {
    graph.resetCells([]);
    paper.el.hidden = true;
    notice("Sequence diagrams are pending (PLAN-002 S11).");
    showDetail(undefined);
    return;
  }
  paper.el.hidden = false;
  notice("");
  const g = classGraph(view.elements, nameOf);
  // Nodes without a position are placed by the shared auto-layout and saved only when something moves.
  const placed = autoLayout(view, { keep: true });
  rendering = true;
  graph.resetCells([
    ...g.nodes.map((n) => nodeCell(n, placed.nodes?.[n.id] ?? { x: 0, y: 0 })),
    ...g.edges.map((e) => linkCell(e, placed.edges?.[e.id])),
  ]);
  rendering = false;
  if (first) {
    paper.once("render:done", fit);
  }
  showDetail(selected !== undefined && cellOf(selected) ? selected : undefined);
}

async function open(id: string, first = true): Promise<void> {
  if (first) selected = undefined;
  try {
    const view = (await api(`/api/diagram?id=${encodeURIComponent(id)}`)) as View;
    known = Math.max(known, announced);
    render(view, first);
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
    nodes[id] = { ...nodes[id], x: round(x), y: round(y) };
  }
  for (const link of graph.getLinks()) {
    const id = String(link.id);
    const entry: LayoutEdge = { ...edges[id] };
    const vertices = link.vertices().map((p) => ({ x: round(p.x), y: round(p.y) }));
    if (vertices.length > 0) entry.vertices = vertices;
    else delete entry.vertices;
    if (Object.keys(entry).length > 0) edges[id] = entry;
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
  if (view?.diagram.kind !== "class") return;
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
  if (rendering) return;
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
    await save((view) => autoLayout(view));
    if (current) render(current, true);
  });
});

// --- selection and detail (REQ-031) ---------------------------------------------------------------------

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
      if (!cellOf(target)) return h("span", text, "ref");
      const b = h("button", text, "ref");
      b.addEventListener("click", () => {
        showDetail(target);
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
  const el = id === undefined ? undefined : current?.elements.find((e) => e.id === id);
  if (id === undefined || !el) {
    detail.append(h("p", "Select an element to see its properties.", "hint"));
    return;
  }
  const cell = cellOf(id);
  if (cell) {
    const view = paper.requireView(cell);
    highlighters.stroke.add(view, cell.isLink() ? "line" : "body", "selection", {
      padding: cell.isLink() ? 0 : 4,
      attrs: { stroke: "#1e88e5", "stroke-width": 2 },
    });
    if (cell.isLink()) view.addTools(new dia.ToolsView({ tools: [new linkTools.Vertices()] }));
  }
  const node = el.node as Record<string, unknown>;
  const incoming = h("ul", undefined, "incoming");
  detail.append(
    h("h2", typeof node.name === "string" && node.name !== "" ? node.name : id),
    h("p", `${el.type} · ${id}`, "hint"),
    value(Object.fromEntries(Object.entries(node).filter(([k]) => k !== "id"))),
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
        const item = cellOf(e.from) ? h("button", text, "ref") : h("span", text);
        item.addEventListener("click", () => {
          if (cellOf(e.from)) showDetail(e.from);
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
  showDetail(String(v.model.id));
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
  const first = diagrams.find((d) => d.id === wanted) ?? diagrams.find((d) => d.kind === "class");
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
