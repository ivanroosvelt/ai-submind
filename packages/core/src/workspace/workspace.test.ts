import { describe, it, expect } from "vitest";
import { Workspace } from "./workspace.js";
import type { Diagnostic } from "../diagnostics.js";

const catalog = "entity usuario (Usuario)\nentity api [API Gateway]\nentity db [Base de datos]\n";
const login = [
  'use "./catalogo.flo"',
  "entity pantalla [Login]",
  'flow acceso "Inicio de sesión" {',
  "  usuario -> pantalla",
  "  pantalla -> api : POST /login",
  "  api -> db",
  "}",
  "",
].join("\n");
const admin = 'use "../catalogo.flo"\nsequence alta {\n  usuario -> api : crear\n  api -> db : INSERT\n}\n';

function workspace(files: Record<string, string>): Workspace {
  const ws = new Workspace();
  for (const [uri, source] of Object.entries(files)) ws.setDocument(uri, source);
  return ws;
}

function codes(diagnostics: Diagnostic[] | undefined) {
  return (diagnostics ?? []).map((d) => [d.code, d.range.start.line, d.range.start.column]);
}

describe("Workspace", () => {
  const files = { "catalogo.flo": catalog, "login.flo": login, "admin/alta.flo": admin };

  it("links a set of documents that share a catalog", () => {
    const result = workspace(files).link();
    for (const list of result.diagnostics.values()) expect(list).toEqual([]);
    expect([...result.documents.keys()]).toEqual(["admin/alta.flo", "catalogo.flo", "login.flo"]);
    expect([...result.documents.get("login.flo")!.catalog.keys()]).toEqual(["usuario", "api", "db", "pantalla"]);
    expect([...result.documents.get("admin/alta.flo")!.catalog.keys()]).toEqual(["usuario", "api", "db"]);
    expect(result.xref.flowsUsing("db")).toEqual(["admin/alta.flo#alta", "login.flo#acceso"]);
    expect(result.xref.definitionOf("api")?.uri).toBe("catalogo.flo");
    expect(result.xref.referencesTo("usuario")).toHaveLength(2);
  });

  it("does not depend on the order documents were added", () => {
    const forward = workspace(files).link();
    const backward = workspace(Object.fromEntries(Object.entries(files).reverse())).link();
    expect([...backward.documents.keys()]).toEqual([...forward.documents.keys()]);
    expect([...backward.entities.keys()]).toEqual([...forward.entities.keys()]);
    expect([...backward.diagnostics.entries()]).toEqual([...forward.diagnostics.entries()]);
  });

  it("merges lexer, parser and resolver diagnostics per document, sorted by position", () => {
    const result = workspace({ "a.flo": 'use "./nope.flo"\nflow f {\n  a -> ghost\n  start ->\n}\n@\nentity a\n' }).link();
    expect(codes(result.diagnostics.get("a.flo"))).toEqual([
      ["E032", 1, 5],
      ["E030", 3, 8],
      ["E014", 4, 11],
      ["E002", 6, 1],
    ]);
  });

  it("reports E032 and E030 in the next link after a used document is removed", () => {
    const ws = workspace(files);
    ws.removeDocument("catalogo.flo");
    const result = ws.link();
    expect(result.documents.has("catalogo.flo")).toBe(false);
    expect(codes(result.diagnostics.get("login.flo"))).toEqual([
      ["E032", 1, 5],
      ["E030", 4, 3],
      ["E030", 5, 15],
      ["E030", 6, 3],
      ["E030", 6, 10],
    ]);
    expect(result.xref.definitionOf("db")).toBeNull();
  });

  it("re-links from scratch after setDocument replaces a document: stale targets are cleared", () => {
    const ws = workspace(files);
    const before = ws.link().documents.get("login.flo")!.document.blocks[0].edges[2];
    expect(before.to.target).toBe("db");

    ws.setDocument("catalogo.flo", "entity usuario (Usuario)\nentity api [API Gateway]\n");
    const result = ws.link();
    const after = result.documents.get("login.flo")!.document.blocks[0].edges[2];
    expect(after.to.target).toBeNull();
    expect(result.diagnostics.get("login.flo")!.map((d) => d.code)).toEqual(["E030"]);
    expect(result.xref.flowsUsing("db")).toEqual([]);
  });
});
