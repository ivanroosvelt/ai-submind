// Embedded knowledge engine (FEAT-002): loading, indexes, transactions, rename and reload.
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
