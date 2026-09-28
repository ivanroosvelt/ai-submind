import { describe, it, expect } from "vitest";
import { render, renderBlock } from "./index.js";
import { Workspace } from "../workspace/workspace.js";

describe("render", () => {
  it("returns no diagrams and no diagnostics for an empty file", () => {
    expect(render("")).toEqual({ diagrams: [], diagnostics: [] });
  });

  it("renders one diagram per block, in source order, with name, title and kind", () => {
    const source = [
      "entity a [A]",
      "entity b [B]",
      'flow uno "Primero" {',
      "  a -> b",
      "}",
      "sequence dos {",
      "  a -> b : hola",
      "}",
      "",
    ].join("\n");

    const { diagrams, diagnostics } = render(source);

    expect(diagnostics).toEqual([]);
    expect(diagrams.map((d) => [d.name, d.title, d.kind])).toEqual([
      ["uno", "Primero", "flow"],
      ["dos", null, "sequence"],
    ]);
    expect(diagrams[0].svg).toContain(">A<");
    expect(diagrams[1].svg).toContain('class="flo-seq-header-box"');
  });

  it("renders an entity the same way in every block that uses it", () => {
    const { diagrams } = render("entity db {Base}\nentity a\nflow x {\n  a -> db\n}\nflow y {\n  db -> a\n}\n");
    for (const diagram of diagrams) {
      expect(diagram.svg).toContain("<polygon");
      expect(diagram.svg).toContain(">Base<");
    }
  });

  it("still renders the block when an edge line has a recoverable error", () => {
    const { diagrams, diagnostics } = render("entity start [Inicio]\nentity b\nflow f {\n  start -> b\n  start ->\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E014"]);
    expect(diagrams[0].svg).toContain(">Inicio<");
  });

  it("renders a block with an unresolved reference (E030) with finite coordinates", () => {
    const { diagrams, diagnostics } = render("entity start [Inicio]\nflow f {\n  start -> ghost\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E030"]);
    expect(diagrams[0].svg).toContain('class="flo-unresolved"');
    expect(diagrams[0].svg).not.toContain("NaN");
  });

  it("computes finite dimensions for an empty block", () => {
    const { diagrams, diagnostics } = render("flow f {\n}\n");
    expect(diagnostics).toEqual([]);
    expect(diagrams[0].svg).not.toContain("Infinity");
    expect(diagrams[0].svg).not.toContain("NaN");
  });

  it("keeps both labels when two edges share the same from/to pair", () => {
    const { diagrams, diagnostics } = render("entity a\nentity b\nflow f {\n  a -> b : si\n  a -> b : no\n}\n");
    expect(diagnostics).toEqual([]);
    expect(diagrams[0].svg).toContain(">si<");
    expect(diagrams[0].svg).toContain(">no<");
  });
});

describe("render: data-flo-* annotations", () => {
  it("annotates every node and edge with its entity, block, document and line", () => {
    const svg = render("entity a [A]\nflow f {\n  a -> ghost : sí\n}\n", "docs/login.flo").diagrams[0].svg;
    expect(svg).toContain(
      '<g data-flo-entity="a" data-flo-block="docs/login.flo#f" data-flo-uri="docs/login.flo" data-flo-line="3">'
    );
    expect(svg).toContain(
      '<g class="flo-unresolved" data-flo-entity="ghost" data-flo-block="docs/login.flo#f" data-flo-uri="docs/login.flo" data-flo-line="3">'
    );
    expect(svg).toContain(
      'marker-end="url(#flo-arrow)" data-flo-from="a" data-flo-to="ghost" data-flo-block="docs/login.flo#f" data-flo-uri="docs/login.flo" data-flo-line="3" />'
    );
  });

  it("annotates sequence participants and each message with its own line", () => {
    const svg = render("entity a\nentity b\nsequence s {\n  a -> b : uno\n  b -> a : dos\n}\n", "s.flo").diagrams[0].svg;
    expect(svg).toContain(
      '<g data-flo-entity="a" data-flo-block="s.flo#s" data-flo-uri="s.flo" data-flo-line="4"><g class="flo-seq-header-box">'
    );
    expect(svg).toContain(
      '<g data-flo-entity="b" data-flo-block="s.flo#s" data-flo-uri="s.flo" data-flo-line="4"><g class="flo-seq-header-box">'
    );
    expect(svg).toContain('data-flo-from="a" data-flo-to="b" data-flo-block="s.flo#s" data-flo-uri="s.flo" data-flo-line="4" />');
    expect(svg).toContain('data-flo-from="b" data-flo-to="a" data-flo-block="s.flo#s" data-flo-uri="s.flo" data-flo-line="5" />');
  });

  it("gives each node one annotated group, with the line of its first reference in the block", () => {
    const svg = render("entity a\nentity b\nentity c\nflow f {\n  a -> b\n  c -> a\n  b -> c\n}\n").diagrams[0].svg;
    expect(svg.match(/data-flo-entity=/g)).toHaveLength(3);
    expect(svg).toContain('data-flo-entity="b" data-flo-block="#f" data-flo-uri="" data-flo-line="5"');
    expect(svg).toContain('data-flo-entity="c" data-flo-block="#f" data-flo-uri="" data-flo-line="6"');
  });

  it("annotates an entity shared by two blocks with each block's own id", () => {
    const [x, y] = render("entity a\nentity b\nflow x {\n  a -> b\n}\nflow y {\n  b -> a\n}\n", "d.flo").diagrams;
    expect(x.svg).toContain('data-flo-entity="a" data-flo-block="d.flo#x" data-flo-uri="d.flo" data-flo-line="4"');
    expect(y.svg).toContain('data-flo-entity="a" data-flo-block="d.flo#y" data-flo-uri="d.flo" data-flo-line="7"');
  });

  it("escapes the document uri inside the attributes", () => {
    const svg = render("entity a\nentity b\nflow f {\n  a -> b\n}\n", 'r&d/"<x>".flo').diagrams[0].svg;
    expect(svg).toContain('data-flo-uri="r&amp;d/&quot;&lt;x&gt;&quot;.flo"');
    expect(svg).toContain('data-flo-block="r&amp;d/&quot;&lt;x&gt;&quot;.flo#f"');
    expect(svg).not.toContain('"<x>"');
  });

  it("annotates an entity declared in another document with the block's document and the reference line", () => {
    const workspace = new Workspace();
    workspace.setDocument("catalogo.flo", "entity api [API]\nentity db [DB]\n");
    workspace.setDocument("login.flo", 'use "./catalogo.flo"\n\nflow acceso {\n  api -> db\n}\n');
    const { document, catalog } = workspace.link().documents.get("login.flo")!;

    const diagram = renderBlock(document.blocks[0], catalog, "login.flo");

    expect(diagram).toMatchObject({ name: "acceso", title: null, kind: "flow" });
    expect(diagram.svg).toContain(
      '<g data-flo-entity="api" data-flo-block="login.flo#acceso" data-flo-uri="login.flo" data-flo-line="4">'
    );
    expect(diagram.svg).not.toContain("catalogo.flo");
  });
});
