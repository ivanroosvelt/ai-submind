import { describe, it, expect } from "vitest";
import type { RenderResult } from "@flo/core";
import { nextPreviewState, previewHtml, type PreviewState } from "./preview.js";

describe("nextPreviewState", () => {
  it("keeps the last valid svg when a new render has no svg (invalid header)", () => {
    const state: PreviewState = { lastSvg: "<svg>OLD</svg>" };
    const result: RenderResult = {
      svg: null,
      diagnostics: [{ code: "E004", message: "x", range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }, severity: "error" }],
    };

    expect(nextPreviewState(state, result).lastSvg).toBe("<svg>OLD</svg>");
  });

  it("replaces the last valid svg when a new render succeeds", () => {
    const state: PreviewState = { lastSvg: "<svg>OLD</svg>" };
    const result: RenderResult = { svg: "<svg>NEW</svg>", diagnostics: [] };

    expect(nextPreviewState(state, result).lastSvg).toBe("<svg>NEW</svg>");
  });
});

describe("previewHtml", () => {
  it("renders just the svg when there are no diagnostics", () => {
    const state: PreviewState = { lastSvg: null };
    const result: RenderResult = { svg: "<svg>OK</svg>", diagnostics: [] };

    expect(previewHtml(state, result)).toBe("<svg>OK</svg>");
  });

  it("prefixes a singular error banner over the svg when there is one diagnostic", () => {
    const state: PreviewState = { lastSvg: null };
    const result: RenderResult = {
      svg: "<svg>PARTIAL</svg>",
      diagnostics: [{ code: "E014", message: "x", range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }, severity: "error" }],
    };

    expect(previewHtml(state, result)).toBe('<div class="flo-banner">1 error</div><svg>PARTIAL</svg>');
  });

  it("prefixes a plural error banner over the last valid svg when the current render has no svg", () => {
    const state: PreviewState = { lastSvg: "<svg>OLD</svg>" };
    const result: RenderResult = {
      svg: null,
      diagnostics: [
        { code: "E003", message: "x", range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }, severity: "error" },
        { code: "E004", message: "y", range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }, severity: "error" },
      ],
    };

    expect(previewHtml(state, result)).toBe('<div class="flo-banner">2 errores</div><svg>OLD</svg>');
  });

  it("shows an empty-state placeholder when there is no svg yet at all", () => {
    const state: PreviewState = { lastSvg: null };
    const result: RenderResult = {
      svg: null,
      diagnostics: [{ code: "E003", message: "x", range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }, severity: "error" }],
    };

    expect(previewHtml(state, result)).toBe(
      '<div class="flo-banner">1 error</div><div class="flo-empty">Escribí un diagrama .flo para ver el preview</div>'
    );
  });
});
