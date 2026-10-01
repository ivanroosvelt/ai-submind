import type { BlockId, CustomTagValue, DocumentUri, EntityDecl, EntityId, MemoryType } from "../ast.js";
import { floSources } from "../parser/markdown.js";
import { blockId } from "./uri.js";
import { push } from "./xref.js";
import type { LinkResult } from "./workspace.js";

/** Filtro de semillas (spec de conocimiento §5). Los predicados hoja solo los cumplen entidades de `.md`. */
export type Where =
  | { and: Where[] }
  | { or: Where[] }
  | { not: Where }
  | { memory: MemoryType }
  | { typeTag: string }
  | { contextTag: string } // exacto "clave:valor", o "clave:" = cualquier valor
  | { custom: string; equals?: CustomTagValue }
  | { text: string }; // substring sin distinguir mayúsculas en title + body

export type Projection = "meta" | "full" | "full+diagrams";

export interface QueryOptions {
  where?: Where; // omitido = todas
  from?: EntityId[]; // semillas explícitas; se intersecan con where
  depth?: number; // 0 por defecto
  project?: Projection; // "meta" por defecto
}

export interface QueryNode {
  id: EntityId;
  title: string; // el label de la entidad
  uri: DocumentUri;
  distance: number; // 0 = semilla
  memoryType: MemoryType | null; // null en entidades .flo
  typeTags: string[];
  contextTags: string[];
  customTags: Record<string, CustomTagValue>;
  body?: string; // full: Markdown sin frontmatter; "" en entidades .flo
  diagrams?: string[]; // full+diagrams: fuente de cada cerca ```flo
}

export interface QueryEdge {
  from: EntityId;
  to: EntityId;
  type: string; // tipo de la relación, o "flow"
  blocks?: BlockId[]; // solo en "flow": los bloques que contienen la arista
}

export interface QueryResult {
  nodes: QueryNode[]; // por distancia, luego orden del catálogo
  edges: QueryEdge[]; // todas las aristas entre nodos del resultado
}

export interface TagCatalog {
  typeTags: string[];
  contextTags: string[];
  relationTypes: string[]; // tipos de relación en uso, en orden de aparición
  customTags: Record<string, CustomTagValue[]>; // valores distintos por clave
}

function matches(entity: EntityDecl, where: Where): boolean {
  if ("and" in where) return where.and.every((w) => matches(entity, w));
  if ("or" in where) return where.or.some((w) => matches(entity, w));
  if ("not" in where) return !matches(entity, where.not);
  const knowledge = entity.knowledge;
  if (!knowledge) return false;
  if ("memory" in where) return knowledge.memoryType === where.memory;
  if ("typeTag" in where) return knowledge.typeTags.includes(where.typeTag);
  if ("contextTag" in where) {
    const tag = where.contextTag;
    return tag.endsWith(":")
      ? knowledge.contextTags.some((t) => t.startsWith(tag))
      : knowledge.contextTags.includes(tag);
  }
  if ("custom" in where) {
    // hasOwn: una clave como "constructor" no debe matchear por herencia.
    if (!Object.hasOwn(knowledge.customTags, where.custom)) return false;
    return where.equals === undefined || knowledge.customTags[where.custom] === where.equals;
  }
  const text = where.text.toLowerCase();
  return entity.label.toLowerCase().includes(text) || knowledge.body.toLowerCase().includes(text);
}

/**
 * Todas las aristas del workspace (decisión #32), por documento en orden de
 * uri: primero las relaciones resueltas a entidad de la declaración
 * ganadora, luego las aristas de flujo en orden de fuente, fundidas por par
 * `from→to` en la primera aparición.
 */
