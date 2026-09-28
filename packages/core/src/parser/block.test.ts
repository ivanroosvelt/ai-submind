import { describe, it, expect } from "vitest";
import { Lexer } from "../lexer.js";
import { TokenCursor } from "./cursor.js";
import { parseBlock } from "./block.js";
import type { Diagnostic } from "../diagnostics.js";

function parseBlockSource(source: string) {
  const lexer = new Lexer(source);
  const cursor = new TokenCursor(lexer);
  const diagnostics: Diagnostic[] = [];
  const block = parseBlock(cursor, diagnostics);
  diagnostics.push(...lexer.diagnostics);
  return { block, diagnostics };
}

describe("parseBlock", () => {
  it("parses a titled flow block with exact ranges", () => {
    const { block, diagnostics } = parseBlockSource(
      'flow login "Inicio de sesión" {\n  User -> Api : POST /login\n}\n'
    );
    expect(diagnostics).toEqual([]);
    expect(block).toEqual({
      kind: "flow",
      name: "login",
      title: "Inicio de sesión",
      nameRange: { start: { line: 1, column: 6 }, end: { line: 1, column: 11 } },
      range: { start: { line: 1, column: 1 }, end: { line: 3, column: 2 } },
      edges: [
        {
          from: { name: "User", target: null, range: { start: { line: 2, column: 3 }, end: { line: 2, column: 7 } } },
          to: { name: "Api", target: null, range: { start: { line: 2, column: 11 }, end: { line: 2, column: 14 } } },
          label: "POST /login",
          range: { start: { line: 2, column: 3 }, end: { line: 2, column: 28 } },
        },
      ],
    });
  });

  it("parses an untitled block, blank lines and comments inside the body", () => {
    const { block, diagnostics } = parseBlockSource("sequence s {\n\n  // nota\n  a -> b : hola\n}\n");
    expect(diagnostics).toEqual([]);
    expect(block?.kind).toBe("sequence");
    expect(block?.title).toBeNull();
    expect(block?.edges.map((e) => [e.from.name, e.to.name, e.label])).toEqual([["a", "b", "hola"]]);
  });

  it("treats a flow edge with a colon and no text as label: null, with no diagnostic", () => {
    const { block, diagnostics } = parseBlockSource("flow f {\n  a -> b :\n}\n");
    expect(diagnostics).toEqual([]);
    expect(block?.edges[0].label).toBeNull();
  });

  it("requires a message label in sequence blocks (E026 without ':', E027 with an empty one)", () => {
    const { block, diagnostics } = parseBlockSource("sequence s {\n  a -> b\n  a -> b :\n  a -> b : ok\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E026", "E027"]);
    expect(block?.edges).toHaveLength(1);
  });

  it("reports E052 at the opening brace when the block is never closed, keeping the parsed edges", () => {
    const { block, diagnostics } = parseBlockSource("flow f {\n  a -> b\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E052"]);
    expect(diagnostics[0].range.start).toEqual({ line: 1, column: 8 });
    expect(block?.edges).toHaveLength(1);
  });

  it("reports E050 for a missing block name and E051 for a missing '{'", () => {
    expect(parseBlockSource("flow {\n}\n").diagnostics.map((d) => d.code)).toEqual(["E050"]);
    expect(parseBlockSource("flow f\n").diagnostics.map((d) => d.code)).toEqual(["E051"]);
    expect(parseBlockSource('flow f "t" x {\n}\n').diagnostics.map((d) => d.code)).toEqual(["E051"]);
  });

  it("reports E010, E024 and E014 for malformed edge lines and keeps parsing the next ones", () => {
    const { block, diagnostics } = parseBlockSource('flow f {\n  "x" -> b\n  a b\n  a ->\n  a -> c\n}\n');
    expect(diagnostics.map((d) => d.code)).toEqual(["E010", "E024", "E014"]);
    expect(diagnostics[0].message).toContain('"x"');
    expect(block?.edges.map((e) => e.to.name)).toEqual(["c"]);
  });

  it("reports E016 for trailing content after an edge, after '{' and after '}'", () => {
    const { diagnostics } = parseBlockSource("flow f { x\n  a -> b c\n} y\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E016", "E016", "E016"]);
  });

  it("does not report spurious E002s for raw characters skipped during line recovery", () => {
    const { diagnostics } = parseBlockSource("flow f {\n  a b[¿Qué?]\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E024"]);
  });

  it("treats 'flow', 'sequence' and 'entity' as plain identifiers inside a body", () => {
    const { block, diagnostics } = parseBlockSource("flow f {\n  flow -> entity\n}\n");
    expect(diagnostics).toEqual([]);
    expect(block?.edges[0].from.name).toBe("flow");
  });
});
