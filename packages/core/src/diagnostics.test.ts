import { describe, it, expect } from "vitest";
import { formatDiagnostic, type Diagnostic } from "./diagnostics.js";

describe("formatDiagnostic", () => {
  it("formats an error diagnostic with code, position and message", () => {
    const diagnostic: Diagnostic = {
      code: "E001",
      message: "se esperaba ']' antes de fin de línea",
      line: 3,
      column: 12,
      severity: "error",
    };
    expect(formatDiagnostic(diagnostic)).toBe(
      "E001 error [3:12]: se esperaba ']' antes de fin de línea"
    );
  });

  it("formats a warning diagnostic", () => {
    const diagnostic: Diagnostic = {
      code: "W001",
      message: "nodo declarado pero nunca usado en una arista",
      line: 1,
      column: 1,
      severity: "warning",
    };
    expect(formatDiagnostic(diagnostic)).toBe(
      "W001 warning [1:1]: nodo declarado pero nunca usado en una arista"
    );
  });
});
