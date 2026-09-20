import type { Token, TokenKind } from "./tokens.js";
import { diagnosticAt, type Diagnostic } from "./diagnostics.js";
import type { Position } from "./ast.js";

interface BracketMode {
  kind: "bracket";
  closer: string;
  openPosition: Position;
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
        diagnostics.push(
          diagnosticAt(
            "E001",
            `se esperaba '${pending.closer}' antes de fin de línea`,
            { start: pending.openPosition, end: { line, column } }
          )
        );
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
      pending = { kind: "bracket", closer: BRACKET_CLOSERS[ch], openPosition: start };
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

    advance();
    diagnostics.push(
      diagnosticAt("E002", `carácter inesperado '${ch}'`, { start, end: { line, column } })
    );
  }

  tokens.push({ kind: "EOF", value: "", range: { start: { line, column }, end: { line, column } } });
  return { tokens, diagnostics };
}

/**
 * Lexer perezoso: el modo texto (`readTextUntil`) lo pide el consumidor
 * explícitamente en vez de que el escáner lo adivine viendo `:`, `[`/`(`/`{`
 * o la palabra `as`. `next()`/`peek()` nunca producen `TEXT`.
 *
 * El bucle de modo código de `scanCodeToken` es el de `tokenize()` menos
 * las tres ramas que armaban `pending`; se duplica en vez de compartirse
 * porque `tokenize()` se elimina en la Task 5 y aquí no hay array de
 * tokens que llenar, solo un token a la vez.
 */
export class Lexer {
  readonly diagnostics: Diagnostic[] = [];

  private i = 0;
  private line = 1;
  private column = 1;
  private buffered: Token | null = null;
  private lastReturned: Token | null = null;

  constructor(private readonly source: string) {}

  private advance(): string {
    const ch = this.source[this.i];
    this.i += 1;
    if (ch === "\n") {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }
    return ch;
  }

  private makeToken(kind: TokenKind, value: string, start: Position): Token {
    return { kind, value, range: { start, end: { line: this.line, column: this.column } } };
  }

  private scanCodeToken(): Token {
    while (this.i < this.source.length) {
      const start: Position = { line: this.line, column: this.column };
      const ch = this.source[this.i];

      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
        continue;
      }

      if (ch === "\n") {
        this.advance();
        return this.makeToken("NEWLINE", "\n", start);
      }

      if (ch === "/" && this.source[this.i + 1] === "/") {
        while (this.i < this.source.length && this.source[this.i] !== "\n") {
          this.advance();
        }
        continue;
      }

      if (ch === "-" && this.source[this.i + 1] === ">") {
        this.advance();
        this.advance();
        return this.makeToken("ARROW", "->", start);
      }

      if (ch === ":") {
        this.advance();
        return this.makeToken("COLON", ":", start);
      }

      if (ch === "[" || ch === "(" || ch === "{") {
        this.advance();
        const kind: TokenKind = ch === "[" ? "LBRACKET" : ch === "(" ? "LPAREN" : "LBRACE";
        return this.makeToken(kind, ch, start);
      }

      if (ch === "]" || ch === ")" || ch === "}") {
        this.advance();
        const kind: TokenKind = ch === "]" ? "RBRACKET" : ch === ")" ? "RPAREN" : "RBRACE";
        return this.makeToken(kind, ch, start);
      }

      if (/[A-Za-z_]/.test(ch)) {
        let value = "";
        while (this.i < this.source.length && /[A-Za-z0-9_]/.test(this.source[this.i])) {
          value += this.advance();
        }
        return this.makeToken("IDENT", value, start);
      }

      this.advance();
      this.diagnostics.push(
        diagnosticAt("E002", `carácter inesperado '${ch}'`, { start, end: { line: this.line, column: this.column } })
      );
    }

    const eofPosition: Position = { line: this.line, column: this.column };
    return { kind: "EOF", value: "", range: { start: eofPosition, end: eofPosition } };
  }

  /** Siguiente token en modo código. Nunca produce TEXT. */
  next(): Token {
    let token: Token;
    if (this.buffered) {
      token = this.buffered;
      this.buffered = null;
    } else {
      token = this.scanCodeToken();
    }
    this.lastReturned = token;
    return token;
  }

  /** Lookahead de exactamente un token, en modo código. */
  peek(): Token {
    if (!this.buffered) {
      this.buffered = this.scanCodeToken();
    }
    return this.buffered;
  }

  /**
   * Consume texto crudo hasta `closer` (o hasta fin de línea si es "\n").
   * El closer NO se consume. Emite E001 si falta antes del newline.
   */
  readTextUntil(closer: "]" | ")" | "}" | "\n"): Token {
    if (this.buffered) {
      throw new Error(
        "Lexer.readTextUntil: hay un token en el buffer de peek(); el parser debe pedir texto justo después de consumir el token de apertura, sin peek intermedio"
      );
    }

    const start: Position = { line: this.line, column: this.column };
    let text = "";

    if (closer === "\n") {
      while (this.i < this.source.length && this.source[this.i] !== "\n") {
        text += this.advance();
      }
      return this.makeToken("TEXT", text.trim(), start);
    }

    while (this.i < this.source.length && this.source[this.i] !== closer && this.source[this.i] !== "\n") {
      text += this.advance();
    }

    if (this.i >= this.source.length || this.source[this.i] === "\n") {
      // Se ancla en el token de apertura (el último que devolvió next()),
      // no en el cursor: readTextUntil siempre se llama justo después de
      // consumir ese token, así que anclar en el cursor quedaría una
      // columna después del bracket, igual que tokenize() lo hacía con
      // `pending.openPosition`.
      const anchor = this.lastReturned ? this.lastReturned.range.start : start;
      this.diagnostics.push(
        diagnosticAt("E001", `se esperaba '${closer}' antes de fin de línea`, {
          start: anchor,
          end: { line: this.line, column: this.column },
        })
      );
    }

    return this.makeToken("TEXT", text.trim(), start);
  }
}
