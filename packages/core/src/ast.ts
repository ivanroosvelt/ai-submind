export interface Position {
  line: number;
  column: number;
}

/** `end` is exclusive: points to the position following the last character. */
export interface Range {
  start: Position;
  end: Position;
}

export type NodeShape = "rectangle" | "rounded" | "decision";

export interface FlowchartNode {
  id: string;
  shape: NodeShape;
  label: string;
  range: Range; // toda la declaración: `start[Inicio]`
  nameRange: Range; // solo `start`
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label: string | null;
  range: Range; // toda la arista
  fromRange: Range; // solo el id origen
  toRange: Range; // solo el id destino
}

export interface FlowchartDiagram {
  kind: "flowchart";
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

export interface SequenceParticipant {
  id: string;
  label: string;
  range: Range;
  nameRange: Range;
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  range: Range;
  fromRange: Range;
  toRange: Range;
}

export interface SequenceDiagram {
  kind: "sequence";
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
}

export type Diagram = FlowchartDiagram | SequenceDiagram;

export function isFlowchartDiagram(diagram: Diagram): diagram is FlowchartDiagram {
  return diagram.kind === "flowchart";
}

export function isSequenceDiagram(diagram: Diagram): diagram is SequenceDiagram {
  return diagram.kind === "sequence";
}

export type EntityId = string;
export type DocumentUri = string;

export interface EntityDecl {
  id: EntityId;
  label: string;
  shape: NodeShape;
  type: string | null;
  tags: string[];
  uri: DocumentUri;
  range: Range; // la declaración completa, desde `entity`
  nameRange: Range; // solo el identificador
}

/** Referencia a una entidad desde una arista. `target` lo rellena el resolver. */
export interface Ref {
  name: string;
  range: Range;
  target: EntityId | null; // null tras resolver ⇒ E030
}

export interface Edge {
  from: Ref;
  to: Ref;
  label: string | null; // en `sequence` el parser garantiza que no es null
  range: Range;
}

export type BlockKind = "flow" | "sequence";

export interface DiagramBlock {
  kind: BlockKind;
  name: string;
  title: string | null;
  edges: Edge[];
  range: Range; // desde la palabra clave hasta el `}`
  nameRange: Range;
}

export interface ParsedDocument {
  uri: DocumentUri;
  entities: EntityDecl[];
  blocks: DiagramBlock[];
}
