import { escapeXml, type BlockId, type EntityId, type LinkResult } from "@flo/core";

/** "<título o nombre> · <uri>" de un bloque del workspace. */
export function blockLabel(link: LinkResult, id: BlockId): string {
  const hash = id.lastIndexOf("#");
  const uri = id.slice(0, hash);
  const name = id.slice(hash + 1);
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
    `<p class="flo-panel-actions"><button type="button" data-flo-definition>${escapeXml(entity.uri)}:${entity.nameRange.start.line}</button></p>`,
    `<h4>Aparece en ${flows(blocks.length)}</h4>`,
    flowListHtml(link, blocks),
  ].join("");
}
