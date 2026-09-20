import type { Token } from "../tokens.js";
import type { Lexer } from "../lexer.js";
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

const CLOSE_CHAR: Record<string, "]" | ")" | "}"> = {
  LBRACKET: "]",
  LPAREN: ")",
  LBRACE: "}",
};

export function parseFlowchartBody(
  lexer: Lexer,
  diagnostics: Diagnostic[]
): FlowchartDiagram {
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  let buffered: Token | null = null;

  function current(): Token {
    if (buffered === null) buffered = lexer.next();
    return buffered;
  }

  function advance(): Token {
    const token = current();
    if (token.kind !== "EOF") buffered = null;
    return token;
  }

  /** Pide texto al lexer. Requiere que no haya lookahead pendiente. */
  function readText(closer: "]" | ")" | "}" | "\n"): Token {
    if (buffered !== null) throw new Error("readText con lookahead pendiente");
    return lexer.readTextUntil(closer);
  }

  function skipNewlines(): void {
    while (current().kind === "NEWLINE") advance();
  }

  /**
   * Abandona la línea actual sin escanearla como tokens de código: descarta
   * el token en buffer (si hay uno, ya fue leído del lexer) y le pide al
   * lexer que descarte el resto de caracteres crudos hasta el próximo
   * newline. Evita E002 espurios por caracteres que habrían quedado dentro
   * de una región de texto si la línea no hubiera fallado.
   *
   * Si el token en buffer ya es NEWLINE o EOF, el cursor ya está en el
   * límite de línea (p. ej. porque un `current()` anterior, buscando otra
   * cosa, ya consumió el newline al escanearlo) — no hay nada crudo que
   * descartar, y llamar a skipRestOfLine() ahí saltaría de más la línea
   * siguiente completa.
   */
  function skipToNextLine(): void {
    if (buffered !== null) {
      const already = buffered;
      buffered = null;
      if (already.kind === "NEWLINE") return;
      if (already.kind === "EOF") {
        buffered = already;
        return;
      }
    }
    lexer.skipRestOfLine();
    buffered = lexer.next(); // será NEWLINE (o EOF)
    if (buffered.kind === "NEWLINE") buffered = null;
  }

  skipNewlines();
  while (current().kind !== "EOF") {
    const startToken = current();

    if (startToken.kind !== "IDENT") {
      diagnostics.push(
        diagnosticAt(
          "E010",
          `se esperaba un identificador, se encontró '${
            startToken.kind === "STRING" ? `"${startToken.value}"` : startToken.value || startToken.kind
          }'`,
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
      const textToken = readText(CLOSE_CHAR[openKind]);
      if (!textToken.value) {
        diagnostics.push(
          diagnosticAt("E011", "se esperaba el texto del nodo", textToken.range)
        );
        skipToNextLine();
        skipNewlines();
        continue;
      }
      const closeKind = CLOSE_BY_OPEN[openKind];
      if (current().kind !== closeKind) {
        diagnostics.push(
          diagnosticAt("E012", `se esperaba '${CLOSE_CHAR[openKind]}'`, current().range)
        );
        skipToNextLine();
        skipNewlines();
        continue;
      }
      const closeToken = current();
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
        nodes.push({
          id: id.value,
          shape,
          label: textToken.value,
          range: { start: id.range.start, end: closeToken.range.end },
          nameRange: id.range,
        });
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
      let lastConsumedRange = toToken.range;
      if (current().kind === "COLON") {
        advance();
        const labelToken = readText("\n");
        label = labelToken.value ? labelToken.value : null;
        lastConsumedRange = labelToken.range;
      }
      edges.push({
        from: id.value,
        to: toToken.value,
        label,
        range: { start: id.range.start, end: lastConsumedRange.end },
        fromRange: id.range,
        toRange: toToken.range,
      });
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
    for (const [id, range] of [
      [edge.from, edge.fromRange],
      [edge.to, edge.toRange],
    ] as const) {
      if (!nodes.some((node) => node.id === id)) {
        diagnostics.push(diagnosticAt("E017", `el nodo '${id}' no fue declarado`, range));
      }
    }
  }

  return { kind: "flowchart", nodes, edges };
}
