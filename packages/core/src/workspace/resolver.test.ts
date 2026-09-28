import { describe, it, expect } from "vitest";
import { parseDocument } from "../parser/document.js";
import { resolveDocument } from "./resolver.js";

function resolve(source: string) {
  const { document } = parseDocument(source, "a.flo");
  return { document, ...resolveDocument(document) };
}

describe("resolveDocument", () => {
  it("resolves references to entities declared anywhere in the document (order-independent)", () => {
    const { document, catalog, diagnostics } = resolve("flow f {\n  a -> b\n}\nentity a\nentity b\n");
    expect(diagnostics).toEqual([]);
    expect([...catalog.keys()]).toEqual(["a", "b"]);
    const edge = document.blocks[0].edges[0];
    expect(edge.from.target).toBe("a");
    expect(edge.to.target).toBe("b");
  });

  it("reports E030 at each unresolved reference, with the fix in the message", () => {
    const { document, diagnostics } = resolve("entity a\nflow f {\n  a -> Cache\n}\n");
    expect(diagnostics).toEqual([
      {
        code: "E030",
        message: "la entidad 'Cache' no está declarada; añade 'entity Cache'",
        range: { start: { line: 3, column: 8 }, end: { line: 3, column: 13 } },
        severity: "error",
      },
    ]);
    expect(document.blocks[0].edges[0].to.target).toBeNull();
  });

  it("keeps the first declaration of a duplicated entity and reports E031 at the second one's name", () => {
    const { catalog, diagnostics } = resolve("entity a [Primera]\nentity a [Segunda]\n");
    expect(catalog.get("a")?.label).toBe("Primera");
    expect(diagnostics.map((d) => [d.code, d.range.start])).toEqual([["E031", { line: 2, column: 8 }]]);
  });

  it("reports E033 at the name of a duplicated block, across flow and sequence", () => {
    const { diagnostics } = resolve("entity a\nflow x {\n  a -> a\n}\nsequence x {\n  a -> a : y\n}\n");
    expect(diagnostics.map((d) => [d.code, d.range.start])).toEqual([["E033", { line: 5, column: 10 }]]);
  });
});
