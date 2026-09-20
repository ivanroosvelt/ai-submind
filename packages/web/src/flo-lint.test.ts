import { describe, it, expect } from "vitest";
import { Text } from "@codemirror/state";
import type { Diagnostic } from "@flo/core";
import { toLintDiagnostics } from "./flo-lint.js";

describe("toLintDiagnostics", () => {
  it("maps each diagnostic's range to a document offset range", () => {
    // Diagnósticos construidos a mano (no vía parse()): toLintDiagnostics
    // es puro mapeo range->offset, y desde que el Lexer es perezoso, un
    // archivo con header inválido ya no produce diagnósticos del cuerpo
    // (el parser nunca llega a pedir ese texto) — parse() de este mismo
    // source ya no da dos diagnósticos. Lo que este test verifica es el
    // mapeo en sí sobre varios rangos, no lo que parse() decida emitir.
    const source = "start[sin cerrar\n";
    const doc = Text.of(source.split("\n"));
    const diagnostics: Diagnostic[] = [
      {
        code: "E004",
        message: "se esperaba 'diagram' al inicio del archivo",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 6 } },
        severity: "error",
      },
      {
        code: "E001",
        message: "se esperaba ']' antes de fin de línea",
        range: { start: { line: 1, column: 6 }, end: { line: 1, column: 17 } },
        severity: "error",
      },
    ];

    expect(toLintDiagnostics(diagnostics, doc)).toEqual([
      { from: 0, to: 5, severity: "error", message: "E004: se esperaba 'diagram' al inicio del archivo" },
      { from: 5, to: 16, severity: "error", message: "E001: se esperaba ']' antes de fin de línea" },
    ]);
  });

  it("clamps the range to the end of the line for a diagnostic past it", () => {
    const source = "diagram flowchart\n";
    const doc = Text.of(source.split("\n"));
    const range = { start: { line: 1, column: 999 }, end: { line: 1, column: 1000 } };

    expect(
      toLintDiagnostics([{ code: "E999", message: "x", range, severity: "warning" }], doc)
    ).toEqual([{ from: 17, to: 17, severity: "warning", message: "E999: x" }]);
  });
});
