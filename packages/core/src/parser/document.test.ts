import { describe, it, expect } from "vitest";
import { parseDocument } from "./document.js";

describe("parseDocument", () => {
  it("collects entities and blocks in source order, mixed in one file", () => {
    const source = [
      "// catálogo",
      "entity User (Usuario) type: actor",
      "",
      'flow login "Inicio de sesión" {',
      "  User -> Api : POST /login",
      "}",
      "entity Api [API Gateway]",
      "sequence detalle {",
      "  User -> Api : POST /login",
      "}",
      "",
    ].join("\n");
    const { document, diagnostics } = parseDocument(source, "login.flo");
    expect(diagnostics).toEqual([]);
    expect(document.uri).toBe("login.flo");
    expect(document.entities.map((e) => e.id)).toEqual(["User", "Api"]);
    expect(document.entities[0].uri).toBe("login.flo");
    expect(document.blocks.map((b) => [b.kind, b.name, b.title])).toEqual([
      ["flow", "login", "Inicio de sesión"],
      ["sequence", "detalle", null],
    ]);
  });

  it("accepts an empty document and a catalog-only document with no diagnostics", () => {
    expect(parseDocument("", "a.flo")).toEqual({ document: { uri: "a.flo", entities: [], blocks: [] }, diagnostics: [] });
    expect(parseDocument("\n// solo comentarios\n\n", "a.flo").diagnostics).toEqual([]);
    expect(parseDocument("entity a\nentity b\n", "a.flo").document.entities).toHaveLength(2);
  });

  it("reports E040 for an unknown top-level line and resumes at the next statement", () => {
    const { document, diagnostics } = parseDocument('use "./catalog.flo"\nentity a\n', "a.flo");
    expect(diagnostics.map((d) => d.code)).toEqual(["E040"]);
    expect(diagnostics[0].message).toBe("se esperaba 'entity', 'flow' o 'sequence', se encontró 'use'");
    expect(document.entities).toHaveLength(1);
  });

  it("reports a single E040 with a migration hint for an old 'diagram <kind>' file", () => {
    const old = ["diagram flowchart", "", "start[Inicio]", "end[Fin]", "start -> end : ok", ""].join("\n");
    const { document, diagnostics } = parseDocument(old, "viejo.flo");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: "E040", range: { start: { line: 1, column: 1 } } });
    expect(diagnostics[0].message).toContain("'diagram <tipo>' ya no existe");
    expect(document.blocks).toEqual([]);
  });

  it("does not add an E040 per orphaned body line after a block header fails", () => {
    const { diagnostics } = parseDocument("flow {\n  a -> b\n  b -> c\n}\nentity a\n", "a.flo");
    expect(diagnostics.map((d) => d.code)).toEqual(["E050"]);
  });

  it("reports a new E040 run after a valid statement ends the previous one", () => {
    const { diagnostics } = parseDocument("x\ny\nentity a\nz\n", "a.flo");
    expect(diagnostics.map((d) => [d.code, d.range.start.line])).toEqual([
      ["E040", 1],
      ["E040", 4],
    ]);
  });

  it("includes lexer diagnostics", () => {
    const { diagnostics } = parseDocument('flow f "sin cerrar {\n}\n', "a.flo");
    expect(diagnostics.map((d) => d.code)).toContain("E002");
  });
});
