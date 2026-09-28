import { describe, it, expect } from "vitest";
import { resolveUse } from "./uri.js";

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
