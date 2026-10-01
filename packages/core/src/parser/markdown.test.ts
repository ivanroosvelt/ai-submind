import { describe, it, expect } from "vitest";
import { parseMarkdownDocument } from "./markdown.js";
import type { Diagnostic } from "../diagnostics.js";

const DECISION = [
  "---", // 1
  "id: decision_auth", // 2
  'title: "Decisión: OAuth2 + PKCE"', // 3
  "memory_type: long_term", // 4
  "type_tags: [decision, architecture]", // 5
  'context_tags: ["project:core"]', // 6
  "custom_tags:", // 7
  "  status: approved", // 8
  "  level: 3", // 9
  'use: ["../catalogo.flo"]', // 10
  "relations:", // 11
  "  - target: api", // 12
  "    type: affects", // 13
  "---", // 14
  "", // 15
  "# Decisión", // 16
  "",
].join("\n");

const r = (sl: number, sc: number, el: number, ec: number) => ({
  start: { line: sl, column: sc },
  end: { line: el, column: ec },
});

function codes(diagnostics: Diagnostic[]) {
  return diagnostics.map((d) => [d.code, d.range.start.line]);
}

describe("parseMarkdownDocument: frontmatter", () => {
  it("turns a valid frontmatter into a catalog entity with exact ranges", () => {
    const result = parseMarkdownDocument(DECISION, "decisiones/auth.md")!;
    expect(result.diagnostics).toEqual([]);
    expect(result.document.uses).toEqual([
      { path: "../catalogo.flo", range: r(10, 7, 10, 24), pathRange: r(10, 7, 10, 24) },
    ]);
    expect(result.document.entities).toEqual([
      {
        id: "decision_auth",
        label: "Decisión: OAuth2 + PKCE",
        shape: "rectangle",
        type: null,
        tags: [],
        uri: "decisiones/auth.md",
        range: r(1, 1, 14, 4),
        nameRange: r(2, 5, 2, 18),
        knowledge: {
          memoryType: "long_term",
          typeTags: ["decision", "architecture"],
          contextTags: ["project:core"],
          customTags: { status: "approved", level: 3 },
          relations: [
            { type: "affects", target: "api", resolved: null, range: r(12, 13, 12, 16), typeRange: r(13, 11, 13, 18) },
          ],
          body: "\n# Decisión\n",
        },
      },
    ]);
    expect(result.document.blocks).toEqual([]);
  });

  it("gives the same ranges with CRLF line endings", () => {
    const crlf = parseMarkdownDocument(DECISION.replace(/\n/g, "\r\n"), "a.md")!;
    expect(crlf.diagnostics).toEqual([]);
    const entity = crlf.document.entities[0];
    expect(entity.nameRange).toEqual(r(2, 5, 2, 18));
    expect(entity.range).toEqual(r(1, 1, 14, 4));
  });

  it("strips a leading UTF-8 BOM before splitting lines", () => {
    const result = parseMarkdownDocument("﻿---\nid: a\ntitle: A\nmemory_type: working\n---\n", "a.md")!;
    expect(result).not.toBeNull();
    expect(result.document.entities[0].id).toBe("a");
    expect(result.document.entities[0].nameRange).toEqual(r(2, 5, 2, 6));
    expect(result.diagnostics).toEqual([]);
  });

  it("is not a workspace document without '---' on the first line", () => {
    expect(parseMarkdownDocument("# README\n", "README.md")).toBeNull();
    expect(parseMarkdownDocument("\n---\nid: a\n---\n", "a.md")).toBeNull();
    expect(parseMarkdownDocument("", "a.md")).toBeNull();
  });

  it("reports E060 when the frontmatter is never closed, and parses nothing else", () => {
    const result = parseMarkdownDocument("---\nid: a\ntitle: A\n\n```flo\nentity b\n```\n", "a.md")!;
    expect(result.diagnostics.map((d) => [d.code, d.range])).toEqual([["E060", r(1, 1, 1, 4)]]);
    expect(result.document.entities).toEqual([]);
    expect(result.document.blocks).toEqual([]);
  });

  it("reports one E062 per missing mandatory field on the opening delimiter", () => {
    const result = parseMarkdownDocument("---\n---\n", "a.md")!;
    expect(result.diagnostics.map((d) => [d.code, d.range, d.message])).toEqual([
      ["E062", r(1, 1, 1, 4), "falta el campo obligatorio 'id'"],
      ["E062", r(1, 1, 1, 4), "falta el campo obligatorio 'title'"],
      ["E062", r(1, 1, 1, 4), "falta el campo obligatorio 'memory_type'"],
    ]);
    expect(result.document.entities).toEqual([]);
  });

  it("reports YAML syntax errors as E061 and does not build the entity", () => {
    const result = parseMarkdownDocument("---\nid: a\nid: b\ntitle: A\nmemory_type: working\n---\n", "a.md")!;
    expect(codes(result.diagnostics)).toEqual([["E061", 3]]);
    expect(result.diagnostics[0].message).toMatch(/^error de sintaxis YAML: /);
    expect(result.document.entities).toEqual([]);
  });

  it("reports one diagnostic per invalid field without cascading", () => {
    const source = [
      "---", // 1
      "id: 9lives", // 2 E063
      'title: ""', // 3 E063
      "memory_type: forever", // 4 E064
      "type_tags: decision", // 5 E063
      'context_tags: [project, "a:b"]', // 6 E063 en 'project'
      "custom_tags: {a: [1]}", // 7 E063
      "relations:", // 8
      "  - target: api", // 9 E062 falta 'type' (rango del ítem)
      "    kind: x", // 10 E067
      "foo: 1", // 11 E067
      "---",
      "",
    ].join("\n");
    const result = parseMarkdownDocument(source, "a.md")!;
    expect(codes(result.diagnostics)).toEqual([
      ["E063", 2],
      ["E063", 3],
      ["E064", 4],
      ["E063", 5],
      ["E063", 6],
      ["E063", 7],
      ["E062", 9],
      ["E067", 10],
      ["E067", 11],
    ]);
    expect(result.document.entities).toEqual([]); // sin id válido no hay entidad
  });

  it("keeps the entity when only the id is valid: label falls back to the id, memoryType to null", () => {
    const result = parseMarkdownDocument("---\nid: a\ntitle: 3\nmemory_type: 1\n---\n", "a.md")!;
    expect(codes(result.diagnostics)).toEqual([
      ["E063", 3],
      ["E064", 4],
    ]);
    expect(result.document.entities[0]).toMatchObject({ id: "a", label: "a", knowledge: { memoryType: null } });
  });
});

