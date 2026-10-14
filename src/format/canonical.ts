// Canonical serialization (spec §9). Schema-driven: key order is the order of `properties`, required-ness
// decides which empty values are omitted, and set arrays are sorted by a stable key.
// Precondition: the document conforms to the schema of its version. Keys unknown to the schema are
// dropped, so callers must validate before writing (PLAN-002 S5 entry criterion).
import {
  isObject,
  objectShape,
  pickBranch,
  rootLocation,
  schemas,
  type SchemaLocation,
  type SchemaSet,
} from "./schema.js";
import type { DocumentKind } from "./types.js";

/** Set arrays (§9.5) are sorted. Every other array is ordered and preserved (§9.4). */
const SET_KEYS = new Set([
  "packages",
  "actors",
  "classes",
  "interfaces",
  "data_types",
  "enumerations",
  "primitive_types",
  "associations",
  "generalizations",
  "dependencies",
  "realizations",
  "interactions",
  "diagrams",
  "messages",
  "members",
  "covered",
  "elements",
  "stereotypes",
  "tags",
  "code_refs",
]);

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Comparison by UTF-16 code units, like ECMAScript `<` (§9.5). */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareSetItems(a: Json, b: Json): number {
  if (typeof a === "string" && typeof b === "string") return compareCodeUnits(a, b);
  if (isObject(a) && isObject(b)) {
    const ka = a.id ?? a.idref;
    const kb = b.id ?? b.idref;
    if (typeof ka === "string" && typeof kb === "string") return compareCodeUnits(ka, kb);
    if (typeof a.path === "string" && typeof b.path === "string") {
      // code_refs: by path, then symbol; an entry without symbol comes first.
      const sa = typeof a.symbol === "string" ? a.symbol : undefined;
      const sb = typeof b.symbol === "string" ? b.symbol : undefined;
      if (sa === undefined || sb === undefined) {
        return compareCodeUnits(a.path, b.path) || (sa === sb ? 0 : sa === undefined ? -1 : 1);
      }
      return compareCodeUnits(a.path, b.path) || compareCodeUnits(sa, sb);
    }
  }
  return 0;
}

const isEmpty = (v: Json | undefined): boolean =>
  v === undefined ||
  v === null ||
  v === "" ||
  (Array.isArray(v) ? v.length === 0 : isObject(v) && Object.keys(v).length === 0);

function canon(
  set: SchemaSet,
  value: unknown,
  at: SchemaLocation,
  key: string | undefined,
): Json | undefined {
  if (value === null || value === undefined) return undefined;
  const { node, loc } = set.resolve(at);
  if (node.anyOf !== undefined) {
    const branch = pickBranch(set, node, loc, value);
    return branch ? canon(set, value, branch, key) : (value as Json);
  }
  if (Array.isArray(value)) {
    const items = value
      .map((x) => canon(set, x, set.child(loc, "items"), undefined))
      .filter((x): x is Json => x !== undefined);
    return key !== undefined && SET_KEYS.has(key) ? items.sort(compareSetItems) : items;
  }
  if (isObject(value)) {
    const out: Record<string, Json> = {};
    if (isObject(node.additionalProperties)) {
      // Map (layout nodes/edges): keys by code point; empty entries are omitted.
      for (const k of Object.keys(value).sort(compareCodeUnits)) {
        const c = canon(set, value[k], set.child(loc, "additionalProperties"), k);
        if (!isEmpty(c)) out[k] = c as Json;
      }
      return out;
    }
    const { props, required } = objectShape(set, node, loc, value);
    for (const p of props) {
      if (!(p.name in value)) continue;
      const c = canon(set, value[p.name], p.loc, p.name);
      if (!isEmpty(c)) out[p.name] = c as Json;
      else if (required.has(p.name)) out[p.name] = c ?? null;
    }
    return out;
  }
  return value as Json;
}

/** In-memory canonical form (ordered keys, empty values omitted, sets sorted). */
export function canonicalize(
  kind: DocumentKind,
  data: unknown,
  set: SchemaSet = schemas(),
): unknown {
  return canon(set, data, rootLocation(kind), undefined);
}

function emit(v: Json, indent: string): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  const inner = `${indent}  `;
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    return `[\n${v.map((x) => inner + emit(x, inner)).join(",\n")}\n${indent}]`;
  }
  const keys = Object.keys(v);
  if (keys.length === 0) return "{}";
  if (keys.length === 1 && keys[0] === "idref") return `{"idref": ${JSON.stringify(v.idref)}}`;
  return `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${emit(v[k] as Json, inner)}`).join(",\n")}\n${indent}}`;
}

/** Canonical text of the document (§9), with a trailing newline. */
export function serialize(kind: DocumentKind, data: unknown, set: SchemaSet = schemas()): string {
  return `${emit((canonicalize(kind, data, set) ?? null) as Json, "")}\n`;
}
