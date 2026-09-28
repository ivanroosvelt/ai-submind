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
