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
  ARROW: "flo-tok-arrow",
  COLON: "flo-tok-punct",
  LBRACKET: "flo-tok-punct",
  RBRACKET: "flo-tok-punct",
  LPAREN: "flo-tok-punct",
  RPAREN: "flo-tok-punct",
  LBRACE: "flo-tok-punct",
  RBRACE: "flo-tok-punct",
};

// El highlighter no es consciente de la gramática (no llama a parse()), así
// que replica aquí, sin condición alguna, los disparadores de modo texto:
// abrir '['/'('/'{' y ':'. El Lexer perezoso nunca entra en modo texto por
// sí mismo.
// ponytail: tras "type:" colorea el resto de la línea como texto; resaltar
// propiedades de entity requiere un highlighter con gramática.
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

  let token = lexer.next();
  while (token.kind !== "EOF") {
    pushToken(token);

    const closer = TEXT_CLOSER_BY_OPEN[token.kind];
    if (closer) {
      pushToken(lexer.readTextUntil(closer));
    } else if (token.kind === "COLON") {
      pushToken(lexer.readTextUntil("\n"));
    }

    token = lexer.next();
  }

  return ranges;
}
