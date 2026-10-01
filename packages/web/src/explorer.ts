import { blockId, escapeXml, type BlockId, type DocumentUri, type EntityId } from "@flo/core";
import type { EditorWorkspace } from "./workspace.js";

export interface ExplorerFilter {
  type: string | null;
  tag: string | null;
}

export interface ExplorerActions {
  onOpenDocument(uri: DocumentUri): void;
  onSelectBlock(id: BlockId): void;
  onSelectEntity(id: EntityId): void;
  onFilter(filter: ExplorerFilter): void;
}

function selectHtml(name: string, values: string[], selected: string | null, all: string): string {
  const options = values.map(
    (value) => `<option value="${escapeXml(value)}"${value === selected ? " selected" : ""}>${escapeXml(value)}</option>`
  );
  return `<select data-flo-filter="${name}"><option value="">${all}</option>${options.join("")}</select>`;
}

const item = (attribute: string, value: string, label: string, extraClass = "") =>
  `<button type="button" class="flo-tree-item${extraClass}" ${attribute}="${escapeXml(value)}">${label}</button>`;

/** Catálogo filtrable por type y tag (#6) y archivos con sus bloques (spec §8). */
export function explorerHtml(ws: EditorWorkspace, filter: ExplorerFilter, selectedBlock: BlockId | null): string {
  const link = ws.link();
  const entities = [...link.entities.values()];
  const types = [...new Set(entities.flatMap((entity) => (entity.type ? [entity.type] : [])))];
  const tags = [...new Set(entities.flatMap((entity) => entity.tags))];
  // Un filtro cuyo valor ya no existe (se borró al editar) no filtra.
  const type = filter.type !== null && types.includes(filter.type) ? filter.type : null;
  const tag = filter.tag !== null && tags.includes(filter.tag) ? filter.tag : null;

  const catalog = entities
    .filter((entity) => (type === null || entity.type === type) && (tag === null || entity.tags.includes(tag)))
    .map((entity) => `<li>${item("data-flo-entity", entity.id, `${escapeXml(entity.label)} <small>${escapeXml(entity.id)}</small>`)}</li>`)
    .join("");

  const files = ws
    .uris()
    .map((uri) => {
      const blocks = (link.documents.get(uri)?.document.blocks ?? []).map((block) => {
        const id = blockId(uri, block.name);
        return `<li>${item("data-flo-block", id, escapeXml(block.title ?? block.name), id === selectedBlock ? " flo-selected" : "")}</li>`;
      });
      const dirty = ws.isUnsaved(uri) ? ' <span class="flo-dirty" title="Sin guardar">●</span>' : "";
      const file = item("data-flo-open", uri, `${escapeXml(uri)}${dirty}`, uri === ws.active ? " flo-active" : "");
      return `<li>${file}${blocks.length > 0 ? `<ul class="flo-tree">${blocks.join("")}</ul>` : ""}</li>`;
    })
    .join("");

  return [
    '<section class="flo-explorer-section"><h3>Catálogo</h3>',
    `<div class="flo-filters">${selectHtml("type", types, type, "Todos los tipos")}${selectHtml("tag", tags, tag, "Todos los tags")}</div>`,
    `<ul class="flo-tree">${catalog || '<li class="flo-empty">Sin entidades</li>'}</ul></section>`,
    `<section class="flo-explorer-section"><h3>Archivos</h3><ul class="flo-tree">${files}</ul></section>`,
  ].join("");
}

/** Delegación: el HTML se reemplaza en cada refresh, los listeners quedan en el contenedor. */
export function bindExplorer(container: HTMLElement, actions: ExplorerActions): void {
  container.addEventListener("click", (event) => {
    const button = (event.target as Element).closest("button");
    if (!button) return;
    const open = button.getAttribute("data-flo-open");
    const block = button.getAttribute("data-flo-block");
    const entity = button.getAttribute("data-flo-entity");
    if (open !== null) actions.onOpenDocument(open);
    else if (block !== null) actions.onSelectBlock(block);
    else if (entity !== null) actions.onSelectEntity(entity);
  });
  container.addEventListener("change", () => {
    const value = (name: string) =>
      container.querySelector<HTMLSelectElement>(`select[data-flo-filter="${name}"]`)?.value || null;
    actions.onFilter({ type: value("type"), tag: value("tag") });
  });
}
