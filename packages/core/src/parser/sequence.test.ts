import { describe, it, expect } from "vitest";
import { tokenize } from "../lexer";
import { parseSequenceBody } from "./sequence";
import type { Diagnostic } from "../diagnostics";

function parseBody(source: string) {
  const { tokens, diagnostics: lexDiagnostics } = tokenize(source);
  const diagnostics: Diagnostic[] = [...lexDiagnostics];
  const diagram = parseSequenceBody(tokens, diagnostics);
  return { diagram, diagnostics };
}

describe("parseSequenceBody", () => {
  it("parses participants with and without alias", () => {
    const { diagram, diagnostics } = parseBody(
      "participant user as Usuario\nparticipant api\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.participants).toEqual([
      { id: "user", label: "Usuario", position: { line: 1, column: 13 } },
      { id: "api", label: "api", position: { line: 2, column: 13 } },
    ]);
  });

  it("parses messages between declared participants", () => {
    const { diagram, diagnostics } = parseBody(
      "participant user as Usuario\nparticipant api as API\nuser -> api : POST /login\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.messages).toEqual([
      { from: "user", to: "api", label: "POST /login", position: { line: 3, column: 1 } },
    ]);
  });

  it("auto-declares a participant used in a message before any explicit declaration", () => {
    const { diagram, diagnostics } = parseBody("a -> b : hola\n");
    expect(diagnostics).toEqual([]);
    expect(diagram.participants).toEqual([
      { id: "a", label: "a", position: { line: 1, column: 1 } },
      { id: "b", label: "b", position: { line: 1, column: 6 } },
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
});
