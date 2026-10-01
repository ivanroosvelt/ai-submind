import {
  MEMORY_FILL,
  MEMORY_TYPES,
  escapeXml,
  type EntityId,
  type LinkResult,
  type MemoryType,
  type TagCatalog,
  type Where,
} from "@flo/core";
import type { ViewBox } from "./pan-zoom.js";

/** Lo que muestra la vista de grafo (decisión #45); un preset es esto con nombre (#46). */
export interface GraphQuery {
  where: Where;
  from: EntityId[] | null;
  depth: number;
  viewBox: ViewBox | null;
}

/** Lo que la barra sabe armar. */
export interface GraphFilter {
  memory: MemoryType | null;
  typeTag: string | null;
  contextTag: string | null;
  text: string;
}

const DEPTHS = [0, 1, 2, 3];

// `{ text: "" }` lo cumple toda entidad de `.md` y ninguna `.flo` (#31): las
// semillas son notas y las entidades `.flo` entran por expansión.
export const DEFAULT_GRAPH: GraphQuery = { where: { and: [{ text: "" }] }, from: null, depth: 1, viewBox: null };

export function whereOf(filter: GraphFilter): Where {
  const parts: Where[] = [{ text: filter.text }];
  if (filter.memory) parts.push({ memory: filter.memory });
  if (filter.typeTag) parts.push({ typeTag: filter.typeTag });
  if (filter.contextTag) parts.push({ contextTag: filter.contextTag });
  return { and: parts };
}

/** La inversa de `whereOf`; null si el `where` no lo pudo armar la barra (un preset escrito a mano). */
export function filterOf(where: Where): GraphFilter | null {
  if (!("and" in where)) return null;
  const filter: GraphFilter = { memory: null, typeTag: null, contextTag: null, text: "" };
  let hasText = false;
  for (const part of where.and) {
    if ("text" in part && !hasText) {
      filter.text = part.text;
      hasText = true;
    } else if ("memory" in part && filter.memory === null) filter.memory = part.memory;
    else if ("typeTag" in part && filter.typeTag === null) filter.typeTag = part.typeTag;
    else if ("contextTag" in part && filter.contextTag === null) filter.contextTag = part.contextTag;
    else return null;
  }
  return hasText ? filter : null;
}

export function readBar(root: ParentNode): { filter: GraphFilter; depth: number } {
  const value = (name: string) =>
    root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-flo-kg="${name}"]`)?.value ?? "";
  return {
    filter: {
      memory: (value("memory") || null) as MemoryType | null,
      typeTag: value("typeTag") || null,
      contextTag: value("contextTag") || null,
      text: value("text"),
    },
    depth: Number(value("depth")) || 0,
  };
}

/** Opciones de un select; un valor elegido que ya no está en uso se conserva (lo pidió una vista). */
function options(values: readonly string[], selected: string | null, all: string): string {
  const list = selected !== null && !values.includes(selected) ? [...values, selected] : values;
  const items = list.map(
    (value) => `<option value="${escapeXml(value)}"${value === selected ? " selected" : ""}>${escapeXml(value)}</option>`
  );
  return `<option value="">${all}</option>${items.join("")}`;
}

function legendHtml(): string {
  const items = MEMORY_TYPES.map(
    (type) => `<span><i class="flo-kg-swatch" style="background:${MEMORY_FILL[type]}"></i>${type}</span>`
  );
  return `<span class="flo-kg-legend">${items.join("")}</span>`;
}

/** La barra de la vista de grafo: filtros, semillas, vistas guardadas y leyenda. */
export function graphBarHtml(link: LinkResult, tags: TagCatalog, graph: GraphQuery, presets: string[] | null): string {
  const filter = filterOf(graph.where);
  const shown = filter ?? { memory: null, typeTag: null, contextTag: null, text: "" };
  const depths = [...new Set([...DEPTHS, graph.depth])].sort((a, b) => a - b);
  const parts = [
    `<select data-flo-kg="memory">${options(MEMORY_TYPES, shown.memory, "Toda la memoria")}</select>`,
    `<select data-flo-kg="typeTag">${options(tags.typeTags, shown.typeTag, "Todos los tipos")}</select>`,
    `<select data-flo-kg="contextTag">${options(tags.contextTags, shown.contextTag, "Todo contexto")}</select>`,
    `<input type="search" data-flo-kg="text" placeholder="Buscar" value="${escapeXml(shown.text)}">`,
    `<label>Profundidad <select data-flo-kg="depth">${depths
      .map((depth) => `<option value="${depth}"${depth === graph.depth ? " selected" : ""}>${depth}</option>`)
      .join("")}</select></label>`,
  ];
  if (!filter) parts.push('<span class="flo-kg-note">Filtro de la vista</span>');
  if (graph.from) {
    const labels = graph.from.map((id) => link.entities.get(id)?.label ?? id).join(", ");
    parts.push(`<button type="button" data-flo-kg-clear-from>Centrado en ${escapeXml(labels)} ×</button>`);
  }
  if (presets) {
    parts.push(
      `<select data-flo-kg="preset">${options(presets, null, "Vistas")}</select>`,
      '<button type="button" data-flo-kg-save>Guardar vista</button>'
    );
  }
  parts.push(legendHtml());
  return parts.join("");
}

export function graphHtml(svg: string, empty: boolean): string {
  const body = empty ? '<p class="flo-empty">Ninguna nota coincide con el filtro</p>' : svg;
  return `<section class="flo-block flo-kg"><h2 class="flo-block-title">Grafo de conocimiento</h2>${body}</section>`;
}
