import { describe, it, expect } from "vitest";
import { Lexer } from "../lexer.js";
import { parseSequenceBody } from "./sequence.js";
import type { Diagnostic } from "../diagnostics.js";

function parseBody(source: string) {
  const lexer = new Lexer(source);
  const diagnostics: Diagnostic[] = [];
  const diagram = parseSequenceBody(lexer, diagnostics);
  diagnostics.push(...lexer.diagnostics);
  return { diagram, diagnostics };
}

describe("parseSequenceBody", () => {
  it("parses participants with and without alias", () => {
    const { diagram, diagnostics } = parseBody(
      "participant user as Usuario\nparticipant api\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.participants).toEqual([
      {
        id: "user",
        label: "Usuario",
        range: { start: { line: 1, column: 13 }, end: { line: 1, column: 28 } },
        nameRange: { start: { line: 1, column: 13 }, end: { line: 1, column: 17 } },
      },
      {
        id: "api",
        label: "api",
        range: { start: { line: 2, column: 13 }, end: { line: 2, column: 16 } },
        nameRange: { start: { line: 2, column: 13 }, end: { line: 2, column: 16 } },
      },
    ]);
  });

  it("parses messages between declared participants", () => {
    const { diagram, diagnostics } = parseBody(
      "participant user as Usuario\nparticipant api as API\nuser -> api : POST /login\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.messages).toEqual([
      {
        from: "user",
        to: "api",
        label: "POST /login",
        range: { start: { line: 3, column: 1 }, end: { line: 3, column: 26 } },
        fromRange: { start: { line: 3, column: 1 }, end: { line: 3, column: 5 } },
        toRange: { start: { line: 3, column: 9 }, end: { line: 3, column: 12 } },
      },
    ]);
  });

  it("auto-declares a participant used in a message before any explicit declaration", () => {
    const { diagram, diagnostics } = parseBody("a -> b : hola\n");
    expect(diagnostics).toEqual([]);
    expect(diagram.participants).toEqual([
      {
        id: "a",
        label: "a",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
        nameRange: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
      },
      {
        id: "b",
        label: "b",
        range: { start: { line: 1, column: 6 }, end: { line: 1, column: 7 } },
        nameRange: { start: { line: 1, column: 6 }, end: { line: 1, column: 7 } },
      },
    ]);
  });

  it("reports E023 when a participant id is declared twice", () => {
    const { diagnostics } = parseBody("participant a\nparticipant a\n");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("E023");
  });

  it("reports E027 when a message is missing its text", () => {
    const { diagnostics } = parseBody("participant a\nparticipant b\na -> b :\n");
    expect(diagnostics.some((d) => d.code === "E027")).toBe(true);
  });

  it("reports E022 when 'as' is immediately followed by a newline (empty alias text)", () => {
    const { diagnostics } = parseBody("participant a as\n");
    expect(diagnostics.some((d) => d.code === "E022")).toBe(true);
  });

  it("does not report spurious E002s for raw characters skipped during line recovery", () => {
    // "a" and "b" are both valid IDENTs, but "b" isn't "->", so E024 fires
    // with "b" already lexed as a plain token. The rest of the line
    // (" ¿Qué?") must be discarded raw by skipToNextLine, not scanned as
    // code-mode tokens - otherwise "¿", "é", "?" each trip E002.
    const { diagnostics } = parseBody("a b ¿Qué?\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E024"]);
  });

  it("renders a STRING token with its quotes when it appears where an id was expected", () => {
    const { diagnostics } = parseBody('"x" -> b : hola\n');
    expect(diagnostics[0].code).toBe("E020");
    expect(diagnostics[0].message).toContain('"x"');
  });
});
