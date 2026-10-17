// Embedded knowledge engine (FEAT-002, DEC-004, DEC-011): loads knowledge/ into memory with its indexes,
// applies validated batch transactions with optimistic control by revision, renames IDs with reference
// rewriting and reloads on external changes.
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { watch, type FSWatcher } from "node:fs";
import { realpath } from "node:fs/promises";
import { serialize } from "../format/canonical.js";
import { classifyPath, isLoaded, parseDocument, type ParsedDocument } from "../format/document.js";
import { finding, type Finding } from "../format/findings.js";
import { compareFindings, LOCAL_DIR, readKnowledgeDir } from "../format/knowledge.js";
import { isObject, SUPPORTED_VERSION } from "../format/schema.js";
import {
  checkKnowledge,
  indexDocuments,
  type IndexedElement,
  type RefSite,
  type SemanticOptions,
} from "../format/semantic.js";
import { semanticDiff, isEmptyDiff, type SemanticDiff } from "./diff.js";
import { EngineError } from "./errors.js";
import { isValidId } from "./ids.js";
import { movedPath, renamer, rewriteIds } from "./rename.js";
import {
  cleanTemporary,
  deleteDocument,
  documentPath,
  readDocument,
  writeDocument,
} from "./store.js";

/** Revision of a document: SHA-256 of its bytes on disk (hex). */
export const revisionOf = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export interface EngineOptions extends SemanticOptions {
  /** Watch knowledge/ and reload on external changes (REQ-007). Default: false. */
  watch?: boolean;
  /** Quiet period before reloading after the last file event, in ms. Default: 100. */
  debounceMs?: number;
  /** Longest wait since the first event of a burst before reloading anyway, in ms. Default: 2000. */
  maxWaitMs?: number;
}

/**
 * Batch operation. `expectedRevision`: string = must match the current revision; `null` = the document
 * must not exist; absent = no check by the caller (the disk is still compared with memory).
 */
export type BatchOperation =
  | { op: "put"; path: string; data: unknown; expectedRevision?: string | null }
  | { op: "delete"; path: string; expectedRevision?: string };

export interface DocumentInfo {
  path: string;
  kind: ParsedDocument["kind"];
  status: ParsedDocument["status"];
  revision: string;
}

export interface EngineStatus {
  /** `degraded` when some finding is an error: invalid documents are excluded, the rest works (REQ-022). */
  state: "ok" | "degraded";
  documents: DocumentInfo[];
  findings: Finding[];
  /**
   * Last error of the watcher or of an automatic reload. Also emitted as `error` when there is a
   * listener; without one it is only reported here, never thrown.
   */
  watchError?: string;
  /** Why the local directory `.ai-submind/` is unusable; while set, every write fails. */
  localError?: string;
}

export interface ChangeEvent {
  source: "engine" | "external";
  diff: SemanticDiff;
}

export interface TransactOptions {
  /** Validate and compute revisions and diff, but write nothing, change no state and emit no event (REQ-027). */
  dryRun?: boolean;
}

export interface TransactionResult {
  /** New revision of each path touched (`null` = deleted). */
  revisions: Record<string, string | null>;
  diff: SemanticDiff;
}

export interface MigrateResult extends TransactionResult {
  /** Paths of the documents migrated (or that a dry run would migrate), sorted. */
  migrated: string[];
}

/** Only version `migrate` upgrades from (spec §11.1). */
const MIGRATES_FROM = "1.0";

/** `format_version` declared by a document, even one that did not load; `undefined` if unreadable. */
function declaredVersion(e: Entry): string | undefined {
  let data = e.doc.data;
  if (data === undefined) {
    try {
      data = JSON.parse(new TextDecoder().decode(e.bytes));
    } catch {
      return undefined;
    }
  }
  return isObject(data) && typeof data.format_version === "string"
    ? data.format_version
    : undefined;
}

export interface RenameResult extends TransactionResult {
  /** Pairs [old, new] of every ID renamed (the target and the IDs that start with `old.`). */
  renamed: [string, string][];
}

interface Entry {
  doc: ParsedDocument;
  bytes: Uint8Array;
  revision: string;
}

interface State {
  entries: Map<string, Entry>;
  /** Findings of the directory walk and of files that are not documents (`UNKNOWN_FILE`, links). */
  walkFindings: Finding[];
  findings: Finding[];
  byId: Map<string, IndexedElement[]>;
  refsTo: Map<string, RefSite[]>;
}

const enc = new TextEncoder();

