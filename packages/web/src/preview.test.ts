import { describe, it, expect } from "vitest";
import type { Diagnostic, RenderResult, RenderedDiagram } from "@flo/core";
import { nextPreviewState, previewHtml, type PreviewState } from "./preview.js";

const ERROR: Diagnostic = {
  code: "E040",
  message: "x",
  range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
  severity: "error",
};

function diagram(name: string, svg: string, title: string | null = null): RenderedDiagram {
  return { name, title, kind: "flow", svg };
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

describe("previewHtml", () => {
  it("renders each diagram in its own section, titled with its title or its name", () => {
    const result: RenderResult = {
      diagrams: [diagram("login", "<svg>1</svg>", "Inicio de sesión"), diagram("detalle", "<svg>2</svg>")],
      diagnostics: [],
    };
    expect(previewHtml({ lastDiagrams: [] }, result)).toBe(
      '<section class="flo-block"><h2 class="flo-block-title">Inicio de sesión</h2><svg>1</svg></section>' +
        '<section class="flo-block"><h2 class="flo-block-title">detalle</h2><svg>2</svg></section>'
    );
  });

  it("escapes the block title (it comes from user source)", () => {
    const result: RenderResult = {
      diagrams: [diagram("x", "<svg></svg>", '<img src=x onerror="alert(1)">')],
      diagnostics: [],
    };
    const html = previewHtml({ lastDiagrams: [] }, result);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("prefixes an error banner over the last valid diagrams when the current render has none", () => {
    const state: PreviewState = { lastDiagrams: [diagram("a", "<svg>OLD</svg>")] };
    const html = previewHtml(state, { diagrams: [], diagnostics: [ERROR, ERROR] });
    expect(html).toBe(
      '<div class="flo-banner">2 errores</div><section class="flo-block"><h2 class="flo-block-title">a</h2><svg>OLD</svg></section>'
    );
  });

  it("shows the empty-state placeholder when there is nothing to show", () => {
    expect(previewHtml({ lastDiagrams: [] }, { diagrams: [], diagnostics: [ERROR] })).toBe(
      '<div class="flo-banner">1 error</div><div class="flo-empty">Escribí un diagrama .flo para ver el preview</div>'
    );
  });
});
