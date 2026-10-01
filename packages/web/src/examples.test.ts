import { describe, it, expect } from "vitest";
import { Workspace, query } from "@flo/core";
import { EXAMPLES } from "./examples.js";

describe("EXAMPLES", () => {
  it.each(EXAMPLES)("$id links with no diagnostics", (example) => {
    const ws = new Workspace();
    for (const [uri, source] of Object.entries(example.files)) ws.setDocument(uri, source);
    const link = ws.link();
    expect([...link.diagnostics.values()].flat()).toEqual([]);
    expect(Object.keys(example.files)).toContain(example.active);
  });

  it("includes a knowledge folder that the graph view shows", () => {
    const example = EXAMPLES.find((candidate) => candidate.id === "conocimiento")!;
    const ws = new Workspace();
    for (const [uri, source] of Object.entries(example.files)) ws.setDocument(uri, source);
    expect(query(ws.link(), { where: { and: [{ text: "" }] }, depth: 1 }).nodes.length).toBeGreaterThan(0);
  });
});
