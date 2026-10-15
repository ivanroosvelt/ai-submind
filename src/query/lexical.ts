// Lexical index (PLAN-002 S6): BM25F over name, ID, tags, stereotypes and documentation of every
// element, model and diagram, with prefix expansion and incremental update from a semantic diff.
import { compareCodeUnits } from "../format/canonical.js";
import type { IndexedElement } from "../format/semantic.js";
import { tokenize } from "./text.js";

export type Field = "name" | "id" | "tags" | "stereotypes" | "documentation";

export interface LexicalHit {
  id: string;
  score: number;
  /** Fields where the matched terms occur, in the order of `FIELDS`. */
  fields: Field[];
  /** Index terms that contributed to the score (exact or prefix expansions), sorted. */
  terms: string[];
}

export interface LexicalOptions {
  /** `any` (default): at least one query term matches; `all`: every query term matches. */
  mode?: "any" | "all";
  /** Query terms of 3+ characters also match index terms that start with them. Default: true. */
  prefix?: boolean;
}

export interface LexicalDiff {
  added: readonly string[];
  removed: readonly string[];
  changed: readonly string[];
}

const FIELDS: readonly Field[] = ["name", "id", "tags", "stereotypes", "documentation"];
const WEIGHTS: readonly number[] = [3, 2, 2, 2, 1];
const K1 = 1.2;
const B = 0.75;
const PREFIX_MIN = 3;
const PREFIX_WEIGHT = 0.5;

interface Doc {
  /** Number of terms per field, in the order of `FIELDS`. */
  lengths: number[];
  /** Frequency per field of each term. */
  tf: Map<string, number[]>;
}

