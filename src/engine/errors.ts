// Operation errors of the engine (FEAT-002). Codes are part of the contract consumed by MCP, CLI and UI.
import type { Finding } from "../format/findings.js";

export type EngineErrorCode =
  /** The ID or document does not exist. */
  | "NOT_FOUND"
  /** The ID exists more than once (spec §10.4). */
  | "AMBIGUOUS_ID"
  /** The ID does not satisfy the grammar of its class (spec §3.1). */
  | "INVALID_ID"
  /** Path that is not a knowledge/ document (spec §2). */
  | "INVALID_PATH"
  /** Path outside knowledge/ or through a symbolic link (REQ-008, NFR-006). */
  | "PATH_OUTSIDE_KNOWLEDGE"
  /** Malformed batch (e.g. the same path twice). */
  | "INVALID_BATCH"
  /** The document is not writable: not loaded or read-only (REQ-022). */
  | "DOCUMENT_INVALID"
  /** Expected revision differs from the current one, or the file changed on disk (NFR-005). */
  | "REVISION_CONFLICT"
  /** The result would not be valid (REQ-011); `findings` lists the errors. */
  | "VALIDATION_FAILED"
  /** spec §3.2 */
  | "RENAME_COLLISION"
  /** spec §3.2 */
  | "RENAME_BLOCKED"
  /** A write adds IDs while some document is not loaded as writable and may already hold them (REQ-034). */
  | "CREATE_BLOCKED"
  /** Deleting the element would leave references to it; `references` lists them (REQ-024). */
  | "REFERENCED"
  /** A write would add a key of a later version to a 1.0 document, or change its version (spec §11). */
  | "MIGRATION_REQUIRED"
  /** `migrate` cannot run while a 1.0 document is not loaded (phase 1 or 3 error; spec §11.1). */
  | "MIGRATE_BLOCKED"
  /** Malformed edit operation, e.g. a parent of the wrong type or `id` in an update patch. */
  | "INVALID_ARGUMENT";

export interface EngineErrorDetails {
  path?: string;
  id?: string;
  expected?: string | null;
  actual?: string | null;
  status?: string;
  findings?: Finding[];
  ids?: string[];
  paths?: string[];
  /** References that block a delete without cascade. */
  references?: { idref: string; file: string; pointer: string; source?: string }[];
  /** Name of the rejected argument. */
  argument?: string;
}

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
    readonly details: EngineErrorDetails = {},
  ) {
    super(`${code}: ${message}`);
    this.name = "EngineError";
  }
}
