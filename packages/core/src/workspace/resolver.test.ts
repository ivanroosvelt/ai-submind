import { describe, it, expect } from "vitest";
import { parseDocument } from "../parser/document.js";
import { linkDocuments } from "./resolver.js";
import type { Diagnostic } from "../diagnostics.js";

function link(files: Record<string, string>) {
  const documents = Object.entries(files).map(([uri, source]) => parseDocument(source, uri).document);
  const byUri = new Map(documents.map((d) => [d.uri, d]));
  return { documents: byUri, ...linkDocuments(documents) };
}

function codes(diagnostics: Diagnostic[] | undefined) {
  return (diagnostics ?? []).map((d) => [d.code, d.range.start.line, d.range.start.column]);
}

describe("linkDocuments — un documento", () => {
  it("resolves references to entities declared anywhere in the document (order-independent)", () => {
    const { documents, catalogs, diagnostics } = link({ "a.flo": "flow f {\n  a -> b\n}\nentity a\nentity b\n" });
    expect(diagnostics.get("a.flo")).toEqual([]);
    expect([...catalogs.get("a.flo")!.keys()]).toEqual(["a", "b"]);
    const edge = documents.get("a.flo")!.blocks[0].edges[0];
    expect(edge.from.target).toBe("a");
    expect(edge.to.target).toBe("b");
  });

  it("reports E030 at each unresolved reference, with the fix in the message", () => {
    const { documents, diagnostics } = link({ "a.flo": "entity a\nflow f {\n  a -> Cache\n}\n" });
    expect(diagnostics.get("a.flo")).toEqual([
      {
        code: "E030",
        message: "la entidad 'Cache' no está declarada; añade 'entity Cache'",
        range: { start: { line: 3, column: 8 }, end: { line: 3, column: 13 } },
        severity: "error",
      },
    ]);
    expect(documents.get("a.flo")!.blocks[0].edges[0].to.target).toBeNull();
  });

  it("keeps the first declaration of a duplicated entity and reports E031 at the second one's name", () => {
    const { entities, diagnostics } = link({ "a.flo": "entity a [Primera]\nentity a [Segunda]\n" });
    expect(entities.get("a")?.label).toBe("Primera");
    expect(diagnostics.get("a.flo")!.map((d) => d.message)).toEqual(["la entidad 'a' ya fue declarada"]);
    expect(codes(diagnostics.get("a.flo"))).toEqual([["E031", 2, 8]]);
  });

  it("reports E033 at the name of a duplicated block, across flow and sequence", () => {
    const { diagnostics } = link({ "a.flo": "entity a\nflow x {\n  a -> a\n}\nsequence x {\n  a -> a : y\n}\n" });
    expect(codes(diagnostics.get("a.flo"))).toEqual([["E033", 5, 10]]);
  });

  it("returns diagnostics sorted by position", () => {
    const { diagnostics } = link({ "a.flo": "flow f {\n  x -> y\n}\nentity a\nentity a\n" });
    expect(codes(diagnostics.get("a.flo"))).toEqual([
      ["E030", 2, 3],
      ["E030", 2, 8],
      ["E031", 5, 8],
    ]);
  });
});

