import { describe, it, expect } from "vitest";
import { blockId, isDocumentUri, isIgnoredUri, parseBlockId, resolveUse } from "./uri.js";

describe("resolveUse", () => {
  it.each([
    ["a.flo", "./b.flo", "b.flo"],
    ["a.flo", "b.flo", "b.flo"],
    ["dir/a.flo", "./b.flo", "dir/b.flo"],
    ["dir/a.flo", "../b.flo", "b.flo"],
    ["dir/a.flo", "sub/./c.flo", "dir/sub/c.flo"],
    ["dir/sub/a.flo", "../../b.flo", "b.flo"],
    ["dir/a.flo", "/b.flo", "b.flo"], // '/' inicial = raíz del workspace
    ["", "./b.flo", "b.flo"], // uri por defecto de parse()
  ])("resolves %s + %s to %s", (from, path, expected) => {
    expect(resolveUse(from, path)).toBe(expected);
  });

  it.each([
    ["a.flo", "../b.flo"],
    ["dir/a.flo", "../../b.flo"],
    ["a.flo", ""],
    ["a.flo", "./"],
  ])("returns null for %s + %s (outside the root or empty)", (from, path) => {
    expect(resolveUse(from, path)).toBeNull();
  });
});

describe("shared uri helpers (#54)", () => {
  it("parses a BlockId back into uri and name", () => {
    expect(parseBlockId(blockId("kb/a.flo", "login"))).toEqual({ uri: "kb/a.flo", name: "login" });
    expect(parseBlockId("#mapa")).toEqual({ uri: "", name: "mapa" });
  });

  it("knows which uris are workspace documents and which are ignored", () => {
    expect(["a.flo", "kb/b.md", "knowledge.schema.yaml"].map(isDocumentUri)).toEqual([true, true, true]);
    expect(["a.txt", "kb/knowledge.schema.yaml"].map(isDocumentUri)).toEqual([false, false]);
    expect(["node_modules/x.md", "a/.git/b.flo", "gitx/a.flo"].map(isIgnoredUri)).toEqual([true, true, false]);
  });
});
