import { describe, it, expect } from "vitest";
import { Workspace, render } from "@tejo/core";
import type { Diagnostic, RenderResult, RenderedDiagram } from "@tejo/core";
import { nextPreviewState, previewHtml, renderActive, scopeMarkerIds, type PreviewState } from "./preview.js";

const ERROR: Diagnostic = {
  code: "E040",
  message: "x",
  range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
};

function diagram(name: string, svg: string, title: string | null = null): RenderedDiagram {
  return { name, title, kind: "flow", svg };
}

function linked(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

describe("nextPreviewState", () => {
  it("keeps the last diagrams when the new render has none and has errors", () => {
    const state: PreviewState = { lastDiagrams: [diagram("a", "<svg>OLD</svg>")] };
    const result: RenderResult = { diagrams: [], diagnostics: [ERROR] };
    expect(nextPreviewState(state, result)).toBe(state);
  });

  it("replaces the last diagrams when the new render has some", () => {
    const state: PreviewState = { lastDiagrams: [diagram("a", "<svg>OLD</svg>")] };
    const result: RenderResult = { diagrams: [diagram("b", "<svg>NEW</svg>")], diagnostics: [] };
    expect(nextPreviewState(state, result).lastDiagrams).toEqual(result.diagrams);
  });

  it("clears the diagrams for a valid document with no blocks", () => {
    const state: PreviewState = { lastDiagrams: [diagram("a", "<svg>OLD</svg>")] };
    expect(nextPreviewState(state, { diagrams: [], diagnostics: [] }).lastDiagrams).toEqual([]);
  });
});

describe("renderActive", () => {
  it("renders the active document's blocks against its reachable catalog", () => {
    const link = linked({ "a.flo": "entity x [Equis]\nentity y\n", "b.flo": 'use "./a.flo"\nflow f {\n  x -> y\n}\n' });
    const result = renderActive(link, "b.flo");
    expect(result.diagnostics).toEqual([]);
    expect(result.diagrams[0].svg).toContain(">Equis<");
    expect(result.diagrams[0].svg).toContain('data-flo-uri="b.flo"');
  });

  it("renders the flo fences of a .md", () => {
    const link = linked({
      "n.md": "---\nid: n\ntitle: N\nmemory_type: working\n---\n```flo\nentity a\nflow f {\n  a -> a\n}\n```\n",
    });
    expect(renderActive(link, "n.md").diagrams).toHaveLength(1);
  });
});

describe("previewHtml", () => {
  it("renders each diagram in its own section, titled with its title or its name", () => {
    const result: RenderResult = {
      diagrams: [
        diagram("login", '<svg width="1" height="1">1</svg>', "Inicio de sesión"),
        diagram("detalle", '<svg width="1" height="1">2</svg>'),
      ],
      diagnostics: [],
    };
    expect(previewHtml({ lastDiagrams: [] }, result, "")).toBe(
      '<section class="flo-block" data-flo-block="#login"><h2 class="flo-block-title">Inicio de sesión</h2><svg width="1" height="1">1</svg></section>' +
        '<section class="flo-block" data-flo-block="#detalle"><h2 class="flo-block-title">detalle</h2><svg width="1" height="1">2</svg></section>'
    );
  });

  it("escapes the block title (it comes from user source)", () => {
    const result: RenderResult = {
      diagrams: [diagram("x", '<svg width="1" height="1"></svg>', '<img src=x onerror="alert(1)">')],
      diagnostics: [],
    };
    const html = previewHtml({ lastDiagrams: [] }, result, "");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("prefixes an error banner over the last valid diagrams when the current render has none", () => {
    const state: PreviewState = { lastDiagrams: [diagram("a", '<svg width="1" height="1">OLD</svg>')] };
    const html = previewHtml(state, { diagrams: [], diagnostics: [ERROR, ERROR] }, "");
    expect(html).toBe(
      '<div class="flo-banner">2 errores</div><section class="flo-block" data-flo-block="#a"><h2 class="flo-block-title">a</h2><svg width="1" height="1">OLD</svg></section>'
    );
  });

  it("shows only the banner when there are errors and nothing to draw", () => {
    const html = previewHtml({ lastDiagrams: [] }, { diagrams: [], diagnostics: [ERROR] }, "a.flo");
    expect(html).toBe('<div class="flo-banner">1 error</div>');
  });
});

describe("previewHtml (workspace)", () => {
  it("tags each section with its block id", () => {
    const html = previewHtml(
      { lastDiagrams: [] },
      { diagrams: [diagram("f", '<svg width="10" height="10"></svg>')], diagnostics: [] },
      "dir/a.flo"
    );
    expect(html).toContain('<section class="flo-block" data-flo-block="dir/a.flo#f">');
  });

  it("says 'Bloque vacío' instead of a zero-size svg", () => {
    const html = previewHtml(
      { lastDiagrams: [] },
      { diagrams: [diagram("f", '<svg width="0" height="0"></svg>')], diagnostics: [] },
      "a.flo"
    );
    expect(html).toContain("Bloque vacío");
    expect(html).not.toContain("<svg");
  });
});

describe("scopeMarkerIds", () => {
  it("gives each SVG of the page its own arrow marker (#58)", () => {
    const div = document.createElement("div");
    div.innerHTML = render("entity a\nentity b\nflow f {\n  a -> b\n}\nflow g {\n  b -> a\n}\n")
      .diagrams.map((d) => d.svg)
      .join("");
    scopeMarkerIds(div);
    expect([...div.querySelectorAll("marker")].map((m) => m.id)).toEqual(["flo-arrow-0", "flo-arrow-1"]);
    const second = div.querySelectorAll("svg")[1].querySelector("polyline")!;
    expect(second.getAttribute("marker-end")).toBe("url(#flo-arrow-1)");
  });
});
