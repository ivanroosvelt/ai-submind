// Core of knowledge format 1.0 (FEAT-003, API-004): canonical serialization and validation.
export { canonicalize, compareCodeUnits, serialize } from "./canonical.js";
export {
  classifyPath,
  isLoaded,
  originalPointer,
  parseDocument,
  type DocumentStatus,
  type ParsedDocument,
} from "./document.js";
export {
  finding,
  hasErrors,
  VALIDATION_CODES,
  type Finding,
  type Severity,
  type ValidationCode,
} from "./findings.js";
export {
  compareFindings,
  LOCAL_DIR,
  readKnowledgeDir,
  resolveKnowledgePath,
  validateFiles,
  validateKnowledgeDir,
  type KnowledgeFile,
  type KnowledgeReport,
} from "./knowledge.js";
export { SUPPORTED_VERSION } from "./schema.js";
export {
  checkKnowledge,
  COLLECTIONS,
  ELEMENT_TYPES,
  indexDocuments,
  type ElementType,
  type IndexedElement,
  type KnowledgeIndex,
  type RefRule,
  type RefSite,
  type SemanticOptions,
} from "./semantic.js";
export type * from "./types.js";
