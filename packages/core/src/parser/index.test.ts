import { describe, it, expect } from "vitest";
import { parse } from "./index.js";

describe("parse", () => {
  it("reports E003 for an empty file", () => {
    const { diagram, diagnostics } = parse("");
    expect(diagram).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("E003");
  });

  it("reports E004 when the file does not start with 'diagram'", () => {
    const { diagram, diagnostics } = parse("start[Inicio]\n");
    expect(diagram).toBeNull();
    expect(diagnostics[0].code).toBe("E004");
  });

  it("reports E005 for an unknown diagram kind", () => {
    const { diagram, diagnostics } = parse("diagram pie\n");
    expect(diagram).toBeNull();
    expect(diagnostics[0].code).toBe("E005");
  });

  it("parses a full valid flowchart end to end", () => {
    const source = [
      "diagram flowchart",
      "",
      "start[Inicio]",
      "check{Login valido}",
      "home[Mostrar home]",
      "",
      "start -> check",
      "check -> home : si",
      "",
    ].join("\n");
    const { diagram, diagnostics } = parse(source);
    expect(diagnostics).toEqual([]);
    expect(diagram).toEqual({
      kind: "flowchart",
      nodes: [
        {
          id: "start",
          shape: "rectangle",
          label: "Inicio",
          range: { start: { line: 3, column: 1 }, end: { line: 3, column: 14 } },
          nameRange: { start: { line: 3, column: 1 }, end: { line: 3, column: 6 } },
        },
        {
          id: "check",
          shape: "decision",
          label: "Login valido",
          range: { start: { line: 4, column: 1 }, end: { line: 4, column: 20 } },
          nameRange: { start: { line: 4, column: 1 }, end: { line: 4, column: 6 } },
        },
        {
          id: "home",
          shape: "rectangle",
          label: "Mostrar home",
          range: { start: { line: 5, column: 1 }, end: { line: 5, column: 19 } },
          nameRange: { start: { line: 5, column: 1 }, end: { line: 5, column: 5 } },
        },
      ],
      edges: [
        {
          from: "start",
          to: "check",
          label: null,
          range: { start: { line: 7, column: 1 }, end: { line: 7, column: 15 } },
          fromRange: { start: { line: 7, column: 1 }, end: { line: 7, column: 6 } },
          toRange: { start: { line: 7, column: 10 }, end: { line: 7, column: 15 } },
        },
        {
          from: "check",
          to: "home",
          label: "si",
          range: { start: { line: 8, column: 1 }, end: { line: 8, column: 19 } },
          fromRange: { start: { line: 8, column: 1 }, end: { line: 8, column: 6 } },
          toRange: { start: { line: 8, column: 10 }, end: { line: 8, column: 14 } },
        },
      ],
    });
  });

  it("parses a full valid sequence diagram end to end", () => {
    const source = [
      "diagram sequence",
      "",
      "participant user as Usuario",
      "participant api as API",
      "",
      "user -> api : POST /login",
      "api -> user : 200 OK",
      "",
    ].join("\n");
    const { diagram, diagnostics } = parse(source);
    expect(diagnostics).toEqual([]);
    expect(diagram).toEqual({
      kind: "sequence",
      participants: [
        {
          id: "user",
          label: "Usuario",
          range: { start: { line: 3, column: 13 }, end: { line: 3, column: 28 } },
          nameRange: { start: { line: 3, column: 13 }, end: { line: 3, column: 17 } },
        },
        {
          id: "api",
          label: "API",
          range: { start: { line: 4, column: 13 }, end: { line: 4, column: 23 } },
          nameRange: { start: { line: 4, column: 13 }, end: { line: 4, column: 16 } },
        },
      ],
      messages: [
        {
          from: "user",
          to: "api",
          label: "POST /login",
          range: { start: { line: 6, column: 1 }, end: { line: 6, column: 26 } },
          fromRange: { start: { line: 6, column: 1 }, end: { line: 6, column: 5 } },
          toRange: { start: { line: 6, column: 9 }, end: { line: 6, column: 12 } },
        },
        {
          from: "api",
          to: "user",
          label: "200 OK",
          range: { start: { line: 7, column: 1 }, end: { line: 7, column: 21 } },
          fromRange: { start: { line: 7, column: 1 }, end: { line: 7, column: 4 } },
          toRange: { start: { line: 7, column: 8 }, end: { line: 7, column: 12 } },
        },
      ],
    });
  });

  it("allows a leading comment line (reduced to a blank NEWLINE) before the header", () => {
    const source = "// title comment\ndiagram flowchart\nstart[Inicio]\n";
    const { diagram, diagnostics } = parse(source);
    expect(diagnostics).toEqual([]);
    expect(diagram).not.toBeNull();
    expect(diagram?.kind).toBe("flowchart");
  });

  it("allows one or more genuinely blank leading lines before the header", () => {
    const source = "\n\ndiagram flowchart\nstart[Inicio]\n";
    const { diagram, diagnostics } = parse(source);
    expect(diagnostics).toEqual([]);
    expect(diagram).not.toBeNull();
  });

  it("collects diagnostics from multiple invalid lines instead of stopping at the first", () => {
    const source = [
      "diagram flowchart",
      "",
      "1bad[No puede empezar con numero]",
      "start[Inicio]",
      "start ->",
      "",
    ].join("\n");
    const { diagnostics } = parse(source);
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain("E002");
    expect(codes).toContain("E014");
  });

  it("sorts diagnostics by (line, column) even though lexer diagnostics are collected before parser diagnostics", () => {
    const source = ["diagram flowchart", "start ->", "ok[Bien]", "@", ""].join("\n");
    const { diagnostics } = parse(source);
    // Without sorting this would come back as [E002 (line 4), E014 (line 2)]
    // because all lexer diagnostics are collected up front, before the body
    // parser runs and reports E014 for the earlier line.
    expect(diagnostics.map((d) => d.code)).toEqual(["E014", "E002"]);
    expect(diagnostics[0].range.start.line).toBe(2);
    expect(diagnostics[1].range.start.line).toBe(4);
    for (let i = 1; i < diagnostics.length; i += 1) {
      const prev = diagnostics[i - 1].range.start;
      const curr = diagnostics[i].range.start;
      expect(prev.line < curr.line || (prev.line === curr.line && prev.column <= curr.column)).toBe(true);
    }
  });
});
