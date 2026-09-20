import type { Token } from "../tokens.js";
import type { Diagnostic } from "../diagnostics.js";
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
      diagnostics.push({
        code: "E010",
        message: `se esperaba un identificador, se encontró '${startToken.value || startToken.kind}'`,
        line: startToken.range.start.line,
        column: startToken.range.start.column,
        severity: "error",
      });
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
        diagnostics.push({
          code: "E011",
          message: "se esperaba el texto del nodo",
          line: textToken.range.start.line,
          column: textToken.range.start.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const closeKind = CLOSE_BY_OPEN[openKind];
      if (current().kind !== closeKind) {
        diagnostics.push({
          code: "E012",
          message: `se esperaba '${CLOSE_CHAR[closeKind]}'`,
          line: current().range.start.line,
          column: current().range.start.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const existing = nodes.find((node) => node.id === id.value);
      const shape = SHAPE_BY_OPEN[openKind];
      if (existing && existing.shape !== shape) {
        diagnostics.push({
          code: "E013",
          message: `el nodo '${id.value}' ya fue declarado con otra forma`,
          line: id.range.start.line,
          column: id.range.start.column,
          severity: "error",
        });
      } else if (!existing) {
        nodes.push({ id: id.value, shape, label: textToken.value, position: { line: id.range.start.line, column: id.range.start.column } });
      }
    } else if (next.kind === "ARROW") {
      advance();
      const toToken = current();
      if (toToken.kind !== "IDENT") {
        diagnostics.push({
          code: "E014",
          message: "se esperaba el id del nodo destino",
          line: toToken.range.start.line,
          column: toToken.range.start.column,
          severity: "error",
        });
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
      diagnostics.push({
        code: "E015",
        message: "se esperaba una forma de nodo ('[', '(' o '{') o '->'",
        line: next.range.start.line,
        column: next.range.start.column,
        severity: "error",
      });
      skipToNextLine();
      skipNewlines();
      continue;
    }

    if (current().kind !== "EOF" && current().kind !== "NEWLINE") {
      diagnostics.push({
        code: "E016",
        message: "contenido inesperado al final de la línea",
        line: current().range.start.line,
        column: current().range.start.column,
        severity: "error",
      });
      skipToNextLine();
    }
    skipNewlines();
  }

  for (const edge of edges) {
    for (const id of [edge.from, edge.to]) {
      if (!nodes.some((node) => node.id === id)) {
        diagnostics.push({
          code: "E017",
          message: `el nodo '${id}' no fue declarado`,
          line: edge.position.line,
          column: edge.position.column,
          severity: "error",
        });
      }
    }
  }

  return { kind: "flowchart", nodes, edges };
}
