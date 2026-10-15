// Element filters shared by `find` and `search`, and the summary returned for each element.
import { compareCodeUnits } from "../format/canonical.js";
import { ELEMENT_TYPES, type ElementType, type IndexedElement } from "../format/semantic.js";
import type { Visibility } from "../format/types.js";
import { QueryError, invalid } from "./errors.js";
import { compareLocations, type Graph } from "./graph.js";
import { boolArg, listOf, oneOf } from "./limits.js";
import { fold } from "./text.js";

export type NameMatch = "exact" | "contains" | "prefix";
export const NAME_MATCHES: readonly NameMatch[] = ["exact", "contains", "prefix"];
const VISIBILITIES: readonly Visibility[] = ["public", "private", "protected", "package"];

/** Conditions combined with AND; every one is optional. */
export interface FindFilter {
  type?: ElementType | readonly ElementType[];
  /** Elements of this model (the model itself excluded). */
  model?: string;
  /** Direct members of this package. */
  package?: string;
  /** Elements shown by this diagram and everything they own. */
  diagram?: string;
  /** Elements whose structural container is this ID. */
  owner?: string;
  /** Elements of this interaction. */
  interaction?: string;
  /** Compared with `fold()` (case and accent insensitive) according to `match`. */
  name?: string;
  /** Default: `contains`. */
  match?: NameMatch;
  /** All of them, exactly. */
  tags?: readonly string[];
  /** All of them, exactly. */
  stereotypes?: readonly string[];
  hasCodeRef?: boolean;
  /** Some `code_refs` path under this path (whole segments). */
  codeRefPath?: string;
  hasDocumentation?: boolean;
  visibility?: Visibility;
}

export interface ElementSummary {
  id: string;
  type: ElementType;
  /** `name`, or the `role` of an association end; absent when empty. */
  name?: string;
  /** Model that contains the element (the model itself for a model). */
  model: string;
  file: string;
  /** JSON Pointer in the file as read. */
  pointer: string;
  parent?: string;
  /** The ID occurs more than once (`ID_DUPLICATE`). */
  ambiguous?: true;
}

const field = (el: IndexedElement, key: string): unknown =>
  typeof el.node === "object" && el.node !== null
    ? (el.node as Record<string, unknown>)[key]
    : undefined;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Display name of an element: `name`, else `role`; empty strings count as absent. */
export function nameOf(el: IndexedElement): string | undefined {
  for (const key of ["name", "role"]) {
    const v = field(el, key);
    if (typeof v === "string" && v !== "") return v;
  }
  return undefined;
}

export function summarize(g: Graph, el: IndexedElement): ElementSummary {
  const s: ElementSummary = {
    id: el.id,
    type: el.type,
    model: g.modelOfFile.get(el.file) ?? "",
    file: el.file,
    pointer: g.original(el.file, el.pointer),
  };
  const name = nameOf(el);
  if (name !== undefined) s.name = name;
  if (el.parent !== undefined) s.parent = el.parent;
  if ((g.byId.get(el.id)?.length ?? 0) > 1) s.ambiguous = true;
  return s;
}

export const compareElements = (a: IndexedElement, b: IndexedElement): number =>
  compareCodeUnits(a.id, b.id) || compareLocations(a, b);

/** Sole occurrence of `id`: `NOT_FOUND` if absent, `AMBIGUOUS_ID` if duplicated. */
export function resolveId(g: Graph, id: unknown, argument = "id"): IndexedElement {
  if (typeof id !== "string" || id === "") throw invalid(argument, "must be a non-empty ID");
  const list = g.byId.get(id) ?? [];
  const first = list[0];
  if (!first) throw new QueryError("NOT_FOUND", `${id} does not exist`, { id, argument });
  if (list.length > 1) {
    throw new QueryError("AMBIGUOUS_ID", `${id} exists ${String(list.length)} times`, {
      id,
      argument,
      locations: [...list].sort(compareLocations).map((x) => ({
        file: x.file,
        pointer: g.original(x.file, x.pointer),
        type: x.type,
      })),
    });
  }
  return first;
}

/** Like `resolveId`, and the element must be of one of `types` (`INVALID_ARGUMENT` otherwise). */
function resolveTyped(
  g: Graph,
  id: unknown,
  argument: string,
  types: readonly ElementType[],
): IndexedElement {
  const el = resolveId(g, id, argument);
  if (!types.includes(el.type)) throw invalid(argument, `${el.id} is a ${el.type}`);
  return el;
}

