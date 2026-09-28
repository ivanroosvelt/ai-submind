export { Lexer } from "./lexer.js";
export type { Token, TokenKind } from "./tokens.js";
export { parse } from "./parser/index.js";
export type { ParseResult } from "./parser/index.js";
export type { Catalog } from "./workspace/resolver.js";
export { render } from "./render/index.js";
export type { RenderResult, RenderedDiagram } from "./render/index.js";
export type {
  Position,
  Range,
  NodeShape,
  EntityId,
  DocumentUri,
  EntityDecl,
  Ref,
  Edge,
  BlockKind,
  DiagramBlock,
  UseDecl,
  ParsedDocument,
} from "./ast.js";
export { formatDiagnostic } from "./diagnostics.js";
export type { Diagnostic, DiagnosticSeverity } from "./diagnostics.js";
export { escapeXml } from "./render/svg.js";
