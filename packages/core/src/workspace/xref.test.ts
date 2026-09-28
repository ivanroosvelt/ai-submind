import { describe, it, expect } from "vitest";
import { parseDocument } from "../parser/document.js";
import { linkDocuments } from "./resolver.js";
import { XRefIndex, blockId } from "./xref.js";

function index(files: Record<string, string>): XRefIndex {
  const documents = Object.entries(files).map(([uri, source]) => parseDocument(source, uri).document);
  const { entities } = linkDocuments(documents);
  return new XRefIndex(documents, entities);
}

const files = {
  "catalog.flo": "entity api\nentity db\nentity cache\n",
  "login.flo": [
    'use "./catalog.flo"',
    "flow login {",
    "  api -> db",
    "  db -> api",
    "}",
    "sequence detalle {",
    "  api -> cache : get",
    "  api -> ghost : x",
    "}",
    "",
  ].join("\n"),
  "admin.flo": 'use "./catalog.flo"\nflow admin {\n  api -> db\n}\n',
};

describe("XRefIndex", () => {
  const xref = index(files);

  it("builds block ids as uri#name", () => {
    expect(blockId("dir/a.flo", "login")).toBe("dir/a.flo#login");
  });

  it("finds the definition of an entity, or null", () => {
    expect(xref.definitionOf("db")).toEqual({
      uri: "catalog.flo",
      range: { start: { line: 2, column: 8 }, end: { line: 2, column: 10 } },
    });
    expect(xref.definitionOf("ghost")).toBeNull();
  });

  it("lists every resolved reference, documents by uri then source order", () => {
    expect(xref.referencesTo("db").map((l) => [l.uri, l.range.start.line, l.range.start.column])).toEqual([
      ["admin.flo", 3, 10],
      ["login.flo", 3, 10],
      ["login.flo", 4, 3],
    ]);
    expect(xref.referencesTo("ghost")).toEqual([]);
  });

  it("lists the blocks that use an entity, flow and sequence alike", () => {
    expect(xref.flowsUsing("api")).toEqual(["admin.flo#admin", "login.flo#login", "login.flo#detalle"]);
    expect(xref.flowsUsing("cache")).toEqual(["login.flo#detalle"]);
    expect(xref.flowsUsing("nadie")).toEqual([]);
  });

  it("lists the resolved entities of a block in catalog order", () => {
    expect(xref.entitiesIn("login.flo#detalle")).toEqual(["api", "cache"]);
    expect(xref.entitiesIn("login.flo#login")).toEqual(["api", "db"]);
    expect(xref.entitiesIn("nope.flo#x")).toEqual([]);
  });

  it("lists neighbors across all blocks, in catalog order, without the entity itself", () => {
    expect(xref.neighbors("api")).toEqual(["db", "cache"]);
    expect(xref.neighbors("cache")).toEqual(["api"]);
    expect(index({ "a.flo": "entity a\nflow f {\n  a -> a\n}\n" }).neighbors("a")).toEqual([]);
  });

  it("keeps the first of two same-named blocks for block queries, but counts every reference", () => {
    const dup = index({ "dup.flo": "entity a\nentity b\nflow f {\n  a -> a\n}\nflow f {\n  b -> a\n}\n" });
    expect(dup.entitiesIn("dup.flo#f")).toEqual(["a"]);
    expect(dup.flowsUsing("b")).toEqual([]);
    expect(dup.referencesTo("b")).toHaveLength(1);
    expect(dup.neighbors("a")).toEqual(["b"]);
  });
});