describe("parseMarkdownDocument: embedded flo blocks", () => {
  const source = [
    "---", // 1
    "id: nota", // 2
    "title: Nota", // 3
    "memory_type: working", // 4
    "---", // 5
    "Texto.", // 6
    "```flo", // 7
    "entity api [API]", // 8
    "flow pkce {", // 9
    "  nota -> api", // 10
    "}", // 11
    "```", // 12
    "~~~", // 13  cerca de otro tipo: lo de adentro no es flo
    "```flo", // 14
    "entity oculto", // 15
    "~~~", // 16
    "```ts", // 17
    "entity tampoco", // 18
    "```", // 19
    "```flo", // 20
    "flow roto {", // 21  sin '}': E052 dentro de su cerca
    "  api -> nota", // 22
    "```", // 23
    "```flo extra", // 24  el info-string es la primera palabra
    "entity cola", // 25
    "```", // 26
    "",
  ].join("\n");

  it("parses each flo fence with exact ranges, after the frontmatter entity", () => {
    const { document, diagnostics } = parseMarkdownDocument(source, "notas/nota.md")!;
    expect(document.entities.map((e) => [e.id, e.uri])).toEqual([
      ["nota", "notas/nota.md"],
      ["api", "notas/nota.md"],
      ["cola", "notas/nota.md"],
    ]);
    expect(document.entities[1].nameRange).toEqual(r(8, 8, 8, 11));
    expect(document.blocks.map((b) => b.name)).toEqual(["pkce", "roto"]);
    expect(document.blocks[0].edges[0].from.range).toEqual(r(10, 3, 10, 7));
    expect(document.blocks[1].edges.map((e) => [e.from.name, e.to.name])).toEqual([["api", "nota"]]);
    expect(diagnostics.map((d) => [d.code, d.range.start.line, d.range.start.column])).toEqual([["E052", 21, 11]]);
  });

  it("runs an unclosed fence to the end of the file", () => {
    const { document, diagnostics } = parseMarkdownDocument(
      "---\nid: a\ntitle: A\nmemory_type: working\n---\n```flo\nentity z\n",
      "a.md"
    )!;
    expect(diagnostics).toEqual([]);
    expect(document.entities.map((e) => [e.id, e.nameRange.start.line])).toEqual([
      ["a", 2],
      ["z", 7],
    ]);
  });

  it("parses fences even when the frontmatter has no valid id", () => {
    const { document } = parseMarkdownDocument("---\ntitle: A\n---\n```flo\nentity z\n```\n", "a.md")!;
    expect(document.entities.map((e) => e.id)).toEqual(["z"]);
  });
});
