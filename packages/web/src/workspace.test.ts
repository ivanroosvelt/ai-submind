import { describe, it, expect } from "vitest";
import { EditorWorkspace, type WorkspaceSnapshot } from "./workspace.js";

const snapshot = (): WorkspaceSnapshot => ({
  files: { "b.flo": 'use "./a.flo"\nflow f {\n  x -> y\n}\n', "a.flo": "entity x\nentity y\n" },
  saved: { "a.flo": "entity x\nentity y\n" },
  active: "b.flo",
  dir: null,
});

describe("EditorWorkspace", () => {
  it("lists uris in order and links across documents", () => {
    const ws = new EditorWorkspace(snapshot());
    expect(ws.uris()).toEqual(["a.flo", "b.flo"]);
    expect(ws.link().diagnostics.get("b.flo")).toEqual([]);
  });

  it("relinks lazily after a change and never returns a stale result", () => {
    const ws = new EditorWorkspace(snapshot());
    const first = ws.link();
    expect(ws.link()).toBe(first);
    ws.setSource("a.flo", "entity x\n");
    const second = ws.link();
    expect(second).not.toBe(first);
    expect(second.diagnostics.get("b.flo")!.map((d) => d.code)).toEqual(["E030"]);
  });

  it("tracks dirty files against what is on disk", () => {
    const ws = new EditorWorkspace(snapshot());
    expect(ws.isDirty("a.flo")).toBe(false);
    expect(ws.isDirty("b.flo")).toBe(true); // nunca guardado
    expect(ws.hasUnsavedChanges()).toBe(false); // b.flo no está en disco
    ws.setSource("a.flo", "entity x\nentity y\nentity z\n");
    expect(ws.hasUnsavedChanges()).toBe(true);
    ws.markSaved("a.flo");
    expect(ws.isDirty("a.flo")).toBe(false);
    expect(ws.hasUnsavedChanges()).toBe(false);
  });

  it("falls back to the first uri when the active one does not exist", () => {
    expect(new EditorWorkspace({ ...snapshot(), active: "zzz.flo" }).active).toBe("a.flo");
  });

  it("round-trips through a snapshot", () => {
    const ws = new EditorWorkspace(snapshot());
    ws.setSource("c.flo", "entity c\n");
    ws.active = "c.flo";
    const copy = new EditorWorkspace(ws.snapshot());
    expect(copy.uris()).toEqual(["a.flo", "b.flo", "c.flo"]);
    expect(copy.active).toBe("c.flo");
    expect(copy.isDirty("a.flo")).toBe(false);
  });
});
