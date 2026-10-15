// Errors of the query API (FEAT-004). Codes are part of the contract consumed by MCP, CLI and UI.
import type { ElementLocation } from "./meta.js";

export type QueryErrorCode =
  /** The ID does not exist in the loaded documents. */
  | "NOT_FOUND"
  /** The ID exists more than once (spec §10.4); `locations` lists every occurrence. */
  | "AMBIGUOUS_ID"
  /** Argument out of range, of an unknown value or empty (DEC-012: rejected, never clamped). */
  | "INVALID_ARGUMENT";

export interface QueryErrorDetails {
  id?: string;
  /** Occurrences of an ambiguous ID, sorted by file and pointer. */
  locations?: ElementLocation[];
  /** Name of the rejected argument. */
  argument?: string;
}

export class QueryError extends Error {
  constructor(
    readonly code: QueryErrorCode,
    message: string,
    readonly details: QueryErrorDetails = {},
  ) {
    super(`${code}: ${message}`);
    this.name = "QueryError";
  }
}

/** `INVALID_ARGUMENT` for argument `name`. */
export const invalid = (name: string, message: string): QueryError =>
  new QueryError("INVALID_ARGUMENT", `${name}: ${message}`, { argument: name });
