// Embedded knowledge engine (FEAT-002): loading, indexes, transactions, rename and reload.
export { edit, MANIFEST, type Affected, type EditOperation, type EditResult } from "./edit.js";
export { isEmptyDiff, semanticDiff, type SemanticDiff } from "./diff.js";
export {
  Engine,
  revisionOf,
  type ChangeEvent,
  type DocumentInfo,
  type EngineOptions,
  type EngineStatus,
  type BatchOperation,
  type RenameResult,
  type TransactionResult,
  type TransactOptions,
} from "./engine.js";
export { EngineError, type EngineErrorCode, type EngineErrorDetails } from "./errors.js";
export {
  deriveId,
  idParts,
  isValidId,
  seg,
  slug,
  uniqueId,
  type DeriveInput,
  type IdParts,
} from "./ids.js";
