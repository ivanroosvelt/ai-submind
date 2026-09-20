import { describe, it, expect } from "vitest";
import { tokenize, Lexer } from "./lexer.js";

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

describe("Lexer", () => {
  it("does not enter text mode on '{' by itself", () => {
    const lexer = new Lexer("flow login {");
    expect(lexer.next().kind).toBe("IDENT"); // flow
    expect(lexer.next().kind).toBe("IDENT"); // login
    expect(lexer.next().kind).toBe("LBRACE");
    expect(lexer.next().kind).toBe("EOF"); // el cuerpo NO fue tragado
  });

  it("treats 'as' as an ordinary identifier", () => {
    const lexer = new Lexer("participant user as Usuario");
    expect(lexer.next().value).toBe("participant");
    expect(lexer.next().value).toBe("user");
    expect(lexer.next().value).toBe("as");
    expect(lexer.next().kind).toBe("IDENT"); // Usuario, no TEXT
  });

  it("reads text on demand until the requested closer", () => {
    const lexer = new Lexer("start[  Inicio  ]");
    lexer.next(); // start
    lexer.next(); // [
    const text = lexer.readTextUntil("]");
    expect(text.value).toBe("Inicio");
    expect(lexer.next().kind).toBe("RBRACKET");
  });

  it("reports E001 when the closer is missing before end of line", () => {
    const lexer = new Lexer("start[Inicio\n");
    lexer.next();
    lexer.next();
    lexer.readTextUntil("]");
    expect(lexer.diagnostics[0].code).toBe("E001");
  });

  it("anchors E001 at the open-bracket token, not at the cursor position readTextUntil was called from", () => {
    const lexer = new Lexer("start[Inicio\n");
    lexer.next(); // start
    const lbracket = lexer.next(); // [
    lexer.readTextUntil("]");
    expect(lexer.diagnostics[0].range.start).toEqual(lbracket.range.start);
  });

  it("throws if text mode is requested while a token is buffered", () => {
    const lexer = new Lexer("start[Inicio]");
    lexer.next();
    lexer.next();
    lexer.peek(); // buffer ocupado
    expect(() => lexer.readTextUntil("]")).toThrow();
  });
});
