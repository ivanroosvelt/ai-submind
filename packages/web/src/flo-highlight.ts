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

function offsetOf(doc: Text, position: { line: number; column: number }): number {
  return doc.line(position.line).from + (position.column - 1);
}

export function buildHighlightRanges(doc: Text): HighlightRange[] {
  const { tokens } = tokenize(doc.toString());
  const ranges: HighlightRange[] = [];
  for (const token of tokens) {
    const className = CLASS_BY_KIND[token.kind];
    if (!className) continue;
    const from = offsetOf(doc, token.range.start);
    const to = offsetOf(doc, token.range.end);
    if (to <= from) continue;
    ranges.push({ from, to, className });
  }
  return ranges;
}
