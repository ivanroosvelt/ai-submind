// Element-level edits over the engine (FEAT-002; REQ-021, REQ-023..REQ-027; DEC-015, DEC-016): create with
// derived IDs, merge-patch update, delete with optional cascade, diagram membership and atomic batches of
// them, planned on working copies of the documents and committed as one engine transaction.
import { isObject, SUPPORTED_VERSION } from "../format/schema.js";
import { COLLECTIONS, type ElementType } from "../format/semantic.js";
import type { BatchOperation, Engine, TransactionResult } from "./engine.js";
import { EngineError } from "./errors.js";
import { deriveId, type DeriveInput } from "./ids.js";

/** Manifest written by `ai-submind init` and by the first write on an empty knowledge/ (DEC-015). */
export const MANIFEST = { format_version: SUPPORTED_VERSION } as const;

/** `expectedRevision`: revision of the document the operation touches; a mismatch is `REVISION_CONFLICT`. */
export type EditOperation =
  | {
      op: "create";
      type: ElementType;
      /** Container ID; required except for models. */
      parent?: string;
      data: Record<string, unknown>;
      /** Position in an ordered container (default: append). */
      index?: number;
      expectedRevision?: string;
    }
  | {
      op: "update";
      id: string;
      /** RFC 7396 merge patch: `null` removes a field; objects merge; arrays replace. */
      patch: Record<string, unknown>;
      expectedRevision?: string;
    }
  | { op: "delete"; id: string; cascade?: boolean; expectedRevision?: string }
  | {
      op: "edit_diagram";
      id: string;
      add?: string[];
      remove?: string[];
      expectedRevision?: string;
    };

export interface Affected {
  action: "removed_ref" | "unset" | "deleted";
  file: string;
  /** Pointer in the document as left by the preceding entries (canonical in-memory form); may repeat. */
  pointer: string;
  /** Element deleted, or element (diagram, for a layout entry) whose reference was removed or unset. */
  id: string;
}

export interface EditResult extends TransactionResult {
  dryRun: boolean;
  /** The write created ai-submind.json (DEC-015). */
  initialized: boolean;
  /** ID of the element made by each `create`, in order. */
  created: string[];
  affected: Affected[];
  /** Engine generation after the write (unchanged by a dry run). */
  generation: number;
}

type Obj = Record<string, unknown>;

interface Loc {
  type: ElementType;
  file: string;
  interaction?: string;
  parent?: string;
}

interface Ctx {
  file: string;
  parent: string;
  interaction?: string;
  position?: number;
}

const TOP = new Map<ElementType, string>(
  Object.entries(COLLECTIONS).map(([coll, type]) => [type, coll]),
);
const FEATURE_OWNERS: readonly ElementType[] = ["class", "interface", "data_type"];
const FRAGMENTS: readonly ElementType[] = ["occurrence", "combined_fragment", "interaction_use"];
/** Reference keys an element cannot exist without (DEC-016); other single references are unset. */
const MANDATORY = new Set([
  "specific",
  "general",
  "client",
  "supplier",
  "element",
  "covered",
  "interaction",
]);
/** Message events required by its `kind` (spec §6.5); an event not required is unset instead. */
const EVENTS: Record<string, readonly string[]> = {
  complete: ["send_event", "receive_event"],
  lost: ["send_event"],
  found: ["receive_event"],
};
/** Arrays with `minItems: 1` in the schema: emptied by a cascade, their owner is deleted (DEC-016). */
const nonEmpty = (owner: Obj, key: string): boolean =>
  key === "covered" || key === "operands" || (key === "elements" && owner.kind === "sequence");
/** Keys that would reach or replace a prototype if copied from untrusted input (`__proto__`…). */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const refOf = (v: unknown): string => (isObject(v) ? str(v.idref) : "");
const bad = (argument: string, message: string): EngineError =>
  new EngineError("INVALID_ARGUMENT", `${argument}: ${message}`, { argument });

