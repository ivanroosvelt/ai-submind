// Identifier grammar and derivation (spec §3.1, §3.3). The grammar is read from the format schema
// (defs `fileId` / `elementId`) so it has a single source.
import { schemas, type SchemaSet } from "../format/schema.js";
import { EngineError } from "./errors.js";

const DEFS = "urn:ai-submind:format:1.0:defs";

export const FILE_ID_MAX = 64;
export const ELEMENT_ID_MAX = 256;

/** True if `id` satisfies the grammar of its class (spec §3.1). */
export function isValidId(id: string, fileId: boolean, set: SchemaSet = schemas()): boolean {
  const v = set.validator({ base: DEFS, pointer: `/$defs/${fileId ? "fileId" : "elementId"}` });
  return v(id);
}

/** Segment of an element ID derived from a name (spec §3.3 `seg`). */
export function seg(text: string): string {
  const s = text
    .normalize("NFC")
    .replace(/\s+/gu, "_")
    .replace(/[^\p{L}\p{N}_$-]/gu, "")
    .replace(/-+$/u, "");
  return s === "" || s.startsWith("-") ? `_${s}` : s;
}

/** File ID derived from a name (spec §3.3 `slug`); empty if nothing remains. */
export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, FILE_ID_MAX)
    .replace(/^-+|-+$/g, "");
}

// Code points, as the schema's `maxLength` counts them.
const codePoints = (s: string): number => Array.from(s).length;

/** Trailing characters that cannot end an element ID (spec §3.1). */
const BAD_END = /[^\p{L}\p{N}_$)]+$/u;

/**
 * Assembles `prefix + segment + suffix + tail`, truncating `segment` (code points) so the whole fits in
 * `max` and trimming the characters left at its end that cannot end an ID (spec §3.3). Fails with
 * `INVALID_ID` if not even one character of the segment fits.
 */
function fit(prefix: string, segment: string, suffix: string, tail: string, max: number): string {
  const room = max - codePoints(prefix) - codePoints(suffix) - codePoints(tail);
  let s = segment;
  if (codePoints(s) > room)
    s = Array.from(s).slice(0, Math.max(room, 0)).join("").replace(BAD_END, "");
  if (s === "") {
    throw new EngineError("INVALID_ID", `no room for a derived segment after ${prefix}`, {
      id: `${prefix}${segment}${tail}`,
    });
  }
  return `${prefix}${s}${suffix}${tail}`;
}

/** Parts of a derived ID: only `segment` is truncated and receives the collision suffix. */
export interface IdParts {
  /** Owner prefix, kept intact (e.g. `Car.`). */
  prefix?: string;
  /** Last derived segment. */
  segment: string;
  /** Kept after the suffix (operations: `()`). */
  tail?: string;
  /** File ID (models, diagrams): 64 code points instead of 256. */
  fileId?: boolean;
}

/**
 * First free ID for `parts`: the base form, or `-2`, `-3`, … (the lowest free) appended to the last
 * segment, before `()` (spec §3.3 collisions).
 */
export function uniqueId(parts: IdParts, exists: (id: string) => boolean): string {
  const max = parts.fileId === true ? FILE_ID_MAX : ELEMENT_ID_MAX;
  const prefix = parts.prefix ?? "";
  const tail = parts.tail ?? "";
  for (let n = 1; ; n++) {
    const id = fit(prefix, parts.segment, n === 1 ? "" : `-${String(n)}`, tail, max);
    if (!isValidId(id, parts.fileId === true)) {
      throw new EngineError("INVALID_ID", `derived ID ${id} does not satisfy the grammar`, { id });
    }
    if (!exists(id)) return id;
  }
}

/** What is being created, with the data the derivation table of spec §3.3 needs. */
export type DeriveInput =
  | { type: "model" | "diagram"; name: string }
  | {
      type:
        | "package"
        | "actor"
        | "class"
        | "interface"
        | "data_type"
        | "enumeration"
        | "primitive_type"
        | "interaction";
      name: string;
    }
  | { type: "attribute"; owner: string; name: string }
  | { type: "operation"; owner: string; name: string }
  | { type: "parameter"; operation: string; name: string }
  | { type: "association"; name?: string; end1: string; end2: string }
  | { type: "association_end"; association: string; end: 1 | 2 }
  | { type: "generalization"; specific: string; general: string }
  | { type: "realization"; client: string; supplier: string }
  | { type: "dependency"; name?: string; client: string; supplier: string }
  /** `representsName`: name (not ID) of the represented classifier or actor, used when `name` is empty. */
  | { type: "lifeline"; interaction: string; name: string; representsName?: string }
  | { type: "message"; interaction: string; name: string }
  | { type: "occurrence"; interaction: string; message?: string; end?: "send" | "receive" }
  | { type: "combined_fragment"; interaction: string; operator: string }
  | { type: "operand"; fragment: string; position: number }
  | { type: "interaction_use"; interaction: string; used: string };

const blank = (s: string | undefined): boolean => s === undefined || s.trim() === "";

/** Base parts of the ID of a new element (spec §3.3, table), before collision handling. */
export function idParts(input: DeriveInput): IdParts {
  switch (input.type) {
    case "model":
    case "diagram":
      return { segment: slug(input.name) || input.type, fileId: true };
    case "attribute":
      return { prefix: `${input.owner}.`, segment: seg(input.name) };
    case "operation":
      return { prefix: `${input.owner}.`, segment: seg(input.name), tail: "()" };
    case "parameter":
      return { prefix: `${input.operation}.`, segment: seg(input.name) };
    case "association":
      return blank(input.name)
        ? { segment: `${input.end1}--${input.end2}` }
        : { segment: seg(input.name ?? "") };
    case "association_end":
      return { prefix: `${input.association}.`, segment: `end${String(input.end)}` };
    case "generalization":
      return { segment: `${input.specific}--extends--${input.general}` };
    case "realization":
      return { segment: `${input.client}--implements--${input.supplier}` };
    case "dependency":
      return blank(input.name)
        ? { segment: `${input.client}--uses--${input.supplier}` }
        : { segment: seg(input.name ?? "") };
    case "lifeline": {
      const name = blank(input.name) ? input.representsName : input.name;
      return {
        prefix: `${input.interaction}.`,
        segment: blank(name) ? "lifeline" : seg(name ?? ""),
      };
    }
    case "message":
      return {
        prefix: `${input.interaction}.`,
        segment: blank(input.name) ? "msg" : seg(input.name),
      };
    case "occurrence":
      return input.message !== undefined && input.end !== undefined
        ? { prefix: `${input.message}.`, segment: input.end }
        : { prefix: `${input.interaction}.`, segment: "occ" };
    case "combined_fragment":
      return { prefix: `${input.interaction}.`, segment: input.operator };
    case "operand":
      return { prefix: `${input.fragment}.`, segment: `op${String(input.position)}` };
    case "interaction_use":
      return { prefix: `${input.interaction}.`, segment: `ref--${input.used}` };
    default:
      return { segment: seg(input.name) };
  }
}

/** ID of a new element: derived (spec §3.3) and unique against `exists`. Never recomputed later. */
export function deriveId(input: DeriveInput, exists: (id: string) => boolean): string {
  return uniqueId(idParts(input), exists);
}
