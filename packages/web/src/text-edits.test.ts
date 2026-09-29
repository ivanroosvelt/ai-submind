import { describe, it, expect } from "vitest";
import { applyTextEdits, offsetAt, positionAt, toChanges } from "./text-edits.js";

const source = "entity a\nflow f {\n  a -> a\n}\n";
const range = (l1: number, c1: number, l2: number, c2: number) => ({
  start: { line: l1, column: c1 },
  end: { line: l2, column: c2 },
});

describe("text edits", () => {
  it("converts positions and offsets both ways", () => {
    expect(offsetAt(source, { line: 1, column: 1 })).toBe(0);
    expect(offsetAt(source, { line: 3, column: 3 })).toBe(20);
    expect(positionAt(source, 20)).toEqual({ line: 3, column: 3 });
    expect(positionAt(source, 0)).toEqual({ line: 1, column: 1 });
  });

  it("clamps positions past the end", () => {
    expect(offsetAt(source, { line: 99, column: 1 })).toBe(source.length);
  });

  it("applies non-overlapping edits given in any order", () => {
    const edits = [
      { range: range(3, 8, 3, 9), text: "bb" },
      { range: range(1, 8, 1, 9), text: "bb" },
      { range: range(3, 3, 3, 4), text: "bb" },
    ];
    expect(applyTextEdits(source, edits)).toBe("entity bb\nflow f {\n  bb -> bb\n}\n");
    expect(toChanges(source, edits).map((change) => change.from)).toEqual([7, 20, 25]);
  });
});
