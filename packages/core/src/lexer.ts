import type { Token, TokenKind } from "./tokens.js";
import type { Diagnostic } from "./diagnostics.js";
import type { Position } from "./ast.js";

interface BracketMode {
  kind: "bracket";
  closer: string;
  openLine: number;
  openColumn: number;
}

interface ColonMode {
  kind: "colon";
}

type PendingTextMode = BracketMode | ColonMode | null;

export interface TokenizeResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const BRACKET_CLOSERS: Record<string, string> = {
  "[": "]",
  "(": ")",
  "{": "}",
};

export function tokenize(source: string): TokenizeResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let i = 0;
  let line = 1;
  let column = 1;
  let pending: PendingTextMode = null;

  function advance(): string {
    const ch = source[i];
    i += 1;
    if (ch === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return ch;
  }

  function push(kind: TokenKind, value: string, start: Position): void {
    tokens.push({ kind, value, range: { start, end: { line, column } } });
  }

  while (i < source.length) {
    const start: Position = { line, column };
    const ch = source[i];

    if (pending?.kind === "bracket") {
      let text = "";
      while (i < source.length && source[i] !== pending.closer && source[i] !== "\n") {
        text += advance();
      }
      if (i >= source.length || source[i] === "\n") {
        diagnostics.push({
          code: "E001",
          message: `se esperaba '${pending.closer}' antes de fin de línea`,
          line: pending.openLine,
          column: pending.openColumn,
          severity: "error",
        });
        pending = null;
        continue;
      }
      push("TEXT", text.trim(), start);
      pending = null;
      continue;
    }

    if (pending?.kind === "colon") {
      let text = "";
      while (i < source.length && source[i] !== "\n") {
        text += advance();
      }
      push("TEXT", text.trim(), start);
      pending = null;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      advance();
      continue;
    }

    if (ch === "\n") {
      advance();
      push("NEWLINE", "\n", start);
      continue;
    }

    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") {
        advance();
      }
      continue;
    }

    if (ch === "-" && source[i + 1] === ">") {
      advance();
      advance();
      push("ARROW", "->", start);
      continue;
    }

    if (ch === ":") {
      advance();
      push("COLON", ":", start);
      pending = { kind: "colon" };
      continue;
    }

    if (ch === "[" || ch === "(" || ch === "{") {
      advance();
      const kind: TokenKind = ch === "[" ? "LBRACKET" : ch === "(" ? "LPAREN" : "LBRACE";
      push(kind, ch, start);
      pending = { kind: "bracket", closer: BRACKET_CLOSERS[ch], openLine: start.line, openColumn: start.column };
      continue;
    }

    if (ch === "]" || ch === ")" || ch === "}") {
      advance();
      const kind: TokenKind = ch === "]" ? "RBRACKET" : ch === ")" ? "RPAREN" : "RBRACE";
      push(kind, ch, start);
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let value = "";
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        value += advance();
      }
      push("IDENT", value, start);
      if (value === "as") {
        pending = { kind: "colon" };
      }
      continue;
    }

    diagnostics.push({
      code: "E002",
      message: `carácter inesperado '${ch}'`,
      line: start.line,
      column: start.column,
      severity: "error",
    });
    advance();
  }

  tokens.push({ kind: "EOF", value: "", range: { start: { line, column }, end: { line, column } } });
  return { tokens, diagnostics };
}
