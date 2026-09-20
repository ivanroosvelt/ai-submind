import type { Range } from "./ast.js";

export type TokenKind =
  | "IDENT"
  | "TEXT"
  | "ARROW"
  | "COLON"
  | "LBRACKET"
  | "RBRACKET"
  | "LPAREN"
  | "RPAREN"
  | "LBRACE"
  | "RBRACE"
  | "NEWLINE"
  | "EOF";

export interface Token {
  kind: TokenKind;
  value: string;
  range: Range;
}
