import { describe, it, expect } from "vitest";
import { Workspace } from "../workspace/workspace.js";
import { query } from "../workspace/query.js";
import { FILL_COLOR } from "./svg.js";
import { MEMORY_FILL, renderKnowledge, wrapLabel } from "./knowledge.js";

// Los data-flo-* no son geometría (decisión #26): se quitan antes del snapshot.
function geometry(svg: string): string {
  return svg.replace(/ data-flo-[a-z]+="[^"]*"/g, "");
}

const FILES: Record<string, string> = {
  "catalog.flo": 'entity api [API]\nentity db\nflow acceso "Acceso" {\n  api -> db\n}\n',
  "kb/pkce.md": [
    "---",
    "id: pkce",
    "title: PKCE",
    "memory_type: long_term",
    "type_tags: [decision]",
    'use: ["../catalog.flo"]',
    "relations:",
    "  - target: api",
    "    type: affects",
    "  - target: api",
    "    type: affects",
    "  - target: api",
    "    type: enforces",
    "  - target: ../catalog.flo#acceso",
    "    type: visualized_by",
    "  - target: rule.md",
    "    type: enforces",
    "---",
    "Texto.",
    "",
  ].join("\n"),
  "kb/rule.md": '---\nid: rule\ntitle: "Regla <1> & \\"b\\""\nmemory_type: working\n---\n',
};

function linkOf(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

const count = (text: string, part: string) => text.split(part).length - 1;

describe("renderKnowledge", () => {
  const link = linkOf(FILES);
  const svg = renderKnowledge(link, query(link, { where: { text: "" }, depth: 1 }));

  it("uses a fixture without diagnostics", () => {
    expect([...link.diagnostics.values()].flat()).toEqual([]);
  });

  it("matches the knowledge graph snapshot", () => {
    expect(geometry(svg)).toMatchSnapshot();
  });

  it("colors knowledge nodes by memory type and keeps .flo entities plain", () => {
    expect(svg).toContain(`<g class="flo-mem-long_term" data-flo-entity="pkce" data-flo-uri="kb/pkce.md"><rect`);
    expect(svg).toContain(`fill="${MEMORY_FILL.long_term}"`);
    expect(svg).toContain(`<g class="flo-mem-working" data-flo-entity="rule" data-flo-uri="kb/rule.md">`);
    expect(svg).toContain(`fill="${MEMORY_FILL.working}"`);
    expect(svg).toContain(`<g data-flo-entity="api" data-flo-uri="catalog.flo"><rect`);
    expect(svg).toContain(`fill="${FILL_COLOR}"`);
  });

  it("draws a duplicated relation once and two relation types between a pair as two edges", () => {
    expect(count(svg, 'data-flo-from="pkce" data-flo-to="api" data-flo-type="affects"')).toBe(1);
    expect(count(svg, 'data-flo-from="pkce" data-flo-to="api" data-flo-type="enforces"')).toBe(1);
    expect(svg).toContain(">affects<");
    expect(svg).toContain(">enforces<");
  });

  it("adds a node for a block target and an edge to it", () => {
    expect(svg).toContain('<g class="flo-kg-block" data-flo-block="catalog.flo#acceso" data-flo-uri="catalog.flo"><rect');
    expect(svg).toContain(">Acceso<");
    expect(svg).toContain(
      'data-flo-from="pkce" data-flo-to="catalog.flo#acceso" data-flo-type="visualized_by" data-flo-block="catalog.flo#acceso"'
    );
    expect(svg).toContain(">visualized_by<");
  });

  it("draws flow edges without a label", () => {
    const deeper = renderKnowledge(link, query(link, { where: { text: "" }, depth: 2 }));
    expect(deeper).toContain('data-flo-from="api" data-flo-to="db" data-flo-type="flow"');
    expect(deeper).not.toContain(">flow<");
  });

  it("escapes titles", () => {
    expect(svg).toContain(">Regla &lt;1&gt; &amp; &quot;b&quot;<");
    expect(svg).not.toContain("<1>");
  });

  it("gives an empty svg for an empty result", () => {
    const empty = renderKnowledge(link, { nodes: [], edges: [] });
    expect(empty).toContain('width="0"');
    expect(empty).not.toContain("<g");
  });
});

describe("wrapLabel", () => {
  it("keeps short titles in one line", () => {
    expect(wrapLabel("Regla corta")).toEqual(["Regla corta"]);
  });

  it("breaks long titles by words, each line within 28 chars", () => {
    const lines = wrapLabel("Decisión: flujo del dinero (Anditour cobra el abono); pasarela pendiente");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length <= 28)).toBe(true);
    expect(lines.join(" ")).toBe("Decisión: flujo del dinero (Anditour cobra el abono); pasarela pendiente");
  });
});
