import type { Text } from "@codemirror/state";
import { tokenize, type Token } from "@flo/core";

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

export function buildHighlightRanges(doc: Text): HighlightRange[] {
  const { tokens } = tokenize(doc.toString());
  const ranges: HighlightRange[] = [];
  for (const token of tokens) {
    const className = CLASS_BY_KIND[token.kind];
    if (!className || token.value.length === 0) continue;
    const from = doc.line(token.line).from + (token.column - 1);
    ranges.push({ from, to: from + token.value.length, className });
  }
  return ranges;
}
