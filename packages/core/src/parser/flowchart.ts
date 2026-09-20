import type { Token } from "../tokens.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { FlowchartDiagram, FlowchartNode, FlowchartEdge, NodeShape } from "../ast.js";

const SHAPE_BY_OPEN: Record<string, NodeShape> = {
  LBRACKET: "rectangle",
  LPAREN: "rounded",
  LBRACE: "decision",
};

const CLOSE_BY_OPEN: Record<string, string> = {
  LBRACKET: "RBRACKET",
  LPAREN: "RPAREN",
  LBRACE: "RBRACE",
};

const CLOSE_CHAR: Record<string, string> = {
  RBRACKET: "]",
  RPAREN: ")",
  RBRACE: "}",
};

export function parseFlowchartBody(
  tokens: Token[],
  diagnostics: Diagnostic[]
): FlowchartDiagram {
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  let pos = 0;

  function current(): Token {
    return tokens[pos];
  }

  function advance(): Token {
    const token = tokens[pos];
    if (token.kind !== "EOF") pos += 1;
    return token;
  }

  function skipNewlines(): void {
    while (current().kind === "NEWLINE") advance();
  }

  function skipToNextLine(): void {
    while (current().kind !== "NEWLINE" && current().kind !== "EOF") advance();
    if (current().kind === "NEWLINE") advance();
  }

  skipNewlines();
  while (current().kind !== "EOF") {
    const startToken = current();

    if (startToken.kind !== "IDENT") {
      diagnostics.push(
        diagnosticAt(
          "E010",
          `se esperaba un identificador, se encontró '${startToken.value || startToken.kind}'`,
          startToken.range
        )
      );
      skipToNextLine();
      skipNewlines();
      continue;
    }

    const id = advance();
    const next = current();

    if (next.kind === "LBRACKET" || next.kind === "LPAREN" || next.kind === "LBRACE") {
      const openKind = next.kind;
      advance();
      const textToken = current();
      if (textToken.kind !== "TEXT" || !textToken.value) {
        diagnostics.push(
          diagnosticAt("E011", "se esperaba el texto del nodo", textToken.range)
        );
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const closeKind = CLOSE_BY_OPEN[openKind];
      if (current().kind !== closeKind) {
        diagnostics.push(
          diagnosticAt("E012", `se esperaba '${CLOSE_CHAR[closeKind]}'`, current().range)
        );
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const existing = nodes.find((node) => node.id === id.value);
      const shape = SHAPE_BY_OPEN[openKind];
      if (existing && existing.shape !== shape) {
        diagnostics.push(
          diagnosticAt(
            "E013",
            `el nodo '${id.value}' ya fue declarado con otra forma`,
            id.range
          )
        );
      } else if (!existing) {
        nodes.push({ id: id.value, shape, label: textToken.value, position: { line: id.range.start.line, column: id.range.start.column } });
      }
    } else if (next.kind === "ARROW") {
      advance();
      const toToken = current();
      if (toToken.kind !== "IDENT") {
        diagnostics.push(
          diagnosticAt("E014", "se esperaba el id del nodo destino", toToken.range)
        );
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      let label: string | null = null;
      if (current().kind === "COLON") {
        advance();
        const labelToken = current();
        if (labelToken.kind === "TEXT") {
          label = labelToken.value ? labelToken.value : null;
          advance();
        }
      }
      edges.push({ from: id.value, to: toToken.value, label, position: { line: id.range.start.line, column: id.range.start.column } });
    } else {
      diagnostics.push(
        diagnosticAt(
          "E015",
          "se esperaba una forma de nodo ('[', '(' o '{') o '->'",
          next.range
        )
      );
      skipToNextLine();
      skipNewlines();
      continue;
    }

    if (current().kind !== "EOF" && current().kind !== "NEWLINE") {
      diagnostics.push(
        diagnosticAt("E016", "contenido inesperado al final de la línea", current().range)
      );
      skipToNextLine();
    }
    skipNewlines();
  }

  for (const edge of edges) {
    for (const id of [edge.from, edge.to]) {
      if (!nodes.some((node) => node.id === id)) {
        // ponytail: E017 still reports at edge.position (degenerate range) —
        // pointing at the specific missing identifier needs fromRange/toRange
        // on FlowchartEdge, added in Task 3.
        diagnostics.push(
          diagnosticAt("E017", `el nodo '${id}' no fue declarado`, {
            start: edge.position,
            end: edge.position,
          })
        );
      }
    }
  }

  return { kind: "flowchart", nodes, edges };
}
