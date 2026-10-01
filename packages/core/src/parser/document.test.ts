import { describe, it, expect } from "vitest";
import { parseDocument } from "./document.js";
import { parse } from "./index.js";

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

  it("ignores a leading BOM, keeping the editor's columns on line 1", () => {
    const { document, diagnostics } = parseDocument("\uFEFFentity a\nflow f {\n  a -> a\n}\n", "x.flo");
    expect(diagnostics).toEqual([]);
    expect(document.entities[0].nameRange.start).toEqual({ line: 1, column: 8 });
  });

  it("reports a line-1 error at the column the editor shows when there is a BOM", () => {
    const { diagnostics } = parseDocument("\uFEFFnope\n", "x.flo");
    expect(diagnostics[0].range.start).toEqual({ line: 1, column: 1 });
  });

  it("accepts an empty document and a catalog-only document with no diagnostics", () => {
    expect(parseDocument("", "a.flo")).toEqual({
      document: { uri: "a.flo", uses: [], entities: [], blocks: [] },
      diagnostics: [],
    });
    expect(parseDocument("\n// solo comentarios\n\n", "a.flo").diagnostics).toEqual([]);
    expect(parseDocument("entity a\nentity b\n", "a.flo").document.entities).toHaveLength(2);
  });

  it("reports E040 for an unknown top-level line and resumes at the next statement", () => {
    const { document, diagnostics } = parseDocument('import "./catalog.flo"\nentity a\n', "a.flo");
    expect(diagnostics.map((d) => d.code)).toEqual(["E040"]);
    expect(diagnostics[0].message).toBe("se esperaba 'entity', 'flow', 'sequence' o 'use', se encontró 'import'");
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

  describe("recuperación de un '}' faltante o un cuerpo en una línea", () => {
    it("una línea 'flow'/'sequence' sin '->' cierra el bloque anterior con E052, sin arrastrar el resto", () => {
      const source = "entity a\nentity b\nflow one {\n  a -> b\nsequence two {\n  a -> b : hi\n}\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics.map((d) => d.code)).toEqual(["E052"]);
      expect(diagnostics[0].range.start).toEqual({ line: 3, column: 10 });
      expect(document.blocks.map((b) => [b.name, b.edges.length])).toEqual([
        ["one", 1],
        ["two", 1],
      ]);
    });

    it("una línea 'entity' sin '->' cierra el bloque anterior con E052; las entidades siguientes se declaran igual", () => {
      const source = "flow a {\n  x -> y\nentity x\nentity y\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics.map((d) => d.code)).toEqual(["E052"]);
      expect(document.entities.map((e) => e.id)).toEqual(["x", "y"]);
      expect(document.blocks[0].edges[0].from.target).toBe("x");
    });

    it("una línea 'flow' sin '->' dentro de un cuerpo de entidad lo cierra con E045", () => {
      const source = "entity w {\n  type: s\nflow f {\n  w -> w\n}\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics.map((d) => d.code)).toEqual(["E045"]);
      expect(document.entities[0]).toMatchObject({ id: "w", type: "s" });
      expect(document.blocks[0].edges).toHaveLength(1);
    });

    it("'{}' es un bloque vacío sin diagnósticos", () => {
      const source = "entity x\nflow a {}\nflow b {\n  x -> x\n}\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics).toEqual([]);
      expect(document.blocks.map((b) => b.edges.length)).toEqual([0, 1]);
    });

    it("un bloque en una sola línea reporta un solo E016 y sigue con el resto del documento", () => {
      const source = "entity x\nflow a { x -> x }\nflow b {\n  x -> x\n}\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
      expect(document.blocks).toHaveLength(2);
    });

    it("un cuerpo de entidad en una sola línea reporta un solo E016 y sigue con el resto del documento", () => {
      const source = "entity x [X] { type: a }\nflow f {\n  x -> x\n}\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
      expect(document.entities.map((e) => e.id)).toEqual(["x"]);
      expect(document.blocks[0].edges).toHaveLength(1);
    });

    it("un bloque en una sola línea con comentario final reporta un solo E016 (#50)", () => {
      const source = "entity x\nflow a { x -> x } // comentario\nflow b {\n  x -> x\n}\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
      expect(document.blocks.map((b) => b.name)).toEqual(["a", "b"]);
    });

    it("un cuerpo de entidad en una sola línea con comentario final reporta un solo E016 (#50)", () => {
      const source = "entity x [X] { type: a } // c\nflow f {\n  x -> x\n}\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
      expect(document.blocks[0].edges).toHaveLength(1);
    });

    it("cierra en la primera '}' seguida solo de un comentario, aunque haya otras antes o dentro de la etiqueta", () => {
      for (const line of [
        "flow a { x -> x : a } b } // c",
        "flow a { x -> x : ver http://h }",
        "flow a { x -> x : ver http://h } // c",
        "flow a { x -> x } // c\r",
      ]) {
        const { diagnostics } = parse(`entity x\n${line}\nentity y\n`);
        expect(diagnostics.map((d) => d.code), JSON.stringify(line)).toEqual(["E016"]);
      }
    });

    it("'entity e {}' es un cuerpo vacío sin diagnósticos", () => {
      const { diagnostics } = parse("entity e {}\n");
      expect(diagnostics).toEqual([]);
    });
  });

  describe("use", () => {
    it("parses 'use \"path\"' into document.uses with the path and its ranges", () => {
      const { document, diagnostics } = parseDocument('use "./catalog.flo"\nentity a\n', "a.flo");
      expect(diagnostics).toEqual([]);
      expect(document.uses).toEqual([
        {
          path: "./catalog.flo",
          range: { start: { line: 1, column: 1 }, end: { line: 1, column: 20 } },
          pathRange: { start: { line: 1, column: 5 }, end: { line: 1, column: 20 } },
        },
      ]);
    });

    it("accepts use anywhere at top level, in any order with entities and blocks", () => {
      const source = 'entity a\nflow f {\n  a -> a\n}\nuse "./b.flo"\nuse "../c.flo"\n';
      const { document, diagnostics } = parseDocument(source, "dir/a.flo");
      expect(diagnostics).toEqual([]);
      expect(document.uses.map((u) => u.path)).toEqual(["./b.flo", "../c.flo"]);
    });

    it("reports E046 when use is not followed by a quoted path, and resumes at the next line", () => {
      const { document, diagnostics } = parseDocument("use catalog.flo\nuse\nentity a\n", "a.flo");
      expect(diagnostics.map((d) => [d.code, d.range.start.line, d.range.start.column])).toEqual([
        ["E046", 1, 5],
        ["E046", 2, 4],
      ]);
      expect(diagnostics[0].message).toBe("se esperaba la ruta entre comillas después de 'use'");
      expect(document.uses).toEqual([]);
      expect(document.entities).toHaveLength(1);
    });

    it("reports E016 for content after the path", () => {
      const { document, diagnostics } = parseDocument('use "./b.flo" extra\n', "a.flo");
      expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
      expect(document.uses).toHaveLength(1);
    });

    it("treats 'use' as a plain identifier inside a block edge", () => {
      const { document, diagnostics } = parseDocument("flow f {\n  use -> a\n}\n", "a.flo");
      expect(diagnostics).toEqual([]);
      expect(document.uses).toEqual([]);
      expect(document.blocks[0].edges[0].from.name).toBe("use");
    });

    it("a 'use' line inside an unclosed block or entity body closes it (E052/E045) and is parsed as top level", () => {
      const block = parseDocument('flow f {\n  a -> b\nuse "./x.flo"\n', "a.flo");
      expect(block.diagnostics.map((d) => d.code)).toEqual(["E052"]);
      expect(block.document.uses.map((u) => u.path)).toEqual(["./x.flo"]);

      const entity = parseDocument('entity a {\n  type: t\nuse "./x.flo"\n', "a.flo");
      expect(entity.diagnostics.map((d) => d.code)).toEqual(["E045"]);
      expect(entity.document.uses.map((u) => u.path)).toEqual(["./x.flo"]);
    });
  });
});