describe("linkDocuments — varios documentos", () => {
  const catalog = "entity db [Base de datos]\nentity api\n";
  const login = 'use "./catalog.flo"\nentity ui\nflow f {\n  ui -> api\n  api -> db\n}\n';

  it("resolves references through use; the reachable catalog lists dependencies first", () => {
    const { documents, catalogs, diagnostics } = link({ "catalog.flo": catalog, "login.flo": login });
    expect(diagnostics.get("login.flo")).toEqual([]);
    expect(diagnostics.get("catalog.flo")).toEqual([]);
    expect([...catalogs.get("login.flo")!.keys()]).toEqual(["db", "api", "ui"]);
    expect([...catalogs.get("catalog.flo")!.keys()]).toEqual(["db", "api"]);
    const edges = documents.get("login.flo")!.blocks[0].edges;
    expect(edges.map((e) => [e.from.target, e.to.target])).toEqual([
      ["ui", "api"],
      ["api", "db"],
    ]);
  });

  it("resolves use transitively, deepest dependency first", () => {
    const { catalogs, diagnostics } = link({
      "a.flo": 'use "./b.flo"\nentity x\nflow f {\n  x -> z\n}\n',
      "b.flo": 'use "./sub/c.flo"\nentity y\n',
      "sub/c.flo": "entity z\n",
    });
    expect(diagnostics.get("a.flo")).toEqual([]);
    expect([...catalogs.get("a.flo")!.keys()]).toEqual(["z", "y", "x"]);
  });

  it("does not see entities of documents it does not reach; E030 says where they are", () => {
    const { diagnostics } = link({
      "catalog.flo": "entity db\nflow f {\n  db -> ui\n}\n",
      "login.flo": login,
    });
    expect(diagnostics.get("catalog.flo")!.map((d) => [d.code, d.message])).toEqual([
      ["E030", "la entidad 'ui' está declarada en 'login.flo', que este documento no alcanza; añade un 'use' a ese archivo"],
    ]);
  });

  it("reports E032 at the path of a use that names a missing document or leaves the root", () => {
    const { diagnostics } = link({ "a.flo": 'use "./nope.flo"\nuse "../fuera.flo"\nentity a\n' });
    expect(codes(diagnostics.get("a.flo"))).toEqual([
      ["E032", 1, 5],
      ["E032", 2, 5],
    ]);
    expect(diagnostics.get("a.flo")![0].message).toBe("el documento './nope.flo' no existe en el workspace");
  });

  it("explains why a use path is not a document", () => {
    const messages = (path: string) =>
      link({ "dir/a.flo": `use "${path}"\n` }).diagnostics.get("dir/a.flo")!.map((d) => d.message);
    expect(messages("../../x.flo")).toEqual([
      "la ruta '../../x.flo' sale de la raíz del workspace o no nombra un documento",
    ]);
    expect(messages("../knowledge.schema.yaml")).toEqual([
      "'../knowledge.schema.yaml' es el esquema de conocimiento, no un documento del workspace",
    ]);
    expect(messages("./notas.md")).toEqual([
      "el documento './notas.md' no existe en el workspace o no es un documento (un .md necesita frontmatter con '---')",
    ]);
  });

  it("cuts cycles, self-use and repeated use without diagnostics or duplicates", () => {
    const { catalogs, uses, diagnostics } = link({
      "a.flo": 'use "./b.flo"\nuse "./b.flo"\nuse "./a.flo"\nentity x\n',
      "b.flo": 'use "./a.flo"\nentity y\n',
    });
    expect(diagnostics.get("a.flo")).toEqual([]);
    expect(diagnostics.get("b.flo")).toEqual([]);
    expect(uses.get("a.flo")).toEqual(["b.flo", "a.flo"]);
    expect([...catalogs.get("a.flo")!.keys()]).toEqual(["y", "x"]);
    expect([...catalogs.get("b.flo")!.keys()]).toEqual(["x", "y"]);
  });

  it("keeps the declaration of the first document by uri and reports E031 in the other, naming where the first is", () => {
    const { entities, diagnostics } = link({ "b.flo": "entity x [B]\n", "a.flo": "entity x [A]\n" });
    expect(entities.get("x")?.label).toBe("A");
    expect(diagnostics.get("a.flo")).toEqual([]);
    expect(diagnostics.get("b.flo")!.map((d) => [d.code, d.message])).toEqual([
      ["E031", "la entidad 'x' ya fue declarada en 'a.flo'"],
    ]);
  });

  it("gives the same result whatever the input order", () => {
    const files = {
      "catalog.flo": catalog + "entity ui\n",
      "login.flo": login,
      "admin.flo": 'use "./catalog.flo"\nflow g {\n  api -> ghost\n}\n',
    };
    const forward = link(files);
    const backward = link(Object.fromEntries(Object.entries(files).reverse()));
    expect([...backward.entities.keys()]).toEqual([...forward.entities.keys()]);
    expect([...backward.diagnostics.entries()].sort()).toEqual([...forward.diagnostics.entries()].sort());
    expect(forward.entities.get("ui")?.uri).toBe("catalog.flo");
  });
});
