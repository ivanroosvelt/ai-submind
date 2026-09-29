import type { Text } from "@codemirror/state";
import { Lexer, type Token, type Position } from "@flo/core";

export interface HighlightRange {
  from: number;
  to: number;
  className: string;
}

const CLASS_BY_KIND: Partial<Record<Token["kind"], string>> = {
  IDENT: "flo-tok-ident",
  TEXT: "flo-tok-text",
  STRING: "flo-tok-string",
  ARROW: "flo-tok-arrow",
  COLON: "flo-tok-punct",
  COMMA: "flo-tok-punct",
  LBRACKET: "flo-tok-punct",
  RBRACKET: "flo-tok-punct",
  LPAREN: "flo-tok-punct",
  RPAREN: "flo-tok-punct",
  LBRACE: "flo-tok-punct",
  RBRACE: "flo-tok-punct",
};

// El highlighter no es consciente de la gramática (no llama a parse()), así
// que replica aquí, sin condición alguna, los disparadores de modo texto:
// abrir '['/'('/'{'. El Lexer perezoso nunca entra en modo texto por sí
// mismo.
// Tras ':' solo hay texto libre si la línea ya tuvo un '->' (etiqueta de
// arista o mensaje); en las propiedades de entity ('type: x') se siguen
// lexando identificadores.
const TEXT_CLOSER_BY_OPEN: Partial<Record<Token["kind"], "]" | ")" | "}">> = {
  LBRACKET: "]",
  LPAREN: ")",
  LBRACE: "}",
};

function offsetOf(doc: Text, position: Position): number {
  return doc.line(position.line).from + (position.column - 1);
}

export function buildHighlightRanges(doc: Text): HighlightRange[] {
  const lexer = new Lexer(doc.toString());
  const ranges: HighlightRange[] = [];

  function pushToken(token: Token): void {
    const className = CLASS_BY_KIND[token.kind];
    if (!className || token.value.length === 0) return;
    const from = offsetOf(doc, token.range.start);
    const to = offsetOf(doc, token.range.end);
    if (to <= from) return;
    ranges.push({ from, to, className });
  }

  let arrowInLine = false;
  let token = lexer.next();
  while (token.kind !== "EOF") {
    pushToken(token);
    if (token.kind === "NEWLINE") arrowInLine = false;
    if (token.kind === "ARROW") arrowInLine = true;

    const closer = TEXT_CLOSER_BY_OPEN[token.kind];
    if (closer) {
      pushToken(lexer.readTextUntil(closer));
    } else if (token.kind === "COLON" && arrowInLine) {
      pushToken(lexer.readTextUntil("\n"));
    }

    token = lexer.next();
  }

  return ranges;
}
