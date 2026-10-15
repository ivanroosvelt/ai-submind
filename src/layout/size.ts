// Deterministic size of class-diagram shapes (DEC-017, REQ-028): a pure function of the displayed text with
// fixed metrics of a monospace font, shared by the UI (which renders with it instead of measuring the DOM)
// and the MCP auto-layout tool (which runs without a browser).

/** Font of every shape text; the metrics below assume it. */
export const FONT_FAMILY = "ui-monospace, Menlo, Consolas, monospace";
export const FONT_SIZE = 12;
/** Advance of one character in px (0.625 em): not less than that of common monospace fonts. */
export const CHAR_WIDTH = 7.5;
export const LINE_HEIGHT = 16;
export const PAD_X = 8;
export const PAD_Y = 4;
export const MIN_WIDTH = 80;
/** Height of the folder tab of a package. */
export const TAB_HEIGHT = 12;
/** Height of the stick figure of an actor, above its name. */
export const FIGURE_HEIGHT = 48;

/** Element types drawn as nodes in a class diagram (spec §6.6). */
export const NODE_TYPES = [
  "package",
  "actor",
  "class",
  "interface",
  "data_type",
  "enumeration",
  "primitive_type",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/** Name of a referenced element, if known; the ID is shown otherwise. */
export type NameOf = (id: string) => string | undefined;

export interface Row {
  text: string;
  /** Baseline of the text, from the top of the shape. */
  y: number;
  /** Centered (header) or left-aligned at `PAD_X` (compartments). */
  center: boolean;
}

export interface NodeBox {
  /** Keyword/stereotype line, if any, and the name. */
  header: string[];
  /** Attributes and operations, or literals. */
  compartments: string[][];
  width: number;
  height: number;
  rows: Row[];
  /** Y of the line above each compartment. */
  separators: number[];
}

type Obj = Record<string, unknown>;

const KEYWORD: Partial<Record<NodeType, string>> = {
  interface: "interface",
  enumeration: "enumeration",
  data_type: "dataType",
  primitive_type: "primitive",
};
const VISIBILITY: Record<string, string> = {
  public: "+",
  private: "-",
  protected: "#",
  package: "~",
};

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);

function typeName(ref: unknown, nameOf: NameOf): string {
  const id = isObj(ref) ? str(ref.idref) : "";
  return id === "" ? "" : (nameOf(id) ?? id);
}

const vis = (n: Obj): string => {
  const v = VISIBILITY[str(n.visibility)];
  return v === undefined ? "" : `${v} `;
};

function attribute(a: Obj, nameOf: NameOf): string {
  const type = typeName(a.type, nameOf);
  const mult = str(a.multiplicity);
  const value = str(a.default_value);
  return (
    `${vis(a)}${a.is_derived === true ? "/" : ""}${str(a.name)}` +
    `${type ? `: ${type}` : ""}${mult ? ` [${mult}]` : ""}${value ? ` = ${value}` : ""}`
  );
}

function operation(o: Obj, nameOf: NameOf): string {
  const params = list(o.parameters).map((p) => {
    const dir = str(p.direction);
    const type = typeName(p.type, nameOf);
    return `${dir && dir !== "in" ? `${dir} ` : ""}${str(p.name)}${type ? `: ${type}` : ""}`;
  });
  const ret = typeName(o.return_type, nameOf);
  return `${vis(o)}${str(o.name)}(${params.join(", ")})${ret ? `: ${ret}` : ""}`;
}

/** Text lines shown by a node: header and compartments. */
function text(type: NodeType, n: Obj, nameOf: NameOf): Pick<NodeBox, "header" | "compartments"> {
  const stereotypes: unknown[] = Array.isArray(n.stereotypes) ? n.stereotypes : [];
  const tags = [KEYWORD[type], ...stereotypes].filter(
    (s): s is string => typeof s === "string" && s !== "",
  );
  const header = [...(tags.length > 0 ? [`«${tags.join(", ")}»`] : []), str(n.name)];
  switch (type) {
    case "class":
    case "interface":
    case "data_type":
      return {
        header,
        compartments: [
          list(n.attributes).map((a) => attribute(a, nameOf)),
          list(n.operations).map((o) => operation(o, nameOf)),
        ],
      };
    case "enumeration":
      return {
        header,
        compartments: [Array.isArray(n.literals) ? n.literals.map((l) => str(l)) : []],
      };
    default:
      return { header, compartments: [] };
  }
}

// ponytail: one advance per code point; East Asian wide glyphs overflow. Use a width table if it matters.
const textWidth = (lines: readonly string[]): number =>
  Math.max(0, ...lines.map((l) => Array.from(l).length * CHAR_WIDTH));

/** Text, size and text positions of a node of `type` (spec §6.3 content). */
export function nodeBox(type: NodeType, node: unknown, nameOf: NameOf): NodeBox {
  const n = isObj(node) ? node : {};
  const { header, compartments } = text(type, n, nameOf);
  const width = Math.max(
    MIN_WIDTH,
    Math.ceil(textWidth([...header, ...compartments.flat()]) + 2 * PAD_X),
  );
  const rows: Row[] = [];
  const separators: number[] = [];
  // Baseline of a line: the text sits in the lower part of its line box.
  const baseline = (top: number, i: number): number => top + i * LINE_HEIGHT + LINE_HEIGHT - 4;
  let y = type === "actor" ? FIGURE_HEIGHT : type === "package" ? TAB_HEIGHT : 0;
  header.forEach((t, i) => rows.push({ text: t, y: baseline(y + PAD_Y, i), center: true }));
  y += header.length * LINE_HEIGHT + 2 * PAD_Y;
  for (const lines of compartments) {
    separators.push(y);
    lines.forEach((t, i) => rows.push({ text: t, y: baseline(y + PAD_Y, i), center: false }));
    y += lines.length * LINE_HEIGHT + 2 * PAD_Y;
  }
  return { header, compartments, width, height: y, rows, separators };
}
