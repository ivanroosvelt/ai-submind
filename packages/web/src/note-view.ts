import { MEMORY_FILL, escapeXml, type EntityDecl, type EntityId, type LinkResult, type Relation } from "@flo/core";

// ponytail: Markdown mínimo a mano (títulos, párrafos, listas, citas, código,
// énfasis, links); sin dependencia nueva. Tablas o HTML crudo salen como texto.

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;

function inline(text: string): string {
  const codes: string[] = [];
  let html = escapeXml(text).replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|\W)_([^_]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return html.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codes[Number(index)]);
}

/**
 * Cuerpo Markdown a HTML. `diagramsAt(i)` da el HTML de los diagramas de la
 * cerca ` ```flo ` cuyo contenido arranca en la línea `i` (0-based) del cuerpo.
 */
export function markdownHtml(body: string, diagramsAt: (start: number, end: number) => string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.tag}>`);
    if (quote.length > 0) out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
    paragraph = [];
    list = null;
    quote = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      let end = index + 1;
      while (end < lines.length && !lines[end].trim().startsWith(fence[1])) end++;
      const content = lines.slice(index + 1, end);
      const diagrams = fence[2] === "flo" ? diagramsAt(index + 1, end) : "";
      out.push(diagrams || `<pre><code>${escapeXml(content.join("\n"))}</code></pre>`);
      index = end;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const quoted = /^\s*>\s?(.*)$/.exec(line);
    if (heading) {
      flush();
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push("<hr>");
    } else if (bullet || ordered) {
      const tag = bullet ? "ul" : "ol";
      if (paragraph.length > 0 || quote.length > 0 || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push((bullet ?? ordered)![1]);
    } else if (quoted) {
      if (paragraph.length > 0 || list) flush();
      quote.push(quoted[1]);
    } else if (line.trim() === "") {
      flush();
    } else if (list) {
      // Continuación de un ítem.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      if (quote.length > 0) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return out.join("");
}

const chip = (text: string, extra = "") => `<span class="flo-chip${extra}">${escapeXml(text)}</span>`;

function refHtml(relation: Relation, label: string): string {
  const type = `<span class="flo-relation-type">${escapeXml(relation.type)}</span>`;
  const target = relation.resolved;
  if (!target) return `<li><span class="flo-relation flo-unresolved" title="Sin resolver">${type}${escapeXml(label)}</span></li>`;
  const attribute = target.kind === "entity" ? "data-flo-ref-entity" : "data-flo-ref-block";
  return `<li><button type="button" class="flo-relation" ${attribute}="${escapeXml(target.id)}">${type}${escapeXml(label)}</button></li>`;
}

/**
 * Cabecera de una nota: título, memoria, tags, relaciones salientes y las
 * notas que la referencian (la vuelta); cada destino resuelto es navegable.
 */
export function noteHeaderHtml(link: LinkResult, entity: EntityDecl): string {
  const knowledge = entity.knowledge!;
  const labelOf = (id: EntityId) => link.entities.get(id)?.label ?? id;
  const memory = knowledge.memoryType
    ? `<span class="flo-chip flo-chip-memory"><i class="flo-kg-swatch" style="background:${MEMORY_FILL[knowledge.memoryType]}"></i>${knowledge.memoryType}</span>`
    : "";
  const tags = [
    ...knowledge.typeTags.map((tag) => chip(tag, " flo-chip-type")),
    ...knowledge.contextTags.map((tag) => chip(tag)),
    ...Object.entries(knowledge.customTags).map(([key, value]) => chip(`${key}: ${value}`)),
  ];
  const outgoing = knowledge.relations.map((relation) =>
    refHtml(relation, relation.resolved?.kind === "entity" ? labelOf(relation.resolved.id) : relation.target)
  );
  const incoming = link.xref
    .relationsTo(entity.id)
    .map(({ from, relation }) => refHtml({ ...relation, resolved: { kind: "entity", id: from } }, labelOf(from)));
  const list = (title: string, items: string[]) =>
    items.length > 0 ? `<h4>${title}</h4><ul class="flo-relations">${items.join("")}</ul>` : "";
  return [
    '<header class="flo-note-header">',
    `<h1>${escapeXml(entity.label)}</h1>`,
    `<p class="flo-note-meta"><code>${escapeXml(entity.id)}</code>${memory}${tags.join("")}</p>`,
    list("Relaciones", outgoing),
    list("Referenciada por", incoming),
    "</header>",
  ].join("");
}
