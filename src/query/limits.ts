// Pagination and argument limits of the queries (DEC-012): out-of-range values are rejected.
import { invalid } from "./errors.js";

export interface Limit {
  default: number;
  max: number;
}

/** Default and maximum of every bounded argument. */
export const LIMITS = {
  list: { default: 100, max: 1000 },
  find: { default: 50, max: 500 },
  relations: { default: 200, max: 1000 },
  search: { default: 20, max: 200 },
  impact: { default: 500, max: 5000 },
  pathLength: { default: 6, max: 12 },
  maxPaths: { default: 10, max: 100 },
} as const satisfies Record<string, Limit>;

/** Size of a search text: characters and distinct tokens (bounds the cost of a query). */
export const SEARCH_TEXT = { maxLength: 1000, maxTerms: 32 } as const;

/**
 * Checks that `args` is absent or a plain object whose keys are all in `allowed`; a typo in a key fails
 * instead of being ignored (DEC-012).
 */
export function checkArgs(args: unknown, allowed: ReadonlySet<string>): void {
  if (args === undefined) return;
  const proto: unknown =
    typeof args === "object" && args !== null ? Object.getPrototypeOf(args) : 1;
  if (proto !== Object.prototype && proto !== null) {
    throw invalid("args", "must be a plain object");
  }
  for (const key of Object.keys(args as object)) {
    if (!allowed.has(key)) throw invalid(key, "unknown argument");
  }
}

export interface PageArgs {
  /** Items to skip. Default: 0. */
  offset?: number;
  /** Items per page; default and maximum depend on the query (`LIMITS`). */
  limit?: number;
}

export interface QueryPage<T> {
  items: T[];
  /** Items before pagination. */
  total: number;
  offset: number;
  limit: number;
  /** Offset of the next page, or `null` on the last one. */
  nextOffset: number | null;
}

/** Integer argument in [min, max] (absent = `fallback`); anything else is `INVALID_ARGUMENT`. */
export function intArg(
  name: string,
  value: unknown,
  fallback: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw invalid(name, `must be an integer between ${String(min)} and ${String(max)}`);
  }
  return value;
}

/** Argument that must be one of `allowed` (absent = `fallback`). */
export function oneOf<T extends string>(
  name: string,
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw invalid(name, `must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

/** Optional list argument whose items must all be in `allowed`; absent = `undefined`. */
export function listOf<T extends string>(
  name: string,
  value: unknown,
  allowed?: readonly T[],
): Set<T> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) throw invalid(name, "must be a non-empty list");
  for (const v of value) {
    if (typeof v !== "string" || (allowed && !(allowed as readonly string[]).includes(v))) {
      throw invalid(
        name,
        allowed ? `items must be one of ${allowed.join(", ")}` : "items must be strings",
      );
    }
  }
  return new Set(value as T[]);
}

/** Optional boolean argument. */
export function boolArg(name: string, value: unknown): boolean | undefined {
  if (value === undefined || typeof value === "boolean") return value;
  throw invalid(name, "must be a boolean");
}

/** Page of `items` according to `args`, validated against `limit`. */
export function pageOf<T>(items: readonly T[], args: PageArgs, limit: Limit): QueryPage<T> {
  const offset = intArg("offset", args.offset, 0, 0);
  const size = intArg("limit", args.limit, limit.default, 1, limit.max);
  const end = offset + size;
  return {
    items: items.slice(offset, end),
    total: items.length,
    offset,
    limit: size,
    nextOffset: end < items.length ? end : null,
  };
}
