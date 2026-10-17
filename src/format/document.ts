// Validation phases 1–3 on a single document (spec §10.1): file, version and schema.
import type { ErrorObject } from "ajv/dist/2020.js";
import { finding, pointerSegment, type Finding } from "./findings.js";
import {
  compareVersions,
  isObject,
  objectShape,
  parseVersion,
  pickBranch,
  rootLocation,
  schemas,
  schemaVersion,
  SUPPORTED_VERSION,
  SUPPORTED_VERSIONS,
  type SchemaLocation,
  type SchemaSet,
} from "./schema.js";
import type { DocumentKind } from "./types.js";

/**
 * Load status: `writable` (valid in phases 1–3), `read_only` (unsupported version, tolerant reading), or
 * not loaded because of a file error (`invalid_encoding`, `conflicted`, `invalid_parse`) or a schema
 * error (`invalid_schema`). Only `writable` and `read_only` take part in phase 4 and in queries.
 */
export type DocumentStatus =
  "writable" | "read_only" | "invalid_encoding" | "conflicted" | "invalid_parse" | "invalid_schema";

export interface ParsedDocument {
  /** Path relative to knowledge/, with `/`. */
  path: string;
  kind: DocumentKind;
  status: DocumentStatus;
  /** Validated content (tolerated, if `read_only`); absent when the document was not loaded. */
  data?: unknown;
  /**
   * Only for `read_only`: pointer of each kept array item in `data` → its pointer in the file as read.
   * Tolerant reading drops items, so indices in `data` may differ from the file.
   */
  pointerMap?: ReadonlyMap<string, string>;
  findings: Finding[];
}

export const isLoaded = (d: ParsedDocument): boolean =>
  d.status === "writable" || d.status === "read_only";

/** Pointer in the file as read for a pointer into `doc.data` (identity unless tolerant reading). */
export function originalPointer(doc: ParsedDocument, ptr: string): string {
  const map = doc.pointerMap;
  if (!map) return ptr;
  let tolerated = "";
  let original = "";
  for (const seg of ptr.split("/").slice(1)) {
    tolerated += `/${seg}`;
    original = map.get(tolerated) ?? `${original}/${seg}`;
  }
  return original;
}

/** Document kind by path (spec §2); `undefined` = unexpected file. */
export function classifyPath(path: string): DocumentKind | undefined {
  if (path === "ai-submind.json") return "manifest";
  if (/^models\/[^/]+\.json$/.test(path)) return "model";
  if (/^layout\/[^/]+\.json$/.test(path)) return "layout";
  return undefined;
}

// Line start = start of text or after LF or CR. Not the `m` flag: in ECMAScript it also matches after
// U+2028/U+2029, which JSON allows unescaped inside strings.
const MERGE_MARKER = /(^|[\n\r])(<<<<<<<|=======|>>>>>>>)/;
const CODE_REF_PATH = /\/code_refs\/\d+\/path$/;

function schemaFindings(path: string, errors: readonly ErrorObject[]): Finding[] {
  return errors
    .filter((e) => e.keyword !== "if") // redundant: the real error is the one of the `then` branch
    .map((e) => {
      const extra =
        e.keyword === "additionalProperties" ? ` (${String(e.params.additionalProperty)})` : "";
      const code = CODE_REF_PATH.test(e.instancePath) ? "CODE_REF_INVALID" : "SCHEMA_VIOLATION";
      return finding(
        code,
        path,
        e.instancePath,
        `${e.keyword}: ${e.message ?? "does not conform to the schema"}${extra}`,
      );
    });
}

/**
 * Tolerant reading (spec §11): keeps what conforms to the schema of the supported version, drops
 * unknown keys and values and items without a recognizable minimal shape. Records in `map` the original
 * pointer of every kept array item (`tp` = pointer in the result, `op` = pointer in the input).
 */