interface Best {
  score: number;
  term: string;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Document of an ID: the fields of all its occurrences (a duplicated ID is indexed once). */
function documentOf(id: string, list: readonly IndexedElement[]): Doc {
  const terms: string[][] = [[], tokenize(id), [], [], []];
  const [name, , tags, stereotypes, documentation] = terms as [
    string[],
    string[],
    string[],
    string[],
    string[],
  ];
  for (const { node } of list) {
    if (typeof node !== "object" || node === null) continue;
    const n = node as Record<string, unknown>;
    const label = typeof n.name === "string" ? n.name : n.role;
    if (typeof label === "string") name.push(...tokenize(label));
    for (const t of strings(n.tags)) tags.push(...tokenize(t));
    for (const s of strings(n.stereotypes)) stereotypes.push(...tokenize(s));
    if (typeof n.documentation === "string") documentation.push(...tokenize(n.documentation));
  }
  const tf = new Map<string, number[]>();
  terms.forEach((list, f) => {
    for (const t of list) {
      let counts = tf.get(t);
      if (!counts) tf.set(t, (counts = [0, 0, 0, 0, 0]));
      counts[f] = (counts[f] ?? 0) + 1;
    }
  });
  return { lengths: terms.map((l) => l.length), tf };
}

/** First index of `sorted` whose value is not below `key`. */
function lowerBound(sorted: readonly string[], key: string): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareCodeUnits(sorted[mid] ?? "", key) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export class LexicalIndex {
  private readonly docs = new Map<string, Doc>();
  private readonly postings = new Map<string, Set<string>>();
  /** Total number of terms per field over all documents (integers: no drift across updates). */
  private readonly totals = [0, 0, 0, 0, 0];
  /** Index terms in code-unit order, for prefix expansion; rebuilt on demand after changes. */
  private sorted: string[] | undefined;

  get size(): number {
    return this.docs.size;
  }

  rebuild(elements: Iterable<[string, readonly IndexedElement[]]>): void {
    this.docs.clear();
    this.postings.clear();
    this.totals.fill(0);
    this.sorted = undefined;
    for (const [id, list] of elements) this.add(id, list);
  }

  /** Applies a semantic diff; `lookup` returns the current occurrences of an ID (none = absent). */
  update(diff: LexicalDiff, lookup: (id: string) => readonly IndexedElement[]): void {
    for (const id of [...diff.removed, ...diff.changed, ...diff.added]) this.remove(id);
    for (const id of [...diff.changed, ...diff.added]) {
      const list = lookup(id);
      if (list.length > 0) this.add(id, list);
    }
  }

  /** Hits ranked by score (descending), then by ID. A text without terms gives no hits. */
  search(text: string, options: LexicalOptions = {}): LexicalHit[] {
    const query = [...new Set(tokenize(text))];
    const n = this.docs.size;
    if (query.length === 0 || n === 0) return [];
    const prefix = options.prefix ?? true;
    const avg = this.totals.map((t) => t / n);
    // Per document, the best contribution of each query term (in query order).
    const best = new Map<string, (Best | undefined)[]>();
    query.forEach((q, qi) => {
      for (const [term, weight] of this.candidates(q, prefix)) {
        const ids = this.postings.get(term);
        if (!ids) continue;
        const idf = Math.log(1 + (n - ids.size + 0.5) / (ids.size + 0.5));
        for (const id of ids) {
          const doc = this.docs.get(id);
          const counts = doc?.tf.get(term);
          if (!doc || !counts) continue;
          let pseudo = 0;
          for (let f = 0; f < FIELDS.length; f++) {
            const c = counts[f] ?? 0;
            if (c === 0) continue;
            const norm = 1 - B + (B * (doc.lengths[f] ?? 0)) / (avg[f] ?? 1);
            pseudo += ((WEIGHTS[f] ?? 0) * c) / norm;
          }
          const score = (weight * idf * pseudo) / (K1 + pseudo);
          let slots = best.get(id);
          if (!slots) best.set(id, (slots = new Array<Best | undefined>(query.length)));
          const prev = slots[qi];
          // An exact match always wins over expansions; among expansions the highest score wins and,
          // on a tie, the first in code-unit order.
          if (!prev || (prev.term !== q && (term === q || score > prev.score)))
            slots[qi] = { score, term };
        }
      }
    });
    const all = options.mode === "all";
    const hits: LexicalHit[] = [];
    for (const [id, slots] of best) {
      const matched = slots.filter((s): s is Best => s !== undefined);
      if (all && matched.length < query.length) continue;
      const doc = this.docs.get(id);
      const terms = [...new Set(matched.map((s) => s.term))].sort(compareCodeUnits);
      const fields = FIELDS.filter((_, f) => terms.some((t) => (doc?.tf.get(t)?.[f] ?? 0) > 0));
      const score = slots.reduce((sum, s) => sum + (s?.score ?? 0), 0);
      hits.push({ id, score: Math.round(score * 1e6) / 1e6, fields, terms });
    }
    return hits.sort((a, b) => b.score - a.score || compareCodeUnits(a.id, b.id));
  }

  /** Index terms matched by a query term, with their weight: the term itself, then its expansions. */
  private candidates(q: string, prefix: boolean): [string, number][] {
    const out: [string, number][] = [[q, 1]];
    if (!prefix || q.length < PREFIX_MIN) return out;
    this.sorted ??= [...this.postings.keys()].sort(compareCodeUnits);
    for (let i = lowerBound(this.sorted, q); i < this.sorted.length; i++) {
      const t = this.sorted[i] ?? "";
      if (!t.startsWith(q)) break;
      if (t !== q) out.push([t, PREFIX_WEIGHT]);
    }
    return out;
  }

  private add(id: string, list: readonly IndexedElement[]): void {
    const doc = documentOf(id, list);
    this.docs.set(id, doc);
    doc.lengths.forEach((l, f) => (this.totals[f] = (this.totals[f] ?? 0) + l));
    for (const term of doc.tf.keys()) {
      const ids = this.postings.get(term);
      if (ids) ids.add(id);
      else {
        this.postings.set(term, new Set([id]));
        this.sorted = undefined;
      }
    }
  }

  private remove(id: string): void {
    const doc = this.docs.get(id);
    if (!doc) return;
    this.docs.delete(id);
    doc.lengths.forEach((l, f) => (this.totals[f] = (this.totals[f] ?? 0) - l));
    for (const term of doc.tf.keys()) {
      const ids = this.postings.get(term);
      ids?.delete(id);
      if (ids?.size === 0) {
        this.postings.delete(term);
        this.sorted = undefined;
      }
    }
  }
}
