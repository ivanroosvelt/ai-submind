import { describe, it, expect } from "vitest";
import { parse } from "./index";

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
        { id: "start", shape: "rectangle", label: "Inicio", position: { line: 3, column: 1 } },
        { id: "check", shape: "decision", label: "Login valido", position: { line: 4, column: 1 } },
        { id: "home", shape: "rectangle", label: "Mostrar home", position: { line: 5, column: 1 } },
      ],
      edges: [
        { from: "start", to: "check", label: null, position: { line: 7, column: 1 } },
        { from: "check", to: "home", label: "si", position: { line: 8, column: 1 } },
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
        { id: "user", label: "Usuario", position: { line: 3, column: 13 } },
        { id: "api", label: "API", position: { line: 4, column: 13 } },
      ],
      messages: [
        { from: "user", to: "api", label: "POST /login", position: { line: 6, column: 1 } },
        { from: "api", to: "user", label: "200 OK", position: { line: 7, column: 1 } },
      ],
    });
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
});
