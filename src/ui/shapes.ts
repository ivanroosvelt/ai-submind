// Own UML shapes over @joint/core (DEC-006, DEC-017): nodes drawn from the text, rows and size computed by
// src/layout/size.ts (never measured in the DOM) and links with UML ends. No JointJS+ code.
import { dia, shapes } from "@joint/core";
import type { LayoutEdge, LayoutNode, Style } from "../format/types.js";
import { boxSize, type GraphEdge, type GraphNode } from "../layout/class-layout.js";
import type {
  ExecutionGeometry,
  FragmentGeometry,
  LifelineGeometry,
  MessageGeometry,
} from "../layout/sequence-layout.js";
import {
  CHAR_WIDTH,
  FIGURE_HEIGHT,
  FONT_FAMILY,
  FONT_SIZE,
  PAD_X,
  TAB_HEIGHT,
} from "../layout/size.js";

const COLORS = { fill: "#ffffff", stroke: "#37474f", text: "#212121" };

type Marker = Record<string, string | number>;
const NONE: Marker = { type: "path", d: "M 0 0" };
const OPEN_ARROW: Marker = {
  type: "path",
  d: "M 10 -5 0 0 10 5",
  fill: "none",
  "stroke-width": 1.5,
};
const TRIANGLE: Marker = { type: "path", d: "M 14 -8 0 0 14 8 z", fill: "#ffffff" };
const diamond = (fill: string): Marker => ({ type: "path", d: "M 0 0 9 -5 18 0 9 5 z", fill });

/** Node of a class diagram at `entry`; an explicit size in the layout is a minimum (spec §8). */
export function nodeCell(n: GraphNode, entry: LayoutNode): dia.Element {
  const { width, height } = boxSize(n, entry);
  const c = { ...COLORS, ...entry.style };
  const shape = { fill: c.fill, stroke: c.stroke, "stroke-width": 1 };
  const markup: dia.MarkupJSON = [];
  if (n.type === "actor") {
    const m = width / 2;
    markup.push(
      { tagName: "rect", selector: "body", attributes: { width, height, fill: "transparent" } },
      { tagName: "circle", attributes: { cx: m, cy: 10, r: 8, ...shape } },
      {
        tagName: "path",
        attributes: {
          d: `M ${String(m)} 18 V 34 M ${String(m - 12)} 24 H ${String(m + 12)} M ${String(m - 10)} ${String(FIGURE_HEIGHT - 2)} L ${String(m)} 34 L ${String(m + 10)} ${String(FIGURE_HEIGHT - 2)}`,
          fill: "none",
          stroke: c.stroke,
        },
      },
    );
  } else if (n.type === "package") {
    markup.push(
      {
        tagName: "rect",
        attributes: { width: Math.min(60, width / 2), height: TAB_HEIGHT, ...shape },
      },
      {
        tagName: "rect",
        selector: "body",
        attributes: { y: TAB_HEIGHT, width, height: height - TAB_HEIGHT, ...shape },
      },
    );
  } else {
    markup.push({ tagName: "rect", selector: "body", attributes: { width, height, ...shape } });
  }
  for (const y of n.separators) {
    markup.push({
      tagName: "path",
      attributes: { d: `M 0 ${String(y)} H ${String(width)}`, stroke: c.stroke },
    });
  }
  const nameRow = n.header.length - 1;
  n.rows.forEach((r, i) => {
    const italic = i === nameRow && (n.node as { is_abstract?: unknown }).is_abstract === true;
    markup.push({
      tagName: "text",
      textContent: r.text,
      attributes: {
        x: r.center ? width / 2 : PAD_X,
        y: r.y,
        "text-anchor": r.center ? "middle" : "start",
        "font-family": FONT_FAMILY,
        "font-size": FONT_SIZE,
        "font-weight": i === nameRow ? "bold" : "normal",
        "font-style": italic ? "italic" : "normal",
        fill: c.text,
        "xml:space": "preserve",
      },
    });
  });
  return new dia.Element<dia.Element.Attributes>({
    id: n.id,
    type: "submind.Node",
    position: { x: entry.x, y: entry.y },
    size: { width, height },
    markup,
  });
}

const label = (text: string, distance: number, offset = 0): dia.Link.Label => ({
  position: { distance, offset },
  attrs: {
    text: { text, fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.text },
    rect: { fill: "#ffffff", opacity: 0.85 },
  },
});

