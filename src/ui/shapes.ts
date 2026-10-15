// Own UML shapes over @joint/core (DEC-006, DEC-017): nodes drawn from the text, rows and size computed by
// src/layout/size.ts (never measured in the DOM) and links with UML ends. No JointJS+ code.
import { dia, shapes } from "@joint/core";
import type { LayoutEdge, LayoutNode } from "../format/types.js";
import { boxSize, type GraphEdge, type GraphNode } from "../layout/class-layout.js";
import { FIGURE_HEIGHT, FONT_FAMILY, FONT_SIZE, PAD_X, TAB_HEIGHT } from "../layout/size.js";

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
