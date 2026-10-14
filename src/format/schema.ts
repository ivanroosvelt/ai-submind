// Loading of the format's JSON Schemas and navigation by schema location. Schemas are read from
// spec/format/schema/<version>/ (published with the package via `files` in package.json), which sits at
// the same depth from src/format/ and from dist/format/.
import { readFileSync, readdirSync } from "node:fs";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import type { DocumentKind } from "./types.js";

export type Version = readonly [number, number];

export const SUPPORTED_VERSION = "1.0";
export const SUPPORTED_VERSION_PARTS: Version = [1, 0];

const SCHEMA_DIR = new URL(`../../spec/format/schema/${SUPPORTED_VERSION}/`, import.meta.url);
const URN = `urn:ai-submind:format:${SUPPORTED_VERSION}`;

export type SchemaNode = Readonly<Record<string, unknown>>;

/** Absolute location of a subschema: the document's `$id` plus a JSON Pointer. */
export interface SchemaLocation {
  base: string;
  pointer: string;
}

export function rootLocation(kind: DocumentKind): SchemaLocation {
  return { base: `${URN}:${kind === "manifest" ? "ai-submind" : kind}`, pointer: "" };
}

export class SchemaSet {
  readonly ajv: Ajv2020;
  private readonly documents = new Map<string, SchemaNode>();
  private readonly validators = new Map<string, ValidateFunction>();

  constructor(dir: URL = SCHEMA_DIR) {
    this.ajv = new Ajv2020({ allErrors: true, strict: true });
    for (const name of readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()) {
      const schema = JSON.parse(readFileSync(new URL(name, dir), "utf8")) as SchemaNode;
      const id = schema.$id;
      if (typeof id !== "string") throw new Error(`schema without $id: ${name}`);
      this.documents.set(id, schema);
      this.ajv.addSchema(schema);
    }
  }

  /** Compiled validator for the subschema at `loc` (cached). */
  validator(loc: SchemaLocation): ValidateFunction {
    const key = `${loc.base}#${loc.pointer}`;
    let v = this.validators.get(key);
    if (!v) {
      v = loc.pointer === "" ? this.ajv.getSchema(loc.base) : this.ajv.compile({ $ref: key });
      if (!v) throw new Error(`schema not registered: ${key}`);
      this.validators.set(key, v);
    }
    return v;
  }

  /** Schema node at `loc`, following `$ref` until a node without `$ref`. */
  resolve(loc: SchemaLocation): { node: SchemaNode; loc: SchemaLocation } {
    for (let depth = 0; depth < 32; depth++) {
      const node = this.at(loc);
      const ref = node.$ref;
      if (typeof ref !== "string") return { node, loc };
      const hash = ref.indexOf("#");
      const doc = hash === 0 ? loc.base : ref.slice(0, hash < 0 ? undefined : hash);
      loc = { base: doc, pointer: hash < 0 ? "" : ref.slice(hash + 1) };
    }
    throw new Error(`$ref chain too long at ${loc.base}#${loc.pointer}`);
  }

  /** Location of a child of the node at `loc` (e.g. `properties`, `name`). */
  child(loc: SchemaLocation, ...segments: (string | number)[]): SchemaLocation {
    return { base: loc.base, pointer: loc.pointer + segments.map((s) => `/${String(s)}`).join("") };
  }

  /** Raw node at `loc`, without following `$ref`. */
  at(loc: SchemaLocation): SchemaNode {
    let node: unknown = this.documents.get(loc.base);
    for (const seg of loc.pointer.split("/").slice(1)) {
      node = (node as Record<string, unknown> | undefined)?.[seg];
    }
    if (node === null || typeof node !== "object") {
      throw new Error(`schema location does not exist: ${loc.base}#${loc.pointer}`);
    }
    return node as SchemaNode;
  }
}

let shared: SchemaSet | undefined;

/** Schemas of the supported version, loaded once per process. */
export function schemas(): SchemaSet {
  shared ??= new SchemaSet();
  return shared;
}

export function parseVersion(v: string): Version | undefined {
  const m = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(v);
  return m ? [Number(m[1]), Number(m[2])] : undefined;
}

/** Compares `MAJOR.MINOR` versions: negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1];
}

export type JsonObject = Record<string, unknown>;

export const isObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** `anyOf` branch whose type matches the value (`null` branches are never chosen: null is omitted). */
export function pickBranch(
  set: SchemaSet,
  node: SchemaNode,
  loc: SchemaLocation,
  value: unknown,
): SchemaLocation | undefined {
  const branches = Array.isArray(node.anyOf) ? node.anyOf : [];
  for (let i = 0; i < branches.length; i++) {
    const r = set.resolve(set.child(loc, "anyOf", i));
    const t = r.node.type;
    if (t === "null") continue;
    const matches = Array.isArray(value)
      ? t === "array"
      : isObject(value)
        ? t === "object" || (t === undefined && "properties" in r.node)
        : t !== "array" && t !== "object";
    if (matches) return r.loc;
  }
  return undefined;
}

/** A property of an object shape: its name and the schema location that describes its value. */
export interface ShapeProperty {
  name: string;
  loc: SchemaLocation;
}

/**
 * Effective properties of an object, in canonical order, plus the union of `required`.
 *
 * Applicable `allOf`/`if`/`then` branches are handled in two ways:
 * - a `then` that is a `$ref` to a complete object schema (fragments by `type`) replaces the base
 *   properties, so the order is that of the concrete subschema (spec §9.2);
 * - an inline `then` (e.g. the `sequence` diagram constraint) only refines: base properties keep their
 *   order and location, and properties that exist only in the branch are appended.
 */
export function objectShape(
  set: SchemaSet,
  node: SchemaNode,
  loc: SchemaLocation,
  value: JsonObject,
): { props: ShapeProperty[]; required: Set<string> } {
  const own = (n: SchemaNode, l: SchemaLocation): ShapeProperty[] =>
    Object.keys(isObject(n.properties) ? n.properties : {}).map((name) => ({
      name,
      loc: set.child(l, "properties", name),
    }));
  let props = own(node, loc);
  const required = new Set(stringArray(node.required));
  const allOf = Array.isArray(node.allOf) ? node.allOf : [];
  for (let i = 0; i < allOf.length; i++) {
    const cond: unknown = (allOf[i] as JsonObject).if;
    const condProps = isObject(cond) && isObject(cond.properties) ? cond.properties : {};
    const applies =
      Object.keys(condProps).length > 0 &&
      Object.entries(condProps).every(([k, s]) => isObject(s) && value[k] === s.const);
    if (!applies) continue;
    const thenLoc = set.child(loc, "allOf", i, "then");
    const isRef = typeof set.at(thenLoc).$ref === "string";
    const then = set.resolve(thenLoc);
    for (const r of stringArray(then.node.required)) required.add(r);
    const branch = own(then.node, then.loc);
    if (isRef) {
      props = branch;
    } else {
      const known = new Set(props.map((p) => p.name));
      props = [...props, ...branch.filter((p) => !known.has(p.name))];
    }
  }
  return { props, required };
}
