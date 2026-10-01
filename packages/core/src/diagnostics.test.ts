import { describe, it, expect } from "vitest";
import { formatDiagnostic, type Diagnostic } from "./diagnostics.js";

describe("formatDiagnostic", () => {
  it("formats an error diagnostic with code, position and message", () => {
    const diagnostic: Diagnostic = {
      code: "E001",
      message: "se esperaba ']' antes de fin de línea",
      range: { start: { line: 3, column: 12 }, end: { line: 3, column: 20 } },
    };
    expect(formatDiagnostic(diagnostic)).toBe(
      "E001 error [3:12]: se esperaba ']' antes de fin de línea"
    );
  });

  it("formats a diagnostic from the start of its range", () => {
    expect(
      formatDiagnostic({
        code: "E017",
        message: "el nodo 'db' no fue declarado",
        range: { start: { line: 3, column: 1 }, end: { line: 3, column: 3 } },
      })
    ).toBe("E017 error [3:1]: el nodo 'db' no fue declarado");
  });
});
