// Structural and lexical queries over knowledge/ (FEAT-004): facade, graph, filters and search.
export { QueryError, type QueryErrorCode, type QueryErrorDetails } from "./errors.js";
export { compareEdges, EDGE_KINDS, Graph, HUB_TYPES, type Edge, type EdgeKind } from "./graph.js";
export {
  compileFilter,
  nameOf,
  NAME_MATCHES,
  summarize,
  type ElementSummary,
  type FindFilter,
  type NameMatch,
} from "./filters.js";
export { LIMITS, pageOf, type Limit, type PageArgs, type QueryPage } from "./limits.js";
export {
  metaOf,
  type ElementLocation,
  type ExcludedDocument,
  type QueryMeta,
  type QueryResult,
} from "./meta.js";
export {
  impact,
  PATH_BUDGET,
  paths,
  type GraphPath,
  type ImpactArgs,
  type ImpactDirection,
  type ImpactItem,
  type ImpactResult,
  type PathArgs,
  type PathResult,
} from "./traverse.js";
export {
  LexicalIndex,
  type Field,
  type LexicalDiff,
  type LexicalHit,
  type LexicalOptions,
} from "./lexical.js";
export { fold, tokenize } from "./text.js";
export {
  createQuery,
  Query,
  RELATION_GROUPS,
  type DiagramInfo,
  type ElementDetail,
  type ModelInfo,
  type Relation,
  type RelationGroup,
  type RelationsArgs,
  type SearchArgs,
  type SearchHit,
} from "./query.js";
