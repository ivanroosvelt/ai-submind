import { describe, it, expect } from "vitest";
import { layoutSequence } from "./sequence.js";
import { parse } from "../parser/index.js";

function firstBlock(source: string) {
  const { document, catalog } = parse(source);
  return { block: document.blocks[0], catalog };
}

describe("layoutSequence", () => {
  it("places participants in columns and a message on the first row", () => {
    const { block, catalog } = firstBlock("entity a [Alice]\nentity b [Bob]\nsequence s {\n  a -> b : hola\n}\n");

    expect(layoutSequence(block, catalog)).toEqual({
      width: 320,
      height: 190,
      lifelineTop: 50,
      lifelineBottom: 170,
      participants: [
        { id: "a", label: "Alice", resolved: true, x: 80 },
        { id: "b", label: "Bob", resolved: true, x: 240 },
      ],
      messages: [{ from: "a", to: "b", label: "hola", y: 120 }],
    });
  });

  it("increments the row for each successive message, in source order", () => {
    const { block, catalog } = firstBlock("entity a\nentity b\nsequence s {\n  a -> b : uno\n  b -> a : dos\n}\n");
    expect(layoutSequence(block, catalog).messages.map((m) => [m.label, m.y])).toEqual([
      ["uno", 120],
      ["dos", 170],
    ]);
  });

  it("orders columns by catalog declaration, with unresolved participants last", () => {
    const { block, catalog } = firstBlock("entity b\nentity a\nsequence s {\n  ghost -> a : x\n  a -> b : y\n}\n");
    expect(layoutSequence(block, catalog).participants.map((p) => [p.id, p.resolved])).toEqual([
      ["b", true],
      ["a", true],
      ["ghost", false],
    ]);
  });

  it("lays out an empty block with no columns", () => {
    const { block, catalog } = firstBlock("sequence s {\n}\n");
    const layout = layoutSequence(block, catalog);
    expect(layout.participants).toEqual([]);
    expect(layout.width).toBe(0);
  });
});