/** Text of an association end: role and multiplicity. */
function endText(end: unknown): string {
  const e = (end ?? {}) as { role?: unknown; multiplicity?: unknown };
  return [e.role, e.multiplicity].filter((s) => typeof s === "string" && s !== "").join(" ");
}

/** Link of a class diagram with its UML ends, labels and the vertices of `entry`. */
export function linkCell(e: GraphEdge, entry: LayoutEdge | undefined): dia.Link {
  const n = e.node as Record<string, unknown>;
  const stroke = entry?.style?.stroke ?? COLORS.stroke;
  let sourceMarker = NONE;
  let targetMarker = NONE;
  const labels: dia.Link.Label[] = [];
  const name = typeof n.name === "string" ? n.name : "";
  switch (e.type) {
    case "association":
      if (n.type === "aggregation") sourceMarker = diamond("#ffffff");
      if (n.type === "composition") sourceMarker = diamond(stroke);
      if (n.direction === "directed") targetMarker = OPEN_ARROW;
      if (name) labels.push(label(name, 0.5));
      if (endText(n.end1)) labels.push(label(endText(n.end1), 30, -12));
      if (endText(n.end2)) labels.push(label(endText(n.end2), -30, -12));
      break;
    case "generalization":
    case "realization":
      targetMarker = TRIANGLE;
      break;
    case "dependency":
      targetMarker = OPEN_ARROW;
      if (name) labels.push(label(name, 0.5));
      break;
  }
  const dashed = e.type === "dependency" || e.type === "realization";
  return new shapes.standard.Link({
    id: e.id,
    source: { id: e.source },
    target: { id: e.target },
    vertices: entry?.vertices ?? [],
    labels,
    attrs: {
      line: {
        stroke,
        strokeWidth: 1.2,
        strokeDasharray: dashed ? "6 4" : "none",
        sourceMarker: { ...sourceMarker, stroke },
        targetMarker: { ...targetMarker, stroke },
      },
    },
  });
}

// --- sequence diagrams (DEC-018): cells drawn from the geometry of src/layout/sequence-layout.ts --------

const text = (
  content: string,
  x: number,
  y: number,
  anchor: "start" | "middle",
  fill: string,
  weight = "normal",
): dia.MarkupNodeJSON => ({
  tagName: "text",
  textContent: content,
  attributes: {
    x,
    y,
    "text-anchor": anchor,
    "font-family": FONT_FAMILY,
    "font-size": FONT_SIZE,
    "font-weight": weight,
    fill,
    "xml:space": "preserve",
  },
});

/** Lifeline: header box, dashed line to its end and an X if destroyed. Moves only horizontally. */
export function lifelineCell(l: LifelineGeometry, style: Style | undefined): dia.Element {
  const c = { ...COLORS, ...style };
  const m = l.width / 2;
  const length = l.bottom - l.y;
  const markup: dia.MarkupJSON = [
    // Wide transparent strip so that the line can be grabbed.
    {
      tagName: "rect",
      attributes: {
        x: m - 6,
        y: l.headerHeight,
        width: 12,
        height: length - l.headerHeight,
        fill: "transparent",
      },
    },
    {
      tagName: "path",
      attributes: {
        d: `M ${String(m)} ${String(l.headerHeight)} V ${String(length)}`,
        stroke: c.stroke,
        "stroke-dasharray": "6 4",
      },
    },
    {
      tagName: "rect",
      selector: "body",
      attributes: { width: l.width, height: l.headerHeight, fill: c.fill, stroke: c.stroke },
    },
    ...l.rows.map((r, i) =>
      text(r.text, m, r.y, "middle", c.text, i === l.rows.length - 1 ? "bold" : "normal"),
    ),
  ];
  if (l.destroyed) {
    markup.push({
      tagName: "path",
      attributes: {
        d: `M ${String(m - 8)} ${String(length - 8)} l 16 16 M ${String(m + 8)} ${String(length - 8)} l -16 16`,
        stroke: c.stroke,
        "stroke-width": 2,
      },
    });
  }
  return new dia.Element<dia.Element.Attributes>({
    id: l.id,
    type: "submind.Lifeline",
    position: { x: l.x, y: l.y },
    size: { width: l.width, height: length + (l.destroyed ? 8 : 0) },
    markup,
  });
}

