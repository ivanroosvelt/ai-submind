import { describe, it, expect } from "vitest";
import { parse } from "./index.js";
import { render } from "../render/index.js";

describe("parse", () => {
  it("returns an empty document for a uri that is not a workspace document (.md without frontmatter)", () => {
    const { document, catalog, diagnostics } = parse("# hola\n", "README.md");
    expect(document).toEqual({ uri: "README.md", uses: [], entities: [], blocks: [] });
    expect(catalog.size).toBe(0);
    expect(diagnostics).toEqual([]);
  });

  it("does not throw for knowledge.schema.yaml and returns its own diagnostics", () => {
    expect(() => render("type_tags: x\n", "knowledge.schema.yaml")).not.toThrow();
    const { diagrams, diagnostics } = render("type_tags: x\n", "knowledge.schema.yaml");
    expect(diagrams).toEqual([]);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.every((d) => d.code === "E068")).toBe(true);
  });

  it("parses a valid .md as a loose document: one entity, E068 because a workspace of one has no schema", () => {
    const { document, diagnostics } = parse("---\nid: a\ntitle: A\nmemory_type: working\n---\n", "a.md");
    expect(document.entities.map((e) => e.id)).toEqual(["a"]);
    expect(diagnostics.map((d) => d.code)).toEqual(["E068"]);
  });

  it("parses and resolves a document, returning the catalog", () => {
    const { document, catalog, diagnostics } = parse("entity a\nentity b\nflow f {\n  a -> b\n}\n", "f.flo");
    expect(diagnostics).toEqual([]);
    expect(document.uri).toBe("f.flo");
    expect([...catalog.keys()]).toEqual(["a", "b"]);
    expect(document.blocks[0].edges[0].from.target).toBe("a");
  });

  it("defaults the uri to an empty string", () => {
    expect(parse("entity a\n").document.entities[0].uri).toBe("");
  });

  it("collects parser, lexer and resolver diagnostics sorted by (line, column)", () => {
    const source = ["flow f {", "  a -> ghost", "  start ->", "}", "@", "entity a", ""].join("\n");
    const { diagnostics } = parse(source);
    // Sin ordenar saldrían agrupados por origen: parser (E014), luego lexer
    // (E002), luego resolver (E030).
    expect(diagnostics.map((d) => [d.code, d.range.start.line])).toEqual([
      ["E030", 2],
      ["E014", 3],
      ["E002", 5],
    ]);
  });
});
