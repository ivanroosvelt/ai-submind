import { describe, it, expect } from "vitest";
import { tokenize } from "./lexer.js";

function kinds(source: string): string[] {
  return tokenize(source).tokens.map((t) => t.kind);
}

describe("tokenize", () => {
  it("tokenizes an identifier and a bracketed node label", () => {
    const { tokens, diagnostics } = tokenize("start[Inicio]\n");
    expect(diagnostics).toEqual([]);
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ["IDENT", "start"],
      ["LBRACKET", "["],
      ["TEXT", "Inicio"],
      ["RBRACKET", "]"],
      ["NEWLINE", "\n"],
      ["EOF", ""],
    ]);
  });

  it("tokenizes rounded and decision shapes", () => {
    expect(kinds("a(Rounded)\n")).toEqual([
      "IDENT", "LPAREN", "TEXT", "RPAREN", "NEWLINE", "EOF",
    ]);
    expect(kinds("b{Decision}\n")).toEqual([
      "IDENT", "LBRACE", "TEXT", "RBRACE", "NEWLINE", "EOF",
    ]);
  });

  it("tokenizes an arrow and a colon-label running to end of line", () => {
    const { tokens } = tokenize("a -> b : hola mundo\n");
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ["IDENT", "a"],
      ["ARROW", "->"],
      ["IDENT", "b"],
      ["COLON", ":"],
      ["TEXT", "hola mundo"],
      ["NEWLINE", "\n"],
      ["EOF", ""],
    ]);
  });

  it("treats 'as' as a contextual keyword that reads the rest of the line as text", () => {
    const { tokens } = tokenize("participant db as Base de datos\n");
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ["IDENT", "participant"],
      ["IDENT", "db"],
      ["IDENT", "as"],
      ["TEXT", "Base de datos"],
      ["NEWLINE", "\n"],
      ["EOF", ""],
    ]);
  });

  it("strips line comments without emitting a token", () => {
    expect(kinds("a[X] // comentario\n")).toEqual([
      "IDENT", "LBRACKET", "TEXT", "RBRACKET", "NEWLINE", "EOF",
    ]);
  });

  it("reports E001 when a bracket is not closed before the newline", () => {
    const { diagnostics } = tokenize("broken[sin cerrar\n");
    expect(diagnostics).toEqual([
      {
        code: "E001",
        message: "se esperaba ']' antes de fin de línea",
        range: { start: { line: 1, column: 7 }, end: { line: 1, column: 18 } },
        severity: "error",
      },
    ]);
  });

  it("reports E002 for an unexpected character and keeps lexing", () => {
    const { tokens, diagnostics } = tokenize("1bad[X]\n");
    expect(diagnostics).toEqual([
      {
        code: "E002",
        message: "carácter inesperado '1'",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
        severity: "error",
      },
    ]);
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ["IDENT", "bad"],
      ["LBRACKET", "["],
      ["TEXT", "X"],
      ["RBRACKET", "]"],
      ["NEWLINE", "\n"],
      ["EOF", ""],
    ]);
  });

  it("gives each token a range covering its full span", () => {
    const { tokens } = tokenize("start -> check\n");
    expect(tokens[0].range).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 6 },
    });
    expect(tokens[1].range).toEqual({
      start: { line: 1, column: 7 },
      end: { line: 1, column: 9 },
    });
  });

  it("ranges a TEXT token over the source span, not the trimmed value", () => {
    const { tokens } = tokenize("start[  Inicio  ]\n");
    const text = tokens.find((t) => t.kind === "TEXT")!;
    expect(text.value).toBe("Inicio");
    expect(text.range).toEqual({
      start: { line: 1, column: 7 },
      end: { line: 1, column: 17 },
    });
  });
});
