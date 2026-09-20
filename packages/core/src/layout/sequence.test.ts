import { describe, it, expect } from "vitest";
import { layoutSequence } from "./sequence.js";
import type { SequenceDiagram, Range } from "../ast.js";

// ponytail: layout ignores range/nameRange entirely, so the exact span here is
// irrelevant to these tests — one placeholder stands in for every occurrence.
const RANGE: Range = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

describe("layoutSequence", () => {
  it("places participants in columns and a message on the first row", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [
        { id: "a", label: "Alice", range: RANGE, nameRange: RANGE },
        { id: "b", label: "Bob", range: RANGE, nameRange: RANGE },
      ],
      messages: [{ from: "a", to: "b", label: "hola", range: RANGE, fromRange: RANGE, toRange: RANGE }],
    };

    expect(layoutSequence(diagram)).toEqual({
      width: 320,
      height: 190,
      lifelineTop: 50,
      lifelineBottom: 170,
      participants: [
        { id: "a", label: "Alice", x: 80 },
        { id: "b", label: "Bob", x: 240 },
      ],
      messages: [{ from: "a", to: "b", label: "hola", y: 120 }],
    });
  });

  it("increments the row for each successive message, in declaration order", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [
        { id: "a", label: "a", range: RANGE, nameRange: RANGE },
        { id: "b", label: "b", range: RANGE, nameRange: RANGE },
      ],
      messages: [
        { from: "a", to: "b", label: "hola", range: RANGE, fromRange: RANGE, toRange: RANGE },
        { from: "b", to: "a", label: "chau", range: RANGE, fromRange: RANGE, toRange: RANGE },
      ],
    };

    const layout = layoutSequence(diagram);

    expect(layout.messages.map((message) => message.y)).toEqual([120, 170]);
    expect(layout.lifelineBottom).toBe(220);
    expect(layout.height).toBe(240);
  });

  it("lays out a diagram with no messages, keeping just the header row", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [{ id: "a", label: "a", range: RANGE, nameRange: RANGE }],
      messages: [],
    };

    expect(layoutSequence(diagram)).toEqual({
      width: 160,
      height: 140,
      lifelineTop: 50,
      lifelineBottom: 120,
      participants: [{ id: "a", label: "a", x: 80 }],
      messages: [],
    });
  });
});