/** Keys from the parent to the array that holds a new element of `type` under a `parent` element. */
function slot(type: ElementType, parent: ElementType): string[] | undefined {
  const coll = TOP.get(type);
  if (coll !== undefined) return parent === "model" ? ["elements", coll] : undefined;
  if (type === "diagram") return parent === "model" ? ["diagrams"] : undefined;
  if (type === "attribute" || type === "operation")
    return FEATURE_OWNERS.includes(parent) ? [`${type}s`] : undefined;
  if (type === "parameter") return parent === "operation" ? ["parameters"] : undefined;
  if (type === "lifeline" || type === "message")
    return parent === "interaction" ? [`${type}s`] : undefined;
  if (FRAGMENTS.includes(type))
    return parent === "interaction" || parent === "operand" ? ["fragments"] : undefined;
  if (type === "operand") return parent === "combined_fragment" ? ["operands"] : undefined;
  return undefined;
}

interface Found {
  holder: Obj | unknown[];
  key: string | number;
  node: Obj;
  pointer: string;
}

/** Element with `id` in a model document (pointers shift within a batch, so it is searched each time). */
function findNode(data: unknown, id: string, ptr = ""): Found | undefined {
  if (Array.isArray(data)) {
    for (const [i, x] of data.entries()) {
      if (isObject(x) && x.id === id)
        return { holder: data, key: i, node: x, pointer: `${ptr}/${String(i)}` };
      const f = findNode(x, id, `${ptr}/${String(i)}`);
      if (f) return f;
    }
  } else if (isObject(data)) {
    for (const [k, v] of Object.entries(data)) {
      if (isObject(v) && v.id === id)
        return { holder: data, key: k, node: v, pointer: `${ptr}/${k}` };
      const f = findNode(v, id, `${ptr}/${k}`);
      if (f) return f;
    }
  }
  return undefined;
}

function idsIn(data: unknown, out: string[] = []): string[] {
  if (Array.isArray(data)) for (const x of data) idsIn(x, out);
  else if (isObject(data)) {
    if (typeof data.id === "string") out.push(data.id);
    for (const v of Object.values(data)) idsIn(v, out);
  }
  return out;
}

interface Hit {
  holder: Obj | unknown[];
  key: string | number;
  idref: string;
  file: string;
  pointer: string;
  source?: string;
}

/** References (`{idref}`) to any of `ids`, with the innermost element that holds each one. */
function refsTo(
  data: unknown,
  ids: ReadonlySet<string>,
  file: string,
  out: Hit[],
  ptr = "",
  source?: string,
): void {
  const visit = (holder: Obj | unknown[], key: string | number, v: unknown, src?: string): void => {
    const p = `${ptr}/${String(key)}`;
    if (isObject(v) && typeof v.idref === "string") {
      if (ids.has(v.idref)) {
        const hit: Hit = { holder, key, idref: v.idref, file, pointer: p };
        if (src !== undefined) hit.source = src;
        out.push(hit);
      }
    } else refsTo(v, ids, file, out, p, src);
  };
  if (Array.isArray(data)) {
    data.forEach((x, i) => {
      visit(data, i, x, source);
    });
  } else if (isObject(data)) {
    const src =
      typeof data.id === "string" ? data.id : isObject(data.diagram) ? refOf(data.diagram) : source;
    for (const [k, v] of Object.entries(data)) visit(data, k, v, src);
  }
}

/** Rejects `__proto__`, `constructor` and `prototype` keys anywhere in untrusted input. */
function checkKeys(v: unknown, argument: string): void {
  if (Array.isArray(v)) for (const x of v) checkKeys(x, argument);
  else if (isObject(v)) {
    for (const [k, x] of Object.entries(v)) {
      if (UNSAFE_KEYS.has(k)) throw bad(argument, `key ${k} is not allowed`);
      checkKeys(x, argument);
    }
  }
}