/** Handle at the end of a lifeline: dragging it vertically changes the lifeline's length. */
export function lifelineEndCell(l: LifelineGeometry): dia.Element {
  return new dia.Element<dia.Element.Attributes>({
    id: `end:${l.id}`,
    type: "submind.LifelineEnd",
    position: { x: l.x + l.width / 2 - 8, y: l.bottom - 3 },
    size: { width: 16, height: 6 },
    markup: [
      {
        tagName: "rect",
        selector: "body",
        attributes: { width: 16, height: 6, rx: 2, fill: COLORS.stroke, cursor: "ns-resize" },
      },
    ],
  });
}

/** Execution specification: a narrow box on its lifeline. */
export function executionCell(e: ExecutionGeometry): dia.Element {
  return new dia.Element<dia.Element.Attributes>({
    id: e.id,
    type: "submind.Execution",
    position: { x: e.x, y: e.y },
    size: { width: e.width, height: e.height },
    markup: [
      {
        tagName: "rect",
        selector: "body",
        attributes: { width: e.width, height: e.height, fill: "#eceff1", stroke: COLORS.stroke },
      },
    ],
  });
}

/** Combined fragment (operator tab, operands with guards) or interaction use (`ref` and its name). */
export function fragmentCell(f: FragmentGeometry): dia.Element {
  const tab = f.label.length * CHAR_WIDTH + 2 * PAD_X;
  const h = FONT_SIZE + 8;
  const markup: dia.MarkupJSON = [
    {
      tagName: "rect",
      selector: "body",
      attributes: {
        width: f.width,
        height: f.height,
        fill: f.type === "interaction_use" ? COLORS.fill : "none",
        stroke: COLORS.stroke,
      },
    },
    {
      tagName: "path",
      attributes: {
        d: `M 0 0 H ${String(tab)} V ${String(h - 6)} L ${String(tab - 6)} ${String(h)} H 0 Z`,
        fill: "#ffffff",
        stroke: COLORS.stroke,
      },
    },
    text(f.label, PAD_X, h - 6, "start", COLORS.text, "bold"),
  ];
  if (f.type === "interaction_use") {
    markup.push(text(f.text, f.width / 2, f.height / 2 + 4, "middle", COLORS.text));
  }
  f.operands.forEach((o, i) => {
    const top = o.y - f.y;
    if (i > 0) {
      markup.push({
        tagName: "path",
        attributes: {
          d: `M 0 ${String(top)} H ${String(f.width)}`,
          stroke: COLORS.stroke,
          "stroke-dasharray": "6 4",
        },
      });
    }
    if (o.guard !== "")
      markup.push(text(o.guard, i === 0 ? tab + 6 : PAD_X, top + h - 6, "start", COLORS.text));
  });
  return new dia.Element<dia.Element.Attributes>({
    id: f.id,
    type: "submind.Fragment",
    position: { x: f.x, y: f.y },
    size: { width: f.width, height: f.height },
    markup,
  });
}

const FILLED_ARROW = (fill: string): Marker => ({ type: "path", d: "M 10 -5 0 0 10 5 z", fill });
const DOT = (fill: string): Marker => ({
  type: "path",
  d: "M 0 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
  fill,
});

/** Message: a line between fixed points with its arrowhead by sort; lost/found end in a filled circle. */
export function messageCell(m: MessageGeometry, entry: LayoutEdge | undefined): dia.Link {
  const stroke = entry?.style?.stroke ?? COLORS.stroke;
  const head = m.head === "filled" ? FILLED_ARROW(stroke) : OPEN_ARROW;
  const start = m.points[0] ?? { x: 0, y: 0 };
  const end = m.points.at(-1) ?? start;
  return new shapes.standard.Link({
    id: m.id,
    source: start,
    target: end,
    vertices: m.points.slice(1, -1),
    labels: m.label === "" ? [] : [label(m.label, 0.5, m.points.length > 2 ? 0 : -10)],
    attrs: {
      line: {
        stroke,
        strokeWidth: 1.2,
        strokeDasharray: m.line === "dashed" ? "6 4" : "none",
        sourceMarker: { ...(m.found ? DOT(stroke) : NONE), stroke },
        targetMarker: { ...(m.lost ? DOT(stroke) : head), stroke },
      },
    },
  });
}
