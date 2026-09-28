import type { Range } from "./ast.js";

export type TokenKind =
  | "IDENT"
  | "TEXT"
  | "ARROW"
  | "COLON"
  | "COMMA"
  | "LBRACKET"
  | "RBRACKET"
  | "LPAREN"
  | "RPAREN"
  | "LBRACE"
  | "RBRACE"
  | "STRING"
  | "NEWLINE"
  | "EOF";

export interface Token {
  kind: TokenKind;
  value: string;
  range: Range;
}