function tolerate(
  set: SchemaSet,
  value: unknown,
  at: SchemaLocation,
  tp: string,
  op: string,
  map: Map<string, string>,
): unknown {
  // Without narrowing: the validator is a type guard on `unknown` and would leave `never` otherwise.
  const valid: boolean = set.validator(at)(value);
  const { node, loc } = set.resolve(at);
  if (valid) {
    if (tp !== op) map.set(tp, op);
    return value;
  }
  if (node.anyOf !== undefined) {
    const branch = pickBranch(set, node, loc, value);
    return branch ? tolerate(set, value, branch, tp, op, map) : undefined;
  }
  // Entries are collected locally and merged only if this node is kept.
  const local = new Map<string, string>();
  let out: unknown;
  if (Array.isArray(value)) {
    const items: unknown[] = [];
    // Sets (`uniqueItems`): repeated items are dropped, keeping the first one, so the rest survives.
    const seen = node.uniqueItems === true ? new Set<string>() : undefined;
    value.forEach((x, i) => {
      const itemMap = new Map<string, string>();
      const itp = `${tp}/${String(items.length)}`;
      const iop = `${op}/${String(i)}`;
      const t = tolerate(set, x, set.child(loc, "items"), itp, iop, itemMap);
      if (t === undefined) return;
      if (seen) {
        const key = JSON.stringify(t);
        if (seen.has(key)) return;
        seen.add(key);
      }
      items.push(t);
      local.set(itp, iop);
      for (const [k, v] of itemMap) local.set(k, v);
    });
    out = items;
  } else if (isObject(value) && isObject(node.additionalProperties)) {
    const entries: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const seg = `/${pointerSegment(k)}`;
      const t = tolerate(set, v, set.child(loc, "additionalProperties"), tp + seg, op + seg, local);
      if (t !== undefined) entries[k] = t;
    }
    out = entries;
  } else if (isObject(value)) {
    const { props, required } = objectShape(set, node, loc, value);
    const obj: Record<string, unknown> = {};
    for (const p of props) {
      if (!(p.name in value)) continue;
      const seg = `/${pointerSegment(p.name)}`;
      const t = tolerate(set, value[p.name], p.loc, tp + seg, op + seg, local);
      if (t !== undefined) obj[p.name] = t;
      else if (required.has(p.name)) return undefined;
    }
    out = obj;
  } else {
    return undefined;
  }
  if (!set.validator(loc)(out)) return undefined;
  for (const [k, v] of local) map.set(k, v);
  return out;
}

/** Phases 1 (file), 2 (version) and 3 (schema) of an already classified knowledge/ document. */
export function parseDocument(
  path: string,
  kind: DocumentKind,
  bytes: Uint8Array,
  set: SchemaSet = schemas(),
): ParsedDocument {
  const fail = (status: DocumentStatus, f: Finding): ParsedDocument => ({
    path,
    kind,
    status,
    findings: [f],
  });

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return fail(
      "invalid_encoding",
      finding("FILE_ENCODING", path, "", "file starts with a UTF-8 BOM"),
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("invalid_encoding", finding("FILE_ENCODING", path, "", "file is not valid UTF-8"));
  }
  if (MERGE_MARKER.test(text)) {
    return fail("conflicted", finding("MERGE_CONFLICT", path, "", "Git conflict markers"));
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return fail("invalid_parse", finding("JSON_PARSE", path, "", message));
  }

  const findings: Finding[] = [];
  const declared =
    isObject(data) && typeof data.format_version === "string" ? data.format_version : undefined;
  const version = declared === undefined ? undefined : parseVersion(declared);
  const current = parseVersion(SUPPORTED_VERSION) ?? [0, 0];
  if (
    declared !== undefined &&
    SUPPORTED_VERSIONS.includes(declared) &&
    declared !== SUPPORTED_VERSION
  ) {
    findings.push(
      finding(
        "FORMAT_VERSION_OUTDATED",
        path,
        "/format_version",
        `version ${declared} is earlier than the current one (${SUPPORTED_VERSION}): run migrate to upgrade`,
      ),
    );
  } else if (version !== undefined && compareVersions(version, current) !== 0) {
    // Versions without a schema (later, or earlier and not migratable) are opened read-only with
    // tolerant reading against the current schema (spec §11).
    const later = compareVersions(version, current) > 0;
    findings.push(
      finding(
        "FORMAT_VERSION_UNSUPPORTED",
        path,
        "/format_version",
        `version ${String(declared)} is ${later ? "later than" : "earlier than and not migratable to"} the supported one (${SUPPORTED_VERSION}): read-only`,
      ),
    );
    const pointerMap = new Map<string, string>();
    const tolerated = tolerate(set, data, rootLocation(kind), "", "", pointerMap);
    if (tolerated === undefined) {
      findings.push(
        finding(
          "FORMAT_VERSION_UNSUPPORTED",
          path,
          "",
          "tolerant reading recovered nothing: the document root has no recognizable shape",
        ),
      );
    }
    return tolerated === undefined
      ? { path, kind, status: "read_only", findings }
      : { path, kind, status: "read_only", data: tolerated, pointerMap, findings };
  }

  // Each supported version is validated with its own schema; a missing or malformed version is a
  // schema error of the current one.
  const loc = rootLocation(kind, schemaVersion(data));
  const validate = set.validator(loc);
  if (!validate(data)) {
    findings.push(...schemaFindings(path, validate.errors ?? []));
    return { path, kind, status: "invalid_schema", findings };
  }
  return { path, kind, status: "writable", data, findings };
}
