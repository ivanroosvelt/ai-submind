// Types of the knowledge/ documents (format 1.0). The canonical structure is the JSON Schema in
// spec/format/schema/1.0/; these types mirror it for code and only describe documents that already passed
// schema validation. `null` values accepted by the reader are typed as optional.

export interface Ref {
  idref: string;
}

export type Visibility = "public" | "private" | "protected" | "package";

export interface CodeRef {
  path: string;
  symbol?: string;
}

/** Extensions allowed on every element with an `id`, the model and diagrams (spec §7.1). */
export interface Extensions {
  stereotypes?: string[];
  tags?: string[];
  documentation?: string | null;
  code_refs?: CodeRef[];
  external_id?: string | null;
}

export interface Identified extends Extensions {
  id: string;
}

export interface Manifest {
  format_version: string;
  name?: string | null;
  documentation?: string | null;
}

export interface Attribute extends Identified {
  name: string;
  visibility: Visibility;
  type?: Ref | null;
  multiplicity?: string | null;
  default_value?: string | null;
  is_static?: boolean | null;
  is_ordered?: boolean | null;
  is_unique?: boolean | null;
  is_read_only?: boolean | null;
  is_derived?: boolean | null;
  is_derived_union?: boolean | null;
}

export interface Parameter extends Identified {
  name: string;
  direction?: "in" | "out" | "inout";
  type?: Ref | null;
  multiplicity?: string | null;
  default_value?: string | null;
}

export interface Operation extends Identified {
  name: string;
  visibility: Visibility;
  return_type?: Ref | null;
  is_static?: boolean | null;
  is_abstract?: boolean | null;
  is_query?: boolean | null;
  parameters?: Parameter[];
  exceptions?: Ref[];
}

export interface Package extends Identified {
  name: string;
  visibility: Visibility;
  members?: Ref[];
}

export interface Actor extends Identified {
  name: string;
  visibility?: Visibility;
}

export interface StructuredClassifier extends Identified {
  name: string;
  visibility: Visibility;
  attributes?: Attribute[];
  operations?: Operation[];
}

export interface Class extends StructuredClassifier {
  is_abstract?: boolean | null;
}

export type Interface = StructuredClassifier;
export type DataType = StructuredClassifier;

export interface Enumeration extends Identified {
  name: string;
  visibility: Visibility;
  literals?: string[];
}

export interface PrimitiveType extends Identified {
  name: string;
  visibility: Visibility;
  kind?: string | null;
}

export interface AssociationEnd extends Identified {
  element: Ref;
  role?: string | null;
  multiplicity?: string | null;
  navigability?: boolean | null;
  visibility?: Visibility;
}

export interface Association extends Identified {
  name?: string | null;
  visibility?: Visibility;
  type: "association" | "aggregation" | "composition";
  direction: "directed" | "undirected";
  end1: AssociationEnd;
  end2: AssociationEnd;
}

export interface Generalization extends Identified {
  specific: Ref;
  general: Ref;
}

export interface Dependency extends Identified {
  name?: string | null;
  client: Ref;
  supplier: Ref;
}

export interface Realization extends Identified {
  client: Ref;
  supplier: Ref;
}

export interface Lifeline extends Identified {
  name: string;
  represents?: Ref | null;
}

export type MessageSort =
  "synch_call" | "asynch_call" | "asynch_signal" | "create_message" | "delete_message" | "reply";

export type MessageKind = "complete" | "lost" | "found" | "unknown";

export interface Message extends Identified {
  name: string;
  sort: MessageSort;
  kind: MessageKind;
  arguments?: string[] | null;
  send_event?: Ref | null;
  receive_event?: Ref | null;
  signature?: Ref | null;
}

export interface Occurrence extends Identified {
  type: "occurrence";
  covered: Ref;
}

export type InteractionOperator =
  | "alt"
  | "opt"
  | "par"
  | "loop"
  | "critical"
  | "neg"
  | "assert"
  | "strict"
  | "seq"
  | "ignore"
  | "consider"
  | "break";

export interface Operand extends Identified {
  guard?: string | null;
  fragments?: Fragment[];
}

export interface CombinedFragment extends Identified {
  type: "combined_fragment";
  name?: string | null;
  operator: InteractionOperator;
  covered: Ref[];
  operands: Operand[];
}

export interface InteractionUse extends Identified {
  type: "interaction_use";
  name?: string | null;
  covered: Ref[];
  interaction: Ref;
  arguments?: string[] | null;
}

export type Fragment = Occurrence | CombinedFragment | InteractionUse;

/** Execution specification (activation) of a lifeline between two of its occurrences (DEC-018). */
export interface Execution extends Identified {
  covered: Ref;
  start: Ref;
  finish: Ref;
}

export interface Interaction extends Identified {
  name: string;
  visibility: Visibility;
  lifelines?: Lifeline[];
  messages?: Message[];
  fragments?: Fragment[];
  executions?: Execution[];
}

export interface Elements {
  packages?: Package[];
  actors?: Actor[];
  classes?: Class[];
  interfaces?: Interface[];
  data_types?: DataType[];
  enumerations?: Enumeration[];
  primitive_types?: PrimitiveType[];
  associations?: Association[];
  generalizations?: Generalization[];
  dependencies?: Dependency[];
  realizations?: Realization[];
  interactions?: Interaction[];
}

export type DiagramKind = "class" | "sequence";

export interface Diagram extends Identified {
  kind: DiagramKind;
  name: string;
  elements?: Ref[];
}

export interface Model extends Extensions {
  format_version: string;
  id: string;
  name: string;
  visibility?: Visibility;
  elements?: Elements;
  diagrams?: Diagram[];
}

export interface Style {
  fill?: string;
  stroke?: string;
  text?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutNode {
  x: number;
  y: number;
  width?: number;
  height?: number;
  style?: Style;
}

export interface LayoutEdge {
  vertices?: Point[];
  style?: Style;
}

export interface Layout {
  format_version: string;
  diagram: Ref;
  nodes?: Record<string, LayoutNode>;
  edges?: Record<string, LayoutEdge>;
}

/** Document kind according to its path inside knowledge/ (spec §2). */
export type DocumentKind = "manifest" | "model" | "layout";
