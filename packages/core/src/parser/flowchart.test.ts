import { describe, it, expect } from "vitest";
import { Lexer } from "../lexer.js";
import { parseFlowchartBody } from "./flowchart.js";
import type { Diagnostic } from "../diagnostics.js";

function parseBody(source: string) {
  const lexer = new Lexer(source);
  const diagnostics: Diagnostic[] = [];
  const diagram = parseFlowchartBody(lexer, diagnostics);
  diagnostics.push(...lexer.diagnostics);
  return { diagram, diagnostics };
}

describe("parseFlowchartBody", () => {
  it("parses node declarations with all three shapes", () => {
    const { diagram, diagnostics } = parseBody(
      "start[Inicio]\ncheck{Login valido}\ndone(Fin)\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.nodes).toEqual([
      {
        id: "start",
        shape: "rectangle",
        label: "Inicio",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 14 } },
        nameRange: { start: { line: 1, column: 1 }, end: { line: 1, column: 6 } },
      },
      {
        id: "check",
        shape: "decision",
        label: "Login valido",
        range: { start: { line: 2, column: 1 }, end: { line: 2, column: 20 } },
        nameRange: { start: { line: 2, column: 1 }, end: { line: 2, column: 6 } },
      },
      {
        id: "done",
        shape: "rounded",
        label: "Fin",
        range: { start: { line: 3, column: 1 }, end: { line: 3, column: 10 } },
        nameRange: { start: { line: 3, column: 1 }, end: { line: 3, column: 5 } },
      },
    ]);
  });

  it("parses edges with and without labels", () => {
    const { diagram, diagnostics } = parseBody(
      "start[Inicio]\ncheck{Login valido}\nstart -> check\ncheck -> start : reintentar\n"
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.edges).toEqual([
      {
        from: "start",
        to: "check",
        label: null,
        range: { start: { line: 3, column: 1 }, end: { line: 3, column: 15 } },
        fromRange: { start: { line: 3, column: 1 }, end: { line: 3, column: 6 } },
        toRange: { start: { line: 3, column: 10 }, end: { line: 3, column: 15 } },
      },
      {
        from: "check",
        to: "start",
        label: "reintentar",
        range: { start: { line: 4, column: 1 }, end: { line: 4, column: 28 } },
        fromRange: { start: { line: 4, column: 1 }, end: { line: 4, column: 6 } },
        toRange: { start: { line: 4, column: 10 }, end: { line: 4, column: 15 } },
      },
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

  it("reports E017 for each endpoint of an edge that references an id never declared as a node", () => {
    const { diagnostics } = parseBody("ghost1 -> ghost2\n");
    const e017 = diagnostics.filter((d) => d.code === "E017");
    expect(e017).toHaveLength(2);
    expect(e017.map((d) => d.message)).toEqual([
      "el nodo 'ghost1' no fue declarado",
      "el nodo 'ghost2' no fue declarado",
    ]);
    expect(e017[0].range).toEqual({ start: { line: 1, column: 1 }, end: { line: 1, column: 7 } });
    expect(e017[1].range).toEqual({ start: { line: 1, column: 11 }, end: { line: 1, column: 17 } });
  });

  it("does not report E017 when an edge references a node declared later in the file (order-independent)", () => {
    const { diagnostics } = parseBody("start -> end\nstart[Inicio]\nend[Fin]\n");
    expect(diagnostics.filter((d) => d.code === "E017")).toHaveLength(0);
  });

  it("reports E011 when a node's bracketed label is empty", () => {
    const { diagnostics } = parseBody("start[]\n");
    expect(diagnostics.some((d) => d.code === "E011")).toBe(true);
  });

  it("treats an edge with a colon but no text after it as label: null, not an empty string, and reports no diagnostic", () => {
    const { diagram, diagnostics } = parseBody("start[A]\nend[B]\nstart -> end :\n");
    expect(diagnostics).toEqual([]);
    expect(diagram.edges).toHaveLength(1);
    expect(diagram.edges[0].label).toBeNull();
  });
});
