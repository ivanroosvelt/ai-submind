// Metadata attached to every query result: state of knowledge/, excluded and read-only documents.
import { compareCodeUnits } from "../format/canonical.js";
import { classifyPath, type DocumentStatus } from "../format/document.js";
import type { ValidationCode } from "../format/findings.js";
import type { ElementType } from "../format/semantic.js";
import type { DocumentKind } from "../format/types.js";
import type { Engine } from "../engine/engine.js";

/** Where an element occurs: file relative to knowledge/ and JSON Pointer into the file as read. */
export interface ElementLocation {
  file: string;
  pointer: string;
  type: ElementType;
}

/** Document left out of the queries (REQ-022): not loaded, or found by the walk but not read. */
export interface ExcludedDocument {
  path: string;
  kind?: DocumentKind;
  status: DocumentStatus | "unread";
  /** Validation codes of its findings, sorted and without repetitions. */
  codes: ValidationCode[];
}

export interface QueryMeta {
  /** Engine generation the result was computed on. */
  generation: number;
  state: "ok" | "degraded";
  excluded: ExcludedDocument[];
  /** Documents loaded read-only (unsupported version, tolerant reading). */
  readOnly: string[];
}

export interface QueryResult<T> {
  data: T;
  meta: QueryMeta;
}

const uniqueCodes = (codes: Iterable<ValidationCode>): ValidationCode[] =>
  [...new Set(codes)].sort(compareCodeUnits);

/** Metadata of the current state of `engine`. */
export function metaOf(engine: Engine): QueryMeta {
  const status = engine.status();
  const excluded: ExcludedDocument[] = [];
  const readOnly: string[] = [];
  const known = new Set<string>();
  for (const d of status.documents) {
    known.add(d.path);
    if (d.status === "read_only") readOnly.push(d.path);
    if (d.status === "writable" || d.status === "read_only") continue;
    const findings = engine.document(d.path)?.findings ?? [];
    excluded.push({
      path: d.path,
      kind: d.kind,
      status: d.status,
      codes: uniqueCodes(findings.map((f) => f.code)),
    });
  }
  // Walk findings on document paths that have no entry: the file exists but could not be read.
  const unread = new Map<string, ValidationCode[]>();
  for (const f of status.findings) {
    if (known.has(f.file) || classifyPath(f.file) === undefined) continue;
    const list = unread.get(f.file);
    if (list) list.push(f.code);
    else unread.set(f.file, [f.code]);
  }
  for (const [path, codes] of unread) {
    const x: ExcludedDocument = { path, status: "unread", codes: uniqueCodes(codes) };
    const kind = classifyPath(path);
    if (kind !== undefined) x.kind = kind;
    excluded.push(x);
  }
  return {
    generation: engine.generation,
    state: status.state,
    excluded: excluded.sort((a, b) => compareCodeUnits(a.path, b.path)),
    readOnly: readOnly.sort(compareCodeUnits),
  };
}
