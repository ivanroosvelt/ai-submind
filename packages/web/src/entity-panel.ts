import { escapeXml, parseBlockId, type BlockId, type EntityId, type LinkResult, type QueryEdge } from "@flo/core";

/** "<título o nombre> · <uri>" de un bloque del workspace. */
export function blockLabel(link: LinkResult, id: BlockId): string {
  const { uri, name } = parseBlockId(id);
  const block = link.documents.get(uri)?.document.blocks.find((candidate) => candidate.name === name);
  return `${block?.title ?? name} · ${uri}`;
}

export function flowListHtml(link: LinkResult, blocks: BlockId[]): string {
  const items = blocks.map(
    (id) =>
      `<li><button type="button" class="flo-tree-item" data-flo-block="${escapeXml(id)}">${escapeXml(blockLabel(link, id))}</button></li>`
  );
  return `<ul class="flo-tree">${items.join("")}</ul>`;
}

const flows = (n: number) => `${n} ${n === 1 ? "flujo" : "flujos"}`;

/** Panel de una entidad que existe en `link.entities` (spec §8). */
export function entityPanelHtml(link: LinkResult, id: EntityId): string {
  const entity = link.entities.get(id)!;
  const blocks = link.xref.flowsUsing(id);
  const meta = [entity.type, ...entity.tags.map((tag) => `#${tag}`)].filter(Boolean).join(" ");
  return [
    `<h3 class="flo-panel-title">${escapeXml(entity.label)}</h3>`,
    `<p class="flo-panel-meta"><code>${escapeXml(entity.id)}</code>${meta ? ` · ${escapeXml(meta)}` : ""}</p>`,
    `<p class="flo-panel-actions"><button type="button" data-flo-definition>${escapeXml(entity.uri)}:${entity.nameRange.start.line}</button> <button type="button" data-flo-rename>Renombrar</button></p>`,
    `<h4>Aparece en ${flows(blocks.length)}</h4>`,
    flowListHtml(link, blocks),
  ].join("");
}

/** Panel de una arista del mapa: los flujos que la contienen. */
export function edgePanelHtml(link: LinkResult, edge: QueryEdge): string {
  const label = (id: EntityId) => escapeXml(link.entities.get(id)?.label ?? id);
  const blocks = edge.blocks ?? [];
  return [
    `<h3 class="flo-panel-title">${label(edge.from)} → ${label(edge.to)}</h3>`,
    `<h4>En ${flows(blocks.length)}</h4>`,
    flowListHtml(link, blocks),
  ].join("");
}
