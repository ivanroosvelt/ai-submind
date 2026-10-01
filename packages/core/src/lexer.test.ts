import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";

describe("Lexer", () => {
  it("tokenizes identifiers, arrows, colons and brackets in code mode", () => {
    const lexer = new Lexer("start -> check : x\n");
    expect(lexer.next()).toMatchObject({ kind: "IDENT", value: "start" });
    expect(lexer.next()).toMatchObject({ kind: "ARROW", value: "->" });
    expect(lexer.next()).toMatchObject({ kind: "IDENT", value: "check" });
    expect(lexer.next()).toMatchObject({ kind: "COLON", value: ":" });
    expect(lexer.next()).toMatchObject({ kind: "IDENT", value: "x" });
    expect(lexer.next().kind).toBe("NEWLINE");
    expect(lexer.next().kind).toBe("EOF");
    expect(lexer.diagnostics).toEqual([]);
  });

  it("gives each token a range covering its full span", () => {
    const lexer = new Lexer("start -> check\n");
    const start = lexer.next();
    expect(start.range).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 6 },
    });
    const arrow = lexer.next();
    expect(arrow.range).toEqual({
      start: { line: 1, column: 7 },
      end: { line: 1, column: 9 },
    });
  });

  it("strips line comments without emitting a token", () => {
    const lexer = new Lexer("a // comentario\nb\n");
    expect(lexer.next().value).toBe("a");
    expect(lexer.next().kind).toBe("NEWLINE");
    expect(lexer.next().value).toBe("b");
  });

  it("reports E002 for an unexpected character and keeps lexing", () => {
    const lexer = new Lexer("1bad\n");
    expect(lexer.next()).toMatchObject({ kind: "IDENT", value: "bad" });
    expect(lexer.diagnostics).toEqual([
      {
        code: "E002",
        message: "carácter inesperado '1'",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
      },
    ]);
  });

  it("explains the ASCII rule when E002 is a non-ASCII letter", () => {
    const lexer = new Lexer("Café\n");
    const ident = lexer.next();
    expect(ident).toMatchObject({ kind: "IDENT", value: "Caf" });
    expect(ident.range.end).toEqual({ line: 1, column: 4 });
    expect(lexer.diagnostics.map((d) => d.message)).toEqual([
      "carácter inesperado 'é': los ids solo admiten letras ASCII, dígitos y '_'",
    ]);
  });

  it("does not enter text mode on '{' by itself", () => {
    const lexer = new Lexer("flow login {");
    expect(lexer.next().kind).toBe("IDENT"); // flow
    expect(lexer.next().kind).toBe("IDENT"); // login
    expect(lexer.next().kind).toBe("LBRACE");
    expect(lexer.next().kind).toBe("EOF"); // el cuerpo NO fue tragado
    expect(lexer.diagnostics).toEqual([]); // tampoco emite E001 por su cuenta
  });

  it("treats 'as' as an ordinary identifier", () => {
    const lexer = new Lexer("participant user as Usuario");
    expect(lexer.next().value).toBe("participant");
    expect(lexer.next().value).toBe("user");
    expect(lexer.next().value).toBe("as");
    expect(lexer.next().kind).toBe("IDENT"); // Usuario, no TEXT
  });

  it("does not produce an implicit TEXT token after a bare colon at end of line", () => {
    const lexer = new Lexer("a :\n");
    lexer.next(); // a
    lexer.next(); // :
    expect(lexer.next().kind).toBe("NEWLINE"); // ya no hay TEXT implícito
  });

  it("reads text on demand until the requested closer", () => {
    const lexer = new Lexer("start[  Inicio  ]");
    lexer.next(); // start
    lexer.next(); // [
    const text = lexer.readTextUntil("]");
    expect(text.value).toBe("Inicio");
    expect(text.range).toEqual({
      start: { line: 1, column: 7 },
      end: { line: 1, column: 17 },
    });
    expect(lexer.next().kind).toBe("RBRACKET");
  });

  it("reads text on demand for ')' and '}' closers too", () => {
    const parenLexer = new Lexer("a(Rounded)\n");
    parenLexer.next();
    parenLexer.next();
    expect(parenLexer.readTextUntil(")").value).toBe("Rounded");
    expect(parenLexer.next().kind).toBe("RPAREN");

    const braceLexer = new Lexer("b{Decision}\n");
    braceLexer.next();
    braceLexer.next();
    expect(braceLexer.readTextUntil("}").value).toBe("Decision");
    expect(braceLexer.next().kind).toBe("RBRACE");
  });

  it("reads an explicit empty TEXT when the parser requests text right after a bare colon", () => {
    const lexer = new Lexer("a :\n");
    lexer.next(); // a
    lexer.next(); // :
    const text = lexer.readTextUntil("\n");
    expect(text.kind).toBe("TEXT");
    expect(text.value).toBe("");
  });

  it("reads text until end of line when the closer is '\\n'", () => {
    const lexer = new Lexer("a -> b : hola mundo\n");
    lexer.next(); // a
    lexer.next(); // ->
    lexer.next(); // b
    lexer.next(); // :
    const text = lexer.readTextUntil("\n");
    expect(text.value).toBe("hola mundo");
    expect(lexer.next().kind).toBe("NEWLINE");
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

  it("lexes a double-quoted string", () => {
    const lexer = new Lexer('use "./catalog.flo"');
    lexer.next();
    const str = lexer.next();
    expect(str.kind).toBe("STRING");
    expect(str.value).toBe("./catalog.flo"); // sin las comillas
    expect(str.range).toEqual({
      start: { line: 1, column: 5 },
      end: { line: 1, column: 20 }, // el range SÍ las incluye
    });
  });

  it("reports E002 for a string not closed before end of line", () => {
    const lexer = new Lexer('use "./catalog.flo\n');
    lexer.next();
    lexer.next();
    expect(lexer.diagnostics[0].code).toBe("E002");
  });

  it("tokenizes a comma as COMMA", () => {
    const lexer = new Lexer("a, b\n");
    expect(lexer.next()).toMatchObject({ kind: "IDENT", value: "a" });
    expect(lexer.next()).toMatchObject({
      kind: "COMMA",
      value: ",",
      range: { start: { line: 1, column: 2 }, end: { line: 1, column: 3 } },
    });
    expect(lexer.next()).toMatchObject({ kind: "IDENT", value: "b" });
    expect(lexer.diagnostics).toEqual([]);
  });

  it("restOfLineIsBlank looks at the raw rest of the line without consuming it", () => {
    const blank = new Lexer("{   // nota\nx");
    blank.next(); // {
    expect(blank.restOfLineIsBlank()).toBe(true);
    expect(blank.next().kind).toBe("NEWLINE");

    const text = new Lexer("{ Decisión }\n");
    text.next(); // {
    expect(text.restOfLineIsBlank()).toBe(false);
    expect(text.readTextUntil("}").value).toBe("Decisión");

    const eof = new Lexer("{");
    eof.next();
    expect(eof.restOfLineIsBlank()).toBe(true);
  });
});
