export interface Position {
  line: number;
  column: number;
}

export type NodeShape = "rectangle" | "rounded" | "decision";

export interface FlowchartNode {
  id: string;
  shape: NodeShape;
  label: string;
  position: Position;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label: string | null;
  position: Position;
}

export interface FlowchartDiagram {
  kind: "flowchart";
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

export interface SequenceParticipant {
  id: string;
  label: string;
  position: Position;
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  position: Position;
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
