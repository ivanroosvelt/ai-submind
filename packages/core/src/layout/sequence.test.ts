import { describe, it, expect } from "vitest";
import { layoutSequence } from "./sequence.js";
import type { SequenceDiagram } from "../ast.js";

describe("layoutSequence", () => {
  it("places participants in columns and a message on the first row", () => {
    const diagram: SequenceDiagram = {
      kind: "sequence",
      participants: [
        { id: "a", label: "Alice", position: { line: 1, column: 1 } },
        { id: "b", label: "Bob", position: { line: 2, column: 1 } },
      ],
      messages: [{ from: "a", to: "b", label: "hola", position: { line: 3, column: 1 } }],
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
        { id: "a", label: "a", position: { line: 1, column: 1 } },
        { id: "b", label: "b", position: { line: 1, column: 6 } },
      ],
      messages: [
        { from: "a", to: "b", label: "hola", position: { line: 1, column: 1 } },
        { from: "b", to: "a", label: "chau", position: { line: 2, column: 1 } },
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
      participants: [{ id: "a", label: "a", position: { line: 1, column: 1 } }],
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
