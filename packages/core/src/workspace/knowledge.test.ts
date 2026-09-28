import { describe, it, expect } from "vitest";
import { relationPath } from "./knowledge.js";

describe("relationPath", () => {
  it("tells paths from entity ids (spec §3.2)", () => {
    expect(relationPath("api")).toBeNull();
    expect(relationPath("#acceso")).toBeNull();
    expect(relationPath("../br/passwords.md")).toEqual({ path: "../br/passwords.md", block: null });
    expect(relationPath("auth.flo#acceso")).toEqual({ path: "auth.flo", block: "acceso" });
    expect(relationPath("dir/x")).toEqual({ path: "dir/x", block: null });
    expect(relationPath("notas.md")).toEqual({ path: "notas.md", block: null });
  });
});
