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

/** Identidad de un bloque en el workspace: `uri#nombre` (decisión #25). */
export type BlockId = string;

export const MEMORY_TYPES = ["working", "short_term", "long_term"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];
export type CustomTagValue = string | number | boolean;

/** Una entrada de `relations` en el frontmatter de un `.md`. */
export interface Relation {
  type: string;
  target: string; // tal como se escribió
  resolved: { kind: "entity"; id: EntityId } | { kind: "block"; id: BlockId } | null; // lo rellena el resolver
  range: Range; // el valor de `target`
  typeRange: Range; // el valor de `type`
}

/** Lo que un `.md` agrega a su entidad (spec de conocimiento §4). */
export interface KnowledgeMeta {
  memoryType: MemoryType | null; // null solo si el frontmatter lo diagnosticó
  typeTags: string[];
  typeTagRanges: Range[]; // paralelo a typeTags, para E065
  contextTags: string[]; // "clave:valor"
  customTags: Record<string, CustomTagValue>;
  relations: Relation[];
  body: string; // Markdown sin frontmatter
}

export interface EntityDecl {
  id: EntityId;
  label: string;
  shape: NodeShape;
  type: string | null;
  tags: string[];
  uri: DocumentUri;
  range: Range; // la declaración completa, desde `entity`
  nameRange: Range; // solo el identificador
  knowledge: KnowledgeMeta | null; // null en entidades declaradas en .flo
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

/** `use "ruta"`: trae al catálogo alcanzable las entidades de otro documento. */
export interface UseDecl {
  path: string; // tal como se escribió, sin comillas
  range: Range; // desde `use` hasta la comilla de cierre
  pathRange: Range; // el string, comillas incluidas
}

export interface ParsedDocument {
  uri: DocumentUri;
  uses: UseDecl[];
  entities: EntityDecl[];
  blocks: DiagramBlock[];
}
