import type { Token, TokenKind } from "./tokens.js";
import type { Diagnostic } from "./diagnostics.js";

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

  function push(kind: TokenKind, value: string, startLine: number, startColumn: number): void {
    tokens.push({ kind, value, line: startLine, column: startColumn });
  }

  while (i < source.length) {
    const startLine = line;
    const startColumn = column;
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
      push("TEXT", text.trim(), startLine, startColumn);
      pending = null;
      continue;
    }

    if (pending?.kind === "colon") {
      let text = "";
      while (i < source.length && source[i] !== "\n") {
        text += advance();
      }
      push("TEXT", text.trim(), startLine, startColumn);
      pending = null;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      advance();
      continue;
    }

    if (ch === "\n") {
      advance();
      push("NEWLINE", "\n", startLine, startColumn);
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
      push("ARROW", "->", startLine, startColumn);
      continue;
    }

    if (ch === ":") {
      advance();
      push("COLON", ":", startLine, startColumn);
      pending = { kind: "colon" };
      continue;
    }

    if (ch === "[" || ch === "(" || ch === "{") {
      advance();
      const kind: TokenKind = ch === "[" ? "LBRACKET" : ch === "(" ? "LPAREN" : "LBRACE";
      push(kind, ch, startLine, startColumn);
      pending = { kind: "bracket", closer: BRACKET_CLOSERS[ch], openLine: startLine, openColumn: startColumn };
      continue;
    }

    if (ch === "]" || ch === ")" || ch === "}") {
      advance();
      const kind: TokenKind = ch === "]" ? "RBRACKET" : ch === ")" ? "RPAREN" : "RBRACE";
      push(kind, ch, startLine, startColumn);
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let value = "";
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        value += advance();
      }
      push("IDENT", value, startLine, startColumn);
      if (value === "as") {
        pending = { kind: "colon" };
      }
      continue;
    }

    diagnostics.push({
      code: "E002",
      message: `carácter inesperado '${ch}'`,
      line: startLine,
      column: startColumn,
      severity: "error",
    });
    advance();
  }

  tokens.push({ kind: "EOF", value: "", line, column });
  return { tokens, diagnostics };
}
