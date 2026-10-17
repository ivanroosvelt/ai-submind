// Validation codes of the format (spec §10.4). Severity and phase are part of the contract.

export const VALIDATION_CODES = {
  PATH_OUTSIDE_KNOWLEDGE: "error",
  FILE_ENCODING: "error",
  MERGE_CONFLICT: "error",
  JSON_PARSE: "error",
  FORMAT_VERSION_UNSUPPORTED: "error",
  FORMAT_VERSION_OUTDATED: "warning",
  SCHEMA_VIOLATION: "error",
  UNKNOWN_FILE: "warning",
  FILE_ID_MISMATCH: "error",
  ID_DUPLICATE: "error",
  REF_UNRESOLVED: "error",
  REF_TYPE_MISMATCH: "error",
  DIAGRAM_ELEMENT_NOT_ALLOWED: "error",
  PACKAGE_MEMBERSHIP: "error",
  GENERALIZATION_CYCLE: "error",
  MESSAGE_EVENTS: "error",
  OCCURRENCE_REUSED: "error",
  OCCURRENCE_UNUSED: "warning",
  EXECUTION_COVERAGE: "error",
  EXECUTION_ORDER: "error",
  MULTIPLICITY_INVALID: "error",
  LINK_SELF: "error",
  CODE_REF_INVALID: "error",
  CODE_REF_MISSING: "warning",
  LAYOUT_ORPHAN: "warning",
} as const satisfies Record<string, Severity>;

export type Severity = "error" | "warning";
export type ValidationCode = keyof typeof VALIDATION_CODES;

export interface Finding {
  code: ValidationCode;
  severity: Severity;
  /** Path relative to knowledge/, with `/` as separator. */
  file: string;
  /** JSON Pointer (RFC 6901) into the document as read; "" = whole document. */
  pointer: string;
  message: string;
  /**
   * IDs the finding is about (phase 4), so that a report can be compared across a rename without parsing
   * `message`. Empty when the finding is not about IDs.
   */
  subjects?: string[];
}

export function finding(
  code: ValidationCode,
  file: string,
  pointer: string,
  message: string,
  subjects?: string[],
): Finding {
  const f: Finding = { code, severity: VALIDATION_CODES[code], file, pointer, message };
  if (subjects !== undefined) f.subjects = subjects;
  return f;
}

/** Escapes a JSON Pointer segment (RFC 6901 §4). */
export function pointerSegment(segment: string | number): string {
  return String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
}

export function pointer(...segments: (string | number)[]): string {
  return segments.map((s) => `/${pointerSegment(s)}`).join("");
}

export function hasErrors(findings: readonly Finding[]): boolean {
  return findings.some((f) => f.severity === "error");
}