/** Identity of an error to compare reports across a transaction: by its subject IDs when it has them. */
const errorKey = (f: Finding): string =>
  `${f.code}\u0000${f.file}\u0000${f.subjects?.length ? [...f.subjects].sort().join("\u0000") : f.message}`;

function countErrors(
  findings: readonly Finding[],
  translate?: (f: Finding) => Finding,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of findings) {
    if (f.severity !== "error") continue;
    const k = errorKey(translate ? translate(f) : f);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

export class Engine extends EventEmitter<{ change: [ChangeEvent]; error: [Error] }> {
  private state: State;
  private tail: Promise<unknown> = Promise.resolve();
  private watcher: FSWatcher | undefined;
  private timer: NodeJS.Timeout | undefined;
  private burstStart: number | undefined;
  private watchError: string | undefined;
  private localError: string | undefined;
  private gen = 0;

  private constructor(
    /** Real path of knowledge/. */
    readonly root: string,
    private readonly options: EngineOptions,
  ) {
    super();
    this.state = this.build(new Map(), []);
  }

  /** Loads knowledge/ (REQ-006). Invalid documents are reported and excluded, never fatal. */
  static async open(knowledgeDir: string, options: EngineOptions = {}): Promise<Engine> {
    const engine = new Engine(await realpath(knowledgeDir), options);
    // A broken local directory only disables writes (they fail with PATH_OUTSIDE_KNOWLEDGE).
    await cleanTemporary(engine.root).catch((e: unknown) => {
      engine.localError = e instanceof Error ? e.message : String(e);
    });
    await engine.reload();
    if (options.watch === true) engine.startWatching();
    return engine;
  }

  /** Stops watching. Pending operations still finish. */
  close(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.watcher?.close();
    this.watcher = undefined;
  }

  /** Counter of state changes: incremented by every reload that changes something and every commit. */
  get generation(): number {
    return this.gen;
  }

  status(): EngineStatus {
    const documents = [...this.state.entries.entries()].map(([path, e]) => ({
      path,
      kind: e.doc.kind,
      status: e.doc.status,
      revision: e.revision,
    }));
    const findings = this.state.findings;
    const status: EngineStatus = {
      state: findings.some((f) => f.severity === "error") ? "degraded" : "ok",
      documents,
      findings,
    };
    if (this.watchError !== undefined) status.watchError = this.watchError;
    if (this.localError !== undefined) status.localError = this.localError;
    return status;
  }

  /** Parsed document at `path`, if it exists. */
  document(path: string): ParsedDocument | undefined {
    return this.state.entries.get(path)?.doc;
  }

  /** Current revision of `path`, or `null` if it does not exist. */
  revision(path: string): string | null {
    return this.state.entries.get(path)?.revision ?? null;
  }

  /**
   * Document paths not loaded as writable (`conflicted`, `invalid_parse`, read-only…) plus paths that were
   * not even read (links outside knowledge/, unreadable entries): they may hold any ID or reference.
   */
  unwritable(): string[] {
    return [
      ...[...this.state.entries].filter(([, e]) => e.doc.status !== "writable").map(([p]) => p),
      ...this.state.walkFindings
        .filter((f) => classifyPath(f.file) !== undefined)
        .map((f) => f.file),
    ];
  }

  /** Occurrences of `id` in the loaded documents (more than one = `ID_DUPLICATE`). */
  get(id: string): readonly IndexedElement[] {
    return this.state.byId.get(id) ?? [];
  }

  /** IDs of the loaded documents. */
  ids(): IterableIterator<string> {
    return this.state.byId.keys();
  }

  /** Reference sites that point to `id` (inverse references). */
  referencesTo(id: string): readonly RefSite[] {
    return this.state.refsTo.get(id) ?? [];
  }

  /**
   * Applies a batch atomically per file: everything is validated before the first write (REQ-026). A
   * builder function is called inside the transaction after pending external changes are loaded, so it
   * can derive the batch from the current state without racing other writers.
   */
  transact(
    ops: readonly BatchOperation[] | (() => readonly BatchOperation[]),
    options: TransactOptions = {},
  ): Promise<TransactionResult> {
    return this.exclusive(async () => {
      if (typeof ops !== "function") return this.commit(ops, undefined, options.dryRun);
      await this.load();
      return this.commit(ops(), undefined, options.dryRun);
    });
  }

  /** Renames an ID and rewrites all its references in one transaction (REQ-039, spec §3.2). */
  rename(oldId: string, newId: string, options: TransactOptions = {}): Promise<RenameResult> {
    return this.exclusive(async () => {
      // Rename works on what is on disk now: other parties' changes are loaded first, never overwritten.
      await this.load();
      const found = this.get(oldId);
      const target = found[0];
      if (!target) throw new EngineError("NOT_FOUND", `${oldId} does not exist`, { id: oldId });
      if (found.length > 1) {
        throw new EngineError("AMBIGUOUS_ID", `${oldId} exists ${String(found.length)} times`, {
          id: oldId,
        });
      }
      const fileId = target.type === "model" || target.type === "diagram";
      if (newId === oldId || !isValidId(newId, fileId)) {
        throw new EngineError(
          "INVALID_ID",
          `${newId} is not a valid new ${fileId ? "file" : "element"} ID for ${oldId}`,
          { id: newId },
        );
      }
      const blocked = this.unwritable();
      if (blocked.length > 0) {
        throw new EngineError(
          "RENAME_BLOCKED",
          `documents not loaded as writable may hold references: ${blocked.join(", ")}`,
          { paths: blocked },
        );
      }
      const map = renamer(oldId, newId);
      const renamed: [string, string][] = [];
      const collisions: string[] = [];
      const invalid: string[] = [];
      for (const [id, list] of this.state.byId) {
        const to = map(id);
        if (to === id) continue;
        renamed.push([id, to]);
        if (this.state.byId.has(to)) collisions.push(to);
        const file = list[0]?.type === "model" || list[0]?.type === "diagram";
        if (!isValidId(to, file)) invalid.push(to);
      }
      if (collisions.length > 0) {
        throw new EngineError("RENAME_COLLISION", `IDs already exist: ${collisions.join(", ")}`, {
          ids: collisions,
        });
      }
      if (invalid.length > 0) {
        throw new EngineError("INVALID_ID", `resulting IDs are not valid: ${invalid.join(", ")}`, {
          ids: invalid,
        });
      }
      const ops: BatchOperation[] = [];
      const moves: BatchOperation[] = [];
      const moved = new Map<string, string>();
      for (const [path, e] of this.state.entries) {
        const data = rewriteIds(e.doc.data, map);
        const to = movedPath(path, e.doc, map);
        if (to !== path) {
          moved.set(path, to);
          ops.push({ op: "put", path: to, data, expectedRevision: null });
          moves.push({ op: "delete", path, expectedRevision: e.revision });
        } else if (JSON.stringify(data) !== JSON.stringify(e.doc.data)) {
          ops.push({ op: "put", path, data, expectedRevision: e.revision });
        }
      }
      // Errors that already existed are compared after moving their file and renaming their subjects.
      const translate = (f: Finding): Finding => {
        const t: Finding = { ...f, file: moved.get(f.file) ?? f.file };
        if (f.subjects) t.subjects = f.subjects.map(map);
        return t;
      };
      const result = await this.commit([...ops, ...moves], translate, options.dryRun);
      return { ...result, renamed: renamed.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) };
    });
  }

  /**
   * Explicit migration 1.0 → 1.1 (REQ-043, spec §11.1): rewrites `format_version` of every 1.0 document in
   * one transaction, in canonical form, and nothing else. Other versions are left untouched.
   */
  migrate(options: TransactOptions = {}): Promise<MigrateResult> {
    return this.exclusive(async () => {
      await this.load();
      const ops: BatchOperation[] = [];
      const blocked: string[] = [];
      for (const [path, e] of [...this.state.entries].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const version = declaredVersion(e);
        if (version !== undefined && version !== MIGRATES_FROM) continue;
        // A document that did not load may be 1.0 even when its version cannot be read.
        if (!isLoaded(e.doc)) blocked.push(path);
        else {
          const data = { ...(e.doc.data as object), format_version: SUPPORTED_VERSION };
          ops.push({ op: "put", path, data, expectedRevision: e.revision });
        }
      }
      if (blocked.length > 0) {
        throw new EngineError(
          "MIGRATE_BLOCKED",
          `fix or restore these documents before migrating: ${blocked.join(", ")}`,
          { paths: blocked },
        );
      }
      const result = await this.commit(ops, undefined, options.dryRun, true);
      return { ...result, migrated: ops.map((o) => o.path) };
    });
  }

  /**
   * Re-reads knowledge/ and revalidates what changed on disk (REQ-007). Emits `change` only if something
   * changed, so the engine's own writes do not produce an event.
   */
  reload(): Promise<SemanticDiff | undefined> {
    return this.exclusive(() => this.load());
  }

  private async load(): Promise<SemanticDiff | undefined> {
    const read = await readKnowledgeDir(this.root);
    const entries = new Map<string, Entry>();
    const walkFindings = [...read.findings];
    const touched: string[] = [];
    for (const f of read.files) {
      const kind = classifyPath(f.path);
      if (kind === undefined) {
        walkFindings.push(finding("UNKNOWN_FILE", f.path, "", "unexpected file in knowledge/"));
        continue;
      }
      const revision = revisionOf(f.bytes);
      const prev = this.state.entries.get(f.path);
      if (prev?.revision === revision) {
        entries.set(f.path, prev);
        continue;
      }
      entries.set(f.path, {
        doc: parseDocument(f.path, kind, f.bytes),
        bytes: f.bytes,
        revision,
      });
      touched.push(f.path);
    }
    for (const path of this.state.entries.keys()) if (!entries.has(path)) touched.push(path);
    const sameWalk = JSON.stringify(walkFindings) === JSON.stringify(this.state.walkFindings);
    if (touched.length === 0 && sameWalk) return undefined;
    const before = this.state;
    this.state = this.build(entries, walkFindings);
    this.gen++;
    const diff = semanticDiff(before.byId, this.state.byId, touched);
    if (!isEmptyDiff(diff) || !sameWalk) this.emit("change", { source: "external", diff });
    return diff;
  }

  private build(entries: Map<string, Entry>, walkFindings: Finding[]): State {
    const docs = [...entries.values()].map((e) => e.doc);
    const loaded = docs.filter(isLoaded);
    const { byId, refs } = indexDocuments(loaded);
    const refsTo = new Map<string, RefSite[]>();
    for (const r of refs) {
      const list = refsTo.get(r.idref);
      if (list) list.push(r);
      else refsTo.set(r.idref, [r]);
    }
    const findings = [
      ...walkFindings,
      ...docs.flatMap((d) => d.findings),
      ...checkKnowledge(loaded, this.options),
    ].sort(compareFindings);
    return { entries, walkFindings, findings, byId, refsTo };
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async commit(
    ops: readonly BatchOperation[],
    translate?: (f: Finding) => Finding,
    dryRun = false,
    migrating = false,
  ): Promise<TransactionResult> {
    if (ops.length === 0) return { revisions: {}, diff: semanticDiff(new Map(), new Map(), []) };
    // Validation runs against what is on disk now (REQ-011): pending external changes are loaded first,
    // and a batch over a document that changed that way is a conflict, never an overwrite.
    const reloaded = await this.load();
    const stale = ops.map((o) => o.path).filter((p) => reloaded?.documents.includes(p));
    if (stale.length > 0) {
      throw new EngineError("REVISION_CONFLICT", `changed on disk: ${stale.join(", ")}`, {
        paths: stale,
      });
    }
    const current = this.state;
    const entries = new Map(current.entries);
    const writes: { path: string; bytes: Uint8Array | null }[] = [];
    const seen = new Set<string>();

    for (const o of ops) {
      documentPath(this.root, o.path);
      const kind = classifyPath(o.path);
      if (kind === undefined) {
        throw new EngineError("INVALID_PATH", `${o.path} is not a knowledge/ document path`, {
          path: o.path,
        });
      }
      if (seen.has(o.path)) {
        throw new EngineError("INVALID_BATCH", `${o.path} appears twice in the batch`, {
          path: o.path,
        });
      }
      seen.add(o.path);

      const existing = current.entries.get(o.path);
      if (existing && existing.doc.status !== "writable") {
        throw new EngineError("DOCUMENT_INVALID", `${o.path} is ${existing.doc.status}`, {
          path: o.path,
          status: existing.doc.status,
          findings: existing.doc.findings,
        });
      }
      const actual = existing?.revision ?? null;
      if (o.expectedRevision !== undefined && o.expectedRevision !== actual) {
        throw new EngineError("REVISION_CONFLICT", `${o.path} is at another revision`, {
          path: o.path,
          expected: o.expectedRevision,
          actual,
        });
      }
      const disk = await readDocument(this.root, o.path);
      const onDisk = disk === null ? null : revisionOf(disk);
      if (onDisk !== actual) {
        throw new EngineError(
          "REVISION_CONFLICT",
          `${o.path} changed on disk and was not reloaded yet`,
          {
            path: o.path,
            expected: actual,
            actual: onDisk,
          },
        );
      }

      if (o.op === "delete") {
        if (!existing)
          throw new EngineError("NOT_FOUND", `${o.path} does not exist`, { path: o.path });
        entries.delete(o.path);
        writes.push({ path: o.path, bytes: null });
        continue;
      }
      // Schema first, on the data as given: serialization drops unknown keys (S5 entry criterion).
      let json: string;
      try {
        json = JSON.stringify(o.data);
      } catch (e) {
        throw new EngineError("VALIDATION_FAILED", `${o.path}: data is not JSON (${String(e)})`, {
          path: o.path,
        });
      }
      const given = parseDocument(o.path, kind, enc.encode(json));
      const version = isObject(o.data) ? o.data.format_version : undefined;
      const from = existing && declaredVersion(existing);
      // A version changes only through migrate, and 1.1 keys need it first (spec §11).
      const later =
        given.status === "invalid_schema" &&
        version === MIGRATES_FROM &&
        parseDocument(
          o.path,
          kind,
          enc.encode(JSON.stringify({ ...(o.data as object), format_version: SUPPORTED_VERSION })),
        ).status === "writable";
      if (later) {
        throw new EngineError(
          "MIGRATION_REQUIRED",
          `${o.path} is format ${MIGRATES_FROM}: run migrate to upgrade it to ${SUPPORTED_VERSION} before using later keys`,
          { path: o.path },
        );
      }
      if (given.status === "writable" && from !== undefined && version !== from && !migrating) {
        throw new EngineError(
          "MIGRATION_REQUIRED",
          `${o.path} is format ${from}: format_version changes only through migrate`,
          { path: o.path },
        );
      }
      if (given.status !== "writable") {
        throw new EngineError("VALIDATION_FAILED", `${o.path} does not conform to the format`, {
          path: o.path,
          findings: given.findings,
        });
      }
      const bytes = enc.encode(serialize(kind, given.data));
      entries.set(o.path, {
        doc: parseDocument(o.path, kind, bytes),
        bytes,
        revision: revisionOf(bytes),
      });
      writes.push({ path: o.path, bytes });
    }

    const next = this.build(entries, current.walkFindings);
    const before = countErrors(current.findings, translate);
    const introduced = new Map<string, number>();
    const fresh = next.findings.filter((f) => {
      if (f.severity !== "error") return false;
      const k = errorKey(f);
      const n = (introduced.get(k) ?? 0) + 1;
      introduced.set(k, n);
      return n > (before.get(k) ?? 0);
    });
    if (fresh.length > 0) {
      throw new EngineError("VALIDATION_FAILED", "the batch would introduce validation errors", {
        findings: fresh,
      });
    }

    const paths = writes.map((w) => w.path);
    const revisions: Record<string, string | null> = {};
    for (const w of writes) revisions[w.path] = next.entries.get(w.path)?.revision ?? null;
    if (dryRun) return { revisions, diff: semanticDiff(current.byId, next.byId, paths) };

    // Creations and replacements before deletions: an interrupted move leaves a duplicate, not a loss.
    try {
      for (const w of writes) if (w.bytes) await writeDocument(this.root, w.path, w.bytes);
      for (const w of writes) if (!w.bytes) await deleteDocument(this.root, w.path);
    } catch (e) {
      // Partial write (I/O error): resynchronize with the disk before reporting.
      this.state = current;
      await this.load().catch(() => undefined);
      throw e;
    }

    this.state = next;
    this.gen++;
    const diff = semanticDiff(current.byId, next.byId, paths);
    this.emit("change", { source: "engine", diff });
    return { revisions, diff };
  }

  private startWatching(): void {
    this.watcher = watch(this.root, { recursive: true }, (_event, filename) => {
      const name = filename?.toString().replaceAll("\\", "/");
      if (name === LOCAL_DIR || name?.startsWith(`${LOCAL_DIR}/`) === true) return;
      clearTimeout(this.timer);
      const now = Date.now();
      this.burstStart ??= now;
      const left = this.burstStart + (this.options.maxWaitMs ?? 2000) - now;
      this.timer = setTimeout(
        () => {
          this.timer = undefined;
          this.burstStart = undefined;
          this.reload().then(
            () => {
              this.watchError = undefined;
            },
            (e: unknown) => {
              this.fail(e);
            },
          );
        },
        Math.max(0, Math.min(this.options.debounceMs ?? 100, left)),
      );
    });
    this.watcher.on("error", (e) => {
      this.fail(e);
    });
  }

  /** Records an automatic-reload error; emitted only if someone listens (an unheard `error` would throw). */
  private fail(e: unknown): void {
    const err = e instanceof Error ? e : new Error(String(e));
    this.watchError = err.message;
    if (this.listenerCount("error") > 0) this.emit("error", err);
  }
}
