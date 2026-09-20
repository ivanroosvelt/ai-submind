import { describe, it, expect } from "vitest";
import { Text } from "@codemirror/state";
import { parse } from "@flo/core";
import { toLintDiagnostics } from "./flo-lint.js";

describe("toLintDiagnostics", () => {
  it("maps each diagnostic's range to a document offset range", () => {
    const source = "start[sin cerrar\n";
    const { diagnostics } = parse(source);
    const doc = Text.of(source.split("\n"));

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
