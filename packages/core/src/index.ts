export { Lexer } from "./lexer.js";
export type { Token, TokenKind } from "./tokens.js";
export { parse } from "./parser/index.js";
export type { ParseResult } from "./parser/index.js";
export type { Catalog } from "./workspace/resolver.js";
export { Workspace } from "./workspace/workspace.js";
export type { LinkResult, LinkedDocument } from "./workspace/workspace.js";
export { blockId } from "./workspace/xref.js";
export type { XRefIndex, BlockId, Location } from "./workspace/xref.js";
export { layoutFlowchart } from "./layout/flowchart.js";
export type { FlowchartLayout, FlowchartNodeLayout, FlowchartEdgeLayout, LayoutPoint } from "./layout/flowchart.js";
export { layoutSequence } from "./layout/sequence.js";
export type { SequenceLayout, SequenceParticipantLayout, SequenceMessageLayout } from "./layout/sequence.js";
export type { BlockNode } from "./layout/nodes.js";
export { render, renderBlock } from "./render/index.js";
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