function workspaceEdges(link: LinkResult): QueryEdge[] {
  const edges: QueryEdge[] = [];
  const flows = new Map<string, QueryEdge & { blocks: BlockId[] }>();
  for (const { document } of link.documents.values()) {
    for (const entity of document.entities) {
      if (!entity.knowledge || link.entities.get(entity.id) !== entity) continue;
      for (const relation of entity.knowledge.relations) {
        if (relation.resolved?.kind === "entity") {
          edges.push({ from: entity.id, to: relation.resolved.id, type: relation.type });
        }
      }
    }
    for (const block of document.blocks) {
      const id = blockId(document.uri, block.name);
      for (const { from, to } of block.edges) {
        if (from.target === null || to.target === null) continue;
        const key = `${from.target} ${to.target}`;
        const known = flows.get(key);
        if (known) {
          if (!known.blocks.includes(id)) known.blocks.push(id);
          continue;
        }
        const edge = { from: from.target, to: to.target, type: "flow", blocks: [id] };
        flows.set(key, edge);
        edges.push(edge);
      }
    }
  }
  return edges;
}

function toNode(entity: EntityDecl, distance: number, project: Projection): QueryNode {
  const knowledge = entity.knowledge;
  const node: QueryNode = {
    id: entity.id,
    title: entity.label,
    uri: entity.uri,
    distance,
    memoryType: knowledge?.memoryType ?? null,
    typeTags: [...(knowledge?.typeTags ?? [])],
    contextTags: [...(knowledge?.contextTags ?? [])],
    customTags: { ...knowledge?.customTags },
  };
  if (project !== "meta") node.body = knowledge?.body ?? "";
  if (project === "full+diagrams") node.diagrams = knowledge ? floSources(knowledge.body) : [];
  return node;
}

/**
 * Consulta pura sobre un workspace enlazado (spec de conocimiento §5,
 * decisiones #31 y #32): semillas = entidades del catálogo que cumplen
 * `where` y están en `from`; expansión BFS no dirigida hasta `depth`.
 */
export function query(link: LinkResult, opts: QueryOptions = {}): QueryResult {
  const { where, from, depth = 0, project = "meta" } = opts;
  const allowed = from ? new Set(from) : null;
  const distance = new Map<EntityId, number>();
  for (const entity of link.entities.values()) {
    if (allowed && !allowed.has(entity.id)) continue;
    if (where && !matches(entity, where)) continue;
    distance.set(entity.id, 0);
  }

  const edges = workspaceEdges(link);
  const adjacent = new Map<EntityId, EntityId[]>();
  for (const { from: a, to: b } of edges) {
    push(adjacent, a, b);
    push(adjacent, b, a);
  }
  let frontier = [...distance.keys()];
  for (let d = 1; d <= depth && frontier.length > 0; d++) {
    const next: EntityId[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacent.get(id) ?? []) {
        if (distance.has(neighbor)) continue;
        distance.set(neighbor, d);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  const order = new Map([...link.entities.keys()].map((id, index) => [id, index]));
  const ids = [...distance.keys()].sort((a, b) => distance.get(a)! - distance.get(b)! || order.get(a)! - order.get(b)!);
  return {
    nodes: ids.map((id) => toNode(link.entities.get(id)!, distance.get(id)!, project)),
    edges: edges.filter((edge) => distance.has(edge.from) && distance.has(edge.to)),
  };
}

/** Vocabulario en uso por las declaraciones ganadoras, en orden del catálogo y sin repetir. */
export function tagCatalog(link: LinkResult): TagCatalog {
  const typeTags = new Set<string>();
  const contextTags = new Set<string>();
  const relationTypes = new Set<string>();
  // Map y no objeto: una clave "constructor" no debe leer Object.prototype.
  const customTags = new Map<string, CustomTagValue[]>();
  for (const { knowledge } of link.entities.values()) {
    if (!knowledge) continue;
    for (const tag of knowledge.typeTags) typeTags.add(tag);
    for (const tag of knowledge.contextTags) contextTags.add(tag);
    for (const relation of knowledge.relations) relationTypes.add(relation.type);
    for (const [key, value] of Object.entries(knowledge.customTags)) {
      const values = customTags.get(key) ?? [];
      if (!values.includes(value)) values.push(value);
      customTags.set(key, values);
    }
  }
  return { typeTags: [...typeTags], contextTags: [...contextTags], relationTypes: [...relationTypes], customTags: Object.fromEntries(customTags) };
}
