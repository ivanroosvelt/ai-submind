import { describe, it, expect } from "vitest";
import { Text } from "@codemirror/state";
import { buildHighlightRanges } from "./flo-highlight.js";

describe("buildHighlightRanges", () => {
  it("classifies identifiers, node text, punctuation and arrows into distinct classes", () => {
    const source = "start[Inicio]\nstart -> end\n";
    const doc = Text.of(source.split("\n"));

    expect(buildHighlightRanges(doc)).toEqual([
      { from: 0, to: 5, className: "flo-tok-ident" },
      { from: 5, to: 6, className: "flo-tok-punct" },
      { from: 6, to: 12, className: "flo-tok-text" },
      { from: 12, to: 13, className: "flo-tok-punct" },
      { from: 14, to: 19, className: "flo-tok-ident" },
      { from: 20, to: 22, className: "flo-tok-arrow" },
      { from: 23, to: 26, className: "flo-tok-ident" },
    ]);
  });

  it("skips newline and eof tokens", () => {
    const doc = Text.of(["a[X]", ""]);
    const ranges = buildHighlightRanges(doc);
    expect(ranges.every((r) => r.to > r.from)).toBe(true);
    expect(ranges).toHaveLength(4);
  });

  it("skips whitespace-only TEXT tokens (empty after trim)", () => {
    const source = "a[   ]\n";
    const doc = Text.of(source.split("\n"));
    const ranges = buildHighlightRanges(doc);
    // Should have only identifier 'a' and brackets, no flo-tok-text for whitespace
    const textRanges = ranges.filter((r) => r.className === "flo-tok-text");
    expect(textRanges).toHaveLength(0);
  });
});