function merge(target: Obj, patch: Obj): void {
  for (const [k, v] of Object.entries(patch)) {
    const cur = Object.hasOwn(target, k) ? target[k] : undefined;
    if (v === null) Reflect.deleteProperty(target, k);
    else if (isObject(v) && isObject(cur)) merge(cur, v);
    else target[k] = structuredClone(v);
  }
}

interface Planned {
  batch: BatchOperation[];
  initialized: boolean;
  created: string[];
  affected: Affected[];
}

/** Turns edit operations into one engine batch against the engine's current (just reloaded) state. */
function plan(engine: Engine, ops: readonly EditOperation[]): Planned {
  /** Working copies by path; `null` = deleted in this batch. */
  const docs = new Map<string, Obj | null>();
  const made = new Map<string, Loc>();
  const gone = new Set<string>();
  const affected: Affected[] = [];
  const created: string[] = [];

  const data = (path: string): unknown =>
    docs.has(path) ? docs.get(path) : engine.document(path)?.data;
  const write = (path: string): Obj => {
    let d = docs.get(path);
    if (d === undefined) {
      d = structuredClone(engine.document(path)?.data) as Obj;
      docs.set(path, d);
    }
    if (d === null)
      throw new EngineError("NOT_FOUND", `${path} was deleted in this batch`, { path });
    return d;
  };
  const where = (id: string): Loc => {
    const own = made.get(id);
    if (own && !gone.has(id)) return own;
    const list = engine.get(id);
    const first = list[0];
    if (!first || gone.has(id)) throw new EngineError("NOT_FOUND", `${id} does not exist`, { id });
    if (list.length > 1) {
      throw new EngineError("AMBIGUOUS_ID", `${id} exists ${String(list.length)} times`, { id });
    }
    const loc: Loc = { type: first.type, file: first.file };
    if (first.interaction !== undefined) loc.interaction = first.interaction;
    if (first.parent !== undefined) loc.parent = first.parent;
    return loc;
  };
  const nodeOf = (id: string): Found => {
    const doc = write(where(id).file);
    const f = doc.id === id ? { holder: doc, key: "", node: doc, pointer: "" } : findNode(doc, id);
    if (!f) throw new EngineError("NOT_FOUND", `${id} does not exist`, { id });
    return f;
  };
  const exists = (id: string): boolean =>
    engine.get(id).length > 0 ||
    made.has(id) ||
    engine.revision(`models/${id}.json`) !== null ||
    engine.revision(`layout/${id}.json`) !== null;
  const checkRevision = (path: string, expected: string | undefined): void => {
    const actual = engine.revision(path);
    if (expected !== undefined && expected !== actual) {
      throw new EngineError("REVISION_CONFLICT", `${path} is at another revision`, {
        path,
        expected,
        actual,
      });
    }
  };
  /** Occurrences of a loaded `id` once this batch is applied (a duplicate may survive or be resolved). */
  const remaining = (id: string): number => {
    const files = new Set([...engine.get(id).map((x) => x.file), ...docs.keys()]);
    return [...files].reduce((n, f) => n + idsIn(data(f)).filter((x) => x === id).length, 0);
  };
  const nameOfRef = (id: string): string => {
    try {
      return str(findNode(data(where(id).file), id)?.node.name);
    } catch {
      return "";
    }
  };

  function input(type: ElementType, n: Obj, ctx: Ctx): DeriveInput {
    const end = (k: string): string => (isObject(n[k]) ? refOf(n[k].element) : "");
    switch (type) {
      case "attribute":
      case "operation":
        return { type, owner: ctx.parent, name: str(n.name) };
      case "parameter":
        return { type, operation: ctx.parent, name: str(n.name) };
      case "association":
        return { type, name: str(n.name), end1: end("end1"), end2: end("end2") };
      case "association_end":
        return { type, association: ctx.parent, end: ctx.position === 2 ? 2 : 1 };
      case "generalization":
        return { type, specific: refOf(n.specific), general: refOf(n.general) };
      case "realization":
      case "dependency":
        return { type, name: str(n.name), client: refOf(n.client), supplier: refOf(n.supplier) };
      case "lifeline": {
        const rep = refOf(n.represents);
        return {
          type,
          interaction: ctx.interaction ?? "",
          name: str(n.name),
          representsName: rep && nameOfRef(rep),
        };
      }
      case "message":
        return { type, interaction: ctx.interaction ?? "", name: str(n.name) };
      case "occurrence":
        return { type, interaction: ctx.interaction ?? "" };
      case "combined_fragment":
        return { type, interaction: ctx.interaction ?? "", operator: str(n.operator) };
      case "operand":
        return { type, fragment: ctx.parent, position: ctx.position ?? 1 };
      case "interaction_use":
        return { type, interaction: ctx.interaction ?? "", used: refOf(n.interaction) };
      default:
        return { type, name: str(n.name) };
    }
  }

  /** Assigns a derived ID to `n` and to its nested children that have none (spec §3.3). */
  function fill(type: ElementType, n: Obj, ctx: Ctx): string {
    n.id ??= deriveId(input(type, n, ctx), exists);
    const id = str(n.id);
    const loc: Loc = { type, file: ctx.file, parent: ctx.parent };
    if (ctx.interaction !== undefined) loc.interaction = ctx.interaction;
    made.set(id, loc);
    fillChildren(type, n, id, ctx);
    return id;
  }

  function fillChildren(type: ElementType, n: Obj, id: string, ctx: Ctx): void {
    const each = (
      list: unknown,
      child: (x: Obj) => ElementType | undefined,
      sub: Partial<Ctx> = {},
    ): void => {
      if (!Array.isArray(list)) return;
      list.forEach((x, i) => {
        const t = isObject(x) ? child(x) : undefined;
        if (isObject(x) && t) fill(t, x, { ...ctx, parent: id, position: i + 1, ...sub });
      });
    };
    const fragment = (x: Obj): ElementType | undefined => FRAGMENTS.find((t) => t === x.type);
    switch (type) {
      case "model": {
        const elements = isObject(n.elements) ? n.elements : {};
        for (const [coll, t] of Object.entries(COLLECTIONS)) each(elements[coll], () => t);
        each(n.diagrams, () => "diagram");
        break;
      }
      case "class":
      case "interface":
      case "data_type":
        each(n.attributes, () => "attribute");
        each(n.operations, () => "operation");
        break;
      case "operation":
        each(n.parameters, () => "parameter");
        break;
      case "association":
        (["end1", "end2"] as const).forEach((k, i) => {
          const e = n[k];
          if (isObject(e)) fill("association_end", e, { ...ctx, parent: id, position: i + 1 });
        });
        break;
      case "interaction":
        each(n.lifelines, () => "lifeline", { interaction: id });
        each(n.messages, () => "message", { interaction: id });
        each(n.fragments, fragment, { interaction: id });
        break;
      case "combined_fragment":
        each(n.operands, () => "operand");
        break;
      case "operand":
        each(n.fragments, fragment);
        break;
      default:
        break;
    }
  }

  function create(op: Extract<EditOperation, { op: "create" }>): void {
    if (!isObject(op.data)) throw bad("data", "must be an object");
    checkKeys(op.data, "data");
    const n = structuredClone(op.data);
    if (op.type === "model") {
      if (op.parent !== undefined) throw bad("parent", "a model has no parent");
      n.id ??= deriveId({ type: "model", name: str(n.name) }, exists);
      const id = str(n.id);
      const file = `models/${id}.json`;
      if (data(file) != null) throw new EngineError("INVALID_ID", `${file} already exists`, { id });
      checkRevision(file, op.expectedRevision);
      const doc = { format_version: SUPPORTED_VERSION, ...n };
      docs.set(file, doc);
      made.set(id, { type: "model", file });
      fillChildren("model", doc, id, { file, parent: id });
      created.push(id);
      return;
    }
    if (op.parent === undefined) throw bad("parent", `required for a ${op.type}`);
    const p = where(op.parent);
    const keys = slot(op.type, p.type);
    if (!keys) throw bad("parent", `a ${op.type} cannot be created under a ${p.type}`);
    checkRevision(p.file, op.expectedRevision);
    if (FRAGMENTS.includes(op.type)) n.type = op.type;
    let holder = nodeOf(op.parent).node;
    for (const k of keys.slice(0, -1)) holder = isObject(holder[k]) ? holder[k] : (holder[k] = {});
    const last = keys.at(-1) ?? "";
    const list = Array.isArray(holder[last]) ? (holder[last] as unknown[]) : (holder[last] = []);
    const index = op.index ?? list.length;
    if (!Number.isInteger(index) || index < 0 || index > list.length) {
      throw bad("index", `must be an integer between 0 and ${String(list.length)}`);
    }
    const interaction = p.type === "interaction" ? op.parent : p.interaction;
    const ctx: Ctx = { file: p.file, parent: op.parent, position: list.length + 1 };
    if (interaction !== undefined) ctx.interaction = interaction;
    created.push(fill(op.type, n, ctx));
    list.splice(index, 0, n);
  }

  function update(op: Extract<EditOperation, { op: "update" }>): void {
    if (!isObject(op.patch)) throw bad("patch", "must be an object");
    checkKeys(op.patch, "patch");
    if (Object.hasOwn(op.patch, "id")) throw bad("patch", "cannot change id; use rename");
    const loc = where(op.id);
    checkRevision(loc.file, op.expectedRevision);
    const f = nodeOf(op.id);
    merge(f.node, op.patch);
    const ctx: Ctx = { file: loc.file, parent: loc.parent ?? op.id };
    if (loc.interaction !== undefined) ctx.interaction = loc.interaction;
    fillChildren(loc.type, f.node, op.id, ctx);
  }

  /** Removes layout entries of `ids` (all layouts, or only `only`); cleanup only (DEC-015). */
  function cleanLayouts(ids: ReadonlySet<string>, only?: string): void {
    const paths = only !== undefined ? [only] : engine.status().documents.map((d) => d.path);
    for (const path of paths) {
      if (!path.startsWith("layout/")) continue;
      const d = data(path);
      if (!isObject(d)) continue;
      for (const map of ["nodes", "edges"]) {
        const m = d[map];
        if (!isObject(m)) continue;
        for (const key of Object.keys(m).filter((k) => ids.has(k))) {
          const w = write(path)[map] as Obj;
          Reflect.deleteProperty(w, key);
          affected.push({
            action: "removed_ref",
            file: path,
            pointer: `/${map}/${key}`,
            id: refOf(d.diagram),
          });
        }
      }
    }
  }

  /** Removes an element (or a whole model file) and the layouts of the diagrams removed with it. */
  function removeElement(id: string, cascade = false): void {
    const loc = where(id);
    let diagrams: string[] = [];
    if (loc.type === "model") {
      const d = data(loc.file);
      for (const x of idsIn(d)) gone.add(x);
      diagrams =
        isObject(d) && Array.isArray(d.diagrams)
          ? d.diagrams.map((x) => (isObject(x) ? str(x.id) : ""))
          : [];
      docs.set(loc.file, null);
      affected.push({ action: "deleted", file: loc.file, pointer: "", id });
    } else {
      const f = nodeOf(id);
      if (!Array.isArray(f.holder))
        throw bad("id", `${id} is part of ${loc.parent ?? "its owner"}; delete that instead`);
      f.holder.splice(Number(f.key), 1);
      for (const x of idsIn(f.node)) gone.add(x);
      if (loc.type === "diagram") diagrams = [id];
      affected.push({ action: "deleted", file: loc.file, pointer: f.pointer, id });
      // A message's occurrences that no other message uses go with it (no OCCURRENCE_UNUSED left).
      if (cascade && loc.type === "message") {
        for (const occ of [refOf(f.node.send_event), refOf(f.node.receive_event)]) {
          const users: Hit[] = [];
          if (occ !== "" && !gone.has(occ)) refsTo(data(loc.file), new Set([occ]), loc.file, users);
          if (occ !== "" && !gone.has(occ) && users.length === 0) removeElement(occ, cascade);
        }
      }
      // The last operand of a combined fragment: the fragment goes too.
      const owner = loc.parent !== undefined && cascade ? nodeOf(loc.parent).node : undefined;
      if (owner && f.holder.length === 0 && nonEmpty(owner, f.pointer.split("/").at(-2) ?? "")) {
        removeElement(loc.parent ?? "", cascade);
      }
    }
    for (const d of diagrams) {
      const path = `layout/${d}.json`;
      if (data(path) != null) {
        docs.set(path, null);
        affected.push({ action: "deleted", file: path, pointer: "", id: d });
      }
    }
  }

  function remove(op: Extract<EditOperation, { op: "delete" }>): void {
    const loc = where(op.id);
    checkRevision(loc.file, op.expectedRevision);
    removeElement(op.id, op.cascade === true);
    // ponytail: every pass scans every loaded document (O(knowledge) per pass); index references by
    // target if deletes on large knowledge bases get slow.
    for (;;) {
      // A duplicated ID whose other copy survives is not dangling: its references stay (REQ-035). Checked
      // on every pass, since the cascade can delete more copies.
      for (const id of gone) if (engine.get(id).length > 1 && remaining(id) > 0) gone.delete(id);
      const scanned: Hit[] = [];
      const paths = new Set([...engine.status().documents.map((d) => d.path), ...docs.keys()]);
      for (const path of paths) refsTo(data(path), gone, path, scanned);
      if (scanned.length === 0) break;
      if (op.cascade !== true) {
        throw new EngineError("REFERENCED", `${op.id} is still referenced (use cascade)`, {
          id: op.id,
          references: scanned.map(({ idref, file, pointer, source }) =>
            source === undefined ? { idref, file, pointer } : { idref, file, pointer, source },
          ),
        });
      }
      // Re-scan the files with hits on their working copies to mutate them; later sites first so that
      // removing array items does not shift the ones still pending.
      const hits: Hit[] = [];
      for (const path of new Set(scanned.map((h) => h.file))) refsTo(write(path), gone, path, hits);
      const doomed = new Set<string>();
      for (const h of hits.reverse()) {
        const source = h.source ?? "";
        const key = String(h.key);
        if (Array.isArray(h.holder)) {
          h.holder.splice(Number(h.key), 1);
          affected.push({ action: "removed_ref", file: h.file, pointer: h.pointer, id: source });
          // A required non-empty list left empty: its owner cannot exist (e.g. a sequence diagram).
          const owner = h.holder.length === 0 && source !== "" ? nodeOf(source).node : undefined;
          if (owner && nonEmpty(owner, h.pointer.split("/").at(-2) ?? "")) doomed.add(source);
        } else if (MANDATORY.has(key) || (EVENTS[str(h.holder.kind)] ?? []).includes(key)) {
          const loc = where(source);
          doomed.add(loc.type === "association_end" ? (loc.parent ?? source) : source);
        } else {
          Reflect.deleteProperty(h.holder, h.key);
          affected.push({ action: "unset", file: h.file, pointer: h.pointer, id: source });
        }
      }
      for (const id of doomed) if (!gone.has(id)) removeElement(id, true);
    }
    cleanLayouts(gone);
  }

  function editDiagram(op: Extract<EditOperation, { op: "edit_diagram" }>): void {
    const loc = where(op.id);
    if (loc.type !== "diagram") throw bad("id", `${op.id} is a ${loc.type}, not a diagram`);
    checkRevision(loc.file, op.expectedRevision);
    const d = nodeOf(op.id).node;
    const removed = new Set(op.remove ?? []);
    const list = (Array.isArray(d.elements) ? d.elements : []).filter(
      (r) => !removed.has(refOf(r)),
    );
    for (const id of op.add ?? []) if (!list.some((r) => refOf(r) === id)) list.push({ idref: id });
    d.elements = list;
    cleanLayouts(removed, `layout/${op.id}.json`);
  }

  if (ops.length === 0) throw bad("operations", "must not be empty");
  const initialized = engine.revision("ai-submind.json") === null;
  if (initialized) docs.set("ai-submind.json", { ...MANIFEST });
  for (const op of ops) {
    switch (op.op) {
      case "create":
        create(op);
        break;
      case "update":
        update(op);
        break;
      case "delete":
        remove(op);
        break;
      case "edit_diagram":
        editDiagram(op);
        break;
      default:
        throw bad("op", `unknown operation ${String((op as { op: unknown }).op)}`);
    }
  }
  // An unreadable document (e.g. `conflicted` after a merge) may already hold any new ID (REQ-034).
  const blocked = engine.unwritable();
  if (blocked.length > 0) {
    for (const d of docs.values()) {
      if (d !== null && idsIn(d).some((id) => engine.get(id).length === 0)) {
        throw new EngineError(
          "CREATE_BLOCKED",
          `documents not loaded as writable may already hold the new IDs: ${blocked.join(", ")}`,
          { paths: blocked },
        );
      }
    }
  }
  // A reference added to an ID that stays duplicated would resolve to either copy (REQ-035); the
  // references that already existed do not block other edits of their document. A site is the holding
  // element, the field and the target, so moving a reference to another holder counts as a new one.
  const dup = new Set(
    [...engine.ids()].filter((id) => engine.get(id).length > 1 && remaining(id) > 1),
  );
  const sites = (doc: unknown, path: string): Map<string, number> => {
    const hits: Hit[] = [];
    refsTo(doc, dup, path, hits);
    const out = new Map<string, number>();
    for (const h of hits) {
      const field = Array.isArray(h.holder) ? h.pointer.split("/").at(-2) : String(h.key);
      const key = `${h.source ?? ""}\0${field ?? ""}\0${h.idref}`;
      out.set(key, (out.get(key) ?? 0) + 1);
    }
    return out;
  };
  for (const [path, d] of docs) {
    if (dup.size === 0 || d === null) continue;
    const before = sites(engine.document(path)?.data, path);
    for (const [key, n] of sites(d, path)) {
      if (n <= (before.get(key) ?? 0)) continue;
      const id = key.split("\0")[2] ?? "";
      throw new EngineError("AMBIGUOUS_ID", `${id} exists ${String(engine.get(id).length)} times`, {
        id,
      });
    }
  }
  const batch: BatchOperation[] = [];
  for (const [path, d] of docs) {
    const rev = engine.revision(path);
    if (d !== null) batch.push({ op: "put", path, data: d, expectedRevision: rev });
    else if (rev !== null) batch.push({ op: "delete", path, expectedRevision: rev });
  }
  return { batch, initialized, created, affected };
}

/**
 * Applies edit operations atomically (REQ-026): all of them or none. With `dryRun` everything is planned
 * and validated, and the same diff is returned, but nothing is written (REQ-027, DEC-015).
 */
export async function edit(
  engine: Engine,
  ops: readonly EditOperation[],
  options: { dryRun?: boolean } = {},
): Promise<EditResult> {
  let planned: Planned | undefined;
  const r = await engine.transact(() => (planned = plan(engine, ops)).batch, options);
  const { initialized, created, affected } = planned ?? {
    initialized: false,
    created: [],
    affected: [],
  };
  return {
    dryRun: options.dryRun === true,
    initialized,
    created,
    affected,
    ...r,
    generation: engine.generation,
  };
}
