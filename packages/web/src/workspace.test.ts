import { describe, it, expect } from "vitest";
import { EditorWorkspace, type WorkspaceSnapshot } from "./workspace.js";

const snapshot = (): WorkspaceSnapshot => ({
  files: { "b.flo": 'use "./a.flo"\nflow f {\n  x -> y\n}\n', "a.flo": "entity x\nentity y\n" },
  saved: { "a.flo": "entity x\nentity y\n" },
  active: "b.flo",
  dir: null,
  local: false,
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

  it("counts never-saved files of an open folder as unsaved changes", () => {
    const ws = new EditorWorkspace({ ...snapshot(), dir: {} as FileSystemDirectoryHandle });
    expect(ws.hasUnsavedChanges()).toBe(true); // b.flo vive en la carpeta pero nunca se guardó
    ws.markSaved("b.flo");
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

describe("modo carpeta local", () => {
  const snapshot = (files: Record<string, string>, saved = files) => ({ files, saved, active: Object.keys(files)[0], dir: null, local: true });

  it("hasFolder y isUnsaved tratan lo local como carpeta", () => {
    const ws = new EditorWorkspace(snapshot({ "a.flo": "entity a\n" }, {}));
    expect(ws.hasFolder()).toBe(true);
    expect(ws.isUnsaved("a.flo")).toBe(true);
  });

  it("applyDisk actualiza los archivos limpios, agrega los nuevos y quita los borrados", () => {
    const ws = new EditorWorkspace(snapshot({ "a.flo": "entity a\n", "b.flo": "entity b\n", "c.flo": "entity c\n" }));
    const result = ws.applyDisk({ "a.flo": "entity a2\n", "c.flo": "entity c\n", "d.md": "# d\n" });
    expect(result).toEqual({ changed: ["a.flo", "b.flo", "d.md"], conflicts: [] });
    expect(ws.uris()).toEqual(["a.flo", "c.flo", "d.md"]);
    expect(ws.source("a.flo")).toBe("entity a2\n");
    expect(ws.isDirty("a.flo")).toBe(false);
    expect(ws.isDirty("d.md")).toBe(false);
  });

  it("un archivo modificado en el editor no se pisa: es un conflicto", () => {
    const ws = new EditorWorkspace(snapshot({ "a.flo": "entity a\n" }));
    ws.setSource("a.flo", "entity mio\n");
    const result = ws.applyDisk({ "a.flo": "entity agente\n" });
    expect(result).toEqual({ changed: [], conflicts: ["a.flo"] });
    expect(ws.source("a.flo")).toBe("entity mio\n");
    // El disco es lo guardado: guardar después pisa lo del agente a sabiendas.
    expect(ws.isDirty("a.flo")).toBe(true);
  });

  it("un archivo modificado que se borró del disco se conserva sin marca de guardado", () => {
    const ws = new EditorWorkspace(snapshot({ "a.flo": "entity a\n" }));
    ws.setSource("a.flo", "entity mio\n");
    expect(ws.applyDisk({})).toEqual({ changed: [], conflicts: ["a.flo"] });
    expect(ws.uris()).toEqual(["a.flo"]);
  });

  it("si el disco ya tiene el texto del editor no hay conflicto: queda guardado", () => {
    const ws = new EditorWorkspace(snapshot({ "a.flo": "entity a\n" }));
    ws.setSource("a.flo", "entity mio\n");
    expect(ws.applyDisk({ "a.flo": "entity mio\n" })).toEqual({ changed: [], conflicts: [] });
    expect(ws.isDirty("a.flo")).toBe(false);
  });

  it("un archivo nuevo sin guardar en el editor no se borra porque no esté en disco", () => {
    const ws = new EditorWorkspace(snapshot({ "a.flo": "entity a\n" }));
    ws.setSource("nuevo.flo", "entity n\n");
    expect(ws.applyDisk({ "a.flo": "entity a\n" })).toEqual({ changed: [], conflicts: [] });
    expect(ws.uris()).toContain("nuevo.flo");
  });
});