/** Splits a path into segments, ignoring empty ones (`src/fleet/` = `src/fleet`). */
const segments = (p: string): string[] => p.split("/").filter((s) => s !== "");

/** Compiles `f` into a predicate; validates every argument first. */
export function compileFilter(g: Graph, f: FindFilter): (el: IndexedElement) => boolean {
  const checks: ((el: IndexedElement) => boolean)[] = [];
  if (f.type !== undefined) {
    const types = listOf("type", typeof f.type === "string" ? [f.type] : f.type, ELEMENT_TYPES);
    if (types) checks.push((el) => types.has(el.type));
  }
  if (f.model !== undefined) {
    const m = resolveTyped(g, f.model, "model", ["model"]);
    checks.push((el) => el.file === m.file && el.type !== "model");
  }
  if (f.package !== undefined) {
    const p = resolveTyped(g, f.package, "package", ["package"]);
    const members = new Set(
      g
        .outgoing(p.id)
        .filter((e) => e.kind === "member")
        .map((e) => e.to),
    );
    checks.push((el) => members.has(el.id));
  }
  if (f.diagram !== undefined) {
    const d = resolveTyped(g, f.diagram, "diagram", ["diagram"]);
    const shown = new Set<string>();
    const queue = g
      .outgoing(d.id)
      .filter((e) => e.kind === "shows")
      .map((e) => e.to);
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      if (shown.has(id)) continue;
      shown.add(id);
      queue.push(...g.children(id));
    }
    checks.push((el) => shown.has(el.id));
  }
  if (f.owner !== undefined) {
    const o = resolveId(g, f.owner, "owner");
    checks.push((el) => el.parent === o.id);
  }
  if (f.interaction !== undefined) {
    const x = resolveTyped(g, f.interaction, "interaction", ["interaction"]);
    checks.push((el) => el.interaction === x.id);
  }
  const match = oneOf("match", f.match, NAME_MATCHES, "contains");
  if (f.name !== undefined) {
    if (typeof f.name !== "string" || f.name.trim() === "") {
      throw invalid("name", "must be a non-empty string");
    }
    const want = fold(f.name);
    checks.push((el) => {
      const name = nameOf(el);
      if (name === undefined) return false;
      const have = fold(name);
      return match === "exact"
        ? have === want
        : match === "prefix"
          ? have.startsWith(want)
          : have.includes(want);
    });
  }
  for (const key of ["tags", "stereotypes"] as const) {
    const want = listOf(key, f[key]);
    if (want) {
      checks.push((el) => {
        const have = new Set(strings(field(el, key)));
        return [...want].every((t) => have.has(t));
      });
    }
  }
  const hasCodeRef = boolArg("hasCodeRef", f.hasCodeRef);
  if (hasCodeRef !== undefined) {
    checks.push((el) => {
      const refs = field(el, "code_refs");
      return (Array.isArray(refs) && refs.length > 0) === hasCodeRef;
    });
  }
  if (f.codeRefPath !== undefined) {
    if (typeof f.codeRefPath !== "string" || segments(f.codeRefPath).length === 0) {
      throw invalid("codeRefPath", "must be a non-empty path");
    }
    const prefix = segments(f.codeRefPath);
    checks.push((el) => {
      const refs = field(el, "code_refs");
      return (
        Array.isArray(refs) &&
        refs.some((r: unknown) => {
          const path = (r as { path?: unknown } | null)?.path;
          if (typeof path !== "string") return false;
          const segs = segments(path);
          return prefix.every((s, i) => segs[i] === s);
        })
      );
    });
  }
  const hasDocumentation = boolArg("hasDocumentation", f.hasDocumentation);
  if (hasDocumentation !== undefined) {
    checks.push((el) => {
      const d = field(el, "documentation");
      return (typeof d === "string" && d.trim() !== "") === hasDocumentation;
    });
  }
  if (f.visibility !== undefined) {
    const v = oneOf("visibility", f.visibility, VISIBILITIES, "public");
    checks.push((el) => field(el, "visibility") === v);
  }
  return (el) => checks.every((c) => c(el));
}
