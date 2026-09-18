import { describe, it, expect } from "vitest";
import { tokenize } from "../lexer";
import { parseFlowchartBody } from "./flowchart";
import type { Diagnostic } from "../diagnostics";

function parseBody(source: string) {
  const { tokens, diagnostics: lexDiagnostics } = tokenize(source);
  const diagnostics: Diagnostic[] = [...lexDiagnostics];
  const diagram = parseFlowchartBody(tokens, diagnostics);
  return { diagram, diagnostics };
}

describe("parseFlowchartBody", () => {
  it("parses node declarations with all three shapes", () => {
    const { diagram, diagnostics } = parseBody(
      "start[Inicio]\ncheck{Login valido}\ndone(Fin)\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.nodes).toEqual([
      { id: "start", shape: "rectangle", label: "Inicio", position: { line: 1, column: 1 } },
      { id: "check", shape: "decision", label: "Login valido", position: { line: 2, column: 1 } },
      { id: "done", shape: "rounded", label: "Fin", position: { line: 3, column: 1 } },
    ]);
  });

  it("parses edges with and without labels", () => {
    const { diagram, diagnostics } = parseBody(
      "start[Inicio]\ncheck{Login valido}\nstart -> check\ncheck -> start : reintentar\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.edges).toEqual([
      { from: "start", to: "check", label: null, position: { line: 3, column: 1 } },
      { from: "check", to: "start", label: "reintentar", position: { line: 4, column: 1 } },
    ]);
  });

  it("reports E013 when a node id is redeclared with a different shape", () => {
    const { diagnostics } = parseBody("start[Inicio]\nstart(Otra forma)\n");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("E013");
  });

  it("recovers after an unterminated node shape and keeps parsing the next line", () => {
    const { diagram, diagnostics } = parseBody("broken[sin cerrar\nok[Bien]\n");
    expect(diagnostics.some((d) => d.code === "E001")).toBe(true);
    expect(diagram.nodes.map((n) => n.id)).toEqual(["ok"]);
  });

  it("reports E014 when an edge is missing its target id", () => {
    const { diagnostics } = parseBody("start[Inicio]\nstart ->\n");
    expect(diagnostics.some((d) => d.code === "E014")).toBe(true);
  });
});
