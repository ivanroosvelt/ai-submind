import type { Token, TokenKind } from "./tokens.js";
import { diagnosticAt, type Diagnostic } from "./diagnostics.js";
import type { Position } from "./ast.js";

/**
 * Lexer perezoso: el modo texto (`readTextUntil`) lo pide el consumidor
 * explícitamente en vez de que el escáner lo adivine viendo `:`, `[`/`(`/`{`
 * o la palabra `as`. `next()`/`peek()` nunca producen `TEXT`.
 */
export class Lexer {
  readonly diagnostics: Diagnostic[] = [];

  private i = 0;
  private line = 1;
  private column = 1;
  private buffered: Token | null = null;
  // Solo válido para anclar el E001 de readTextUntil porque todos los call
  // sites actuales llaman a readTextUntil() justo después de que next()
  // devuelve el token de apertura, sin otra llamada a readTextUntil de por
  // medio. Si algún día un caller necesita dos lecturas de texto
  // consecutivas, esta referencia no se habrá actualizado entre ambas y el
  // ancla de la segunda lectura quedaría obsoleta (apuntando al token de
  // apertura de la primera, no de la segunda).
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

      if (ch === ",") {
        this.advance();
        return this.makeToken("COMMA", ",", start);
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

      if (ch === '"') {
        this.advance(); // consume opening quote
        let value = "";
        while (this.i < this.source.length && this.source[this.i] !== '"' && this.source[this.i] !== "\n") {
          value += this.advance();
        }

        if (this.i < this.source.length && this.source[this.i] === '"') {
          // Found closing quote
          this.advance(); // consume closing quote
          return this.makeToken("STRING", value, start);
        } else {
          // Unterminated string (hit newline or EOF)
          this.diagnostics.push(
            diagnosticAt("E002", `cadena no cerrada antes de fin de línea`, { start, end: { line: this.line, column: this.column } })
          );
          return this.makeToken("STRING", value, start);
        }
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
      // columna después del bracket.
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

  /**
   * Mira, sin consumir nada, si lo que queda de la línea actual es solo
   * espacio en blanco o un comentario `//`. Lo usa el parser para decidir
   * si un `{` abre un cuerpo o una forma `{decisión}`.
   */
  restOfLineIsBlank(): boolean {
    if (this.buffered) {
      throw new Error("Lexer.restOfLineIsBlank: hay un token en el buffer de peek()");
    }
    let j = this.i;
    while (j < this.source.length && (this.source[j] === " " || this.source[j] === "\t" || this.source[j] === "\r")) {
      j += 1;
    }
    return j >= this.source.length || this.source[j] === "\n" || (this.source[j] === "/" && this.source[j + 1] === "/");
  }

  /**
   * Mira, sin consumir nada, si el próximo carácter no blanco de la línea
   * actual es '}'. Lo usa el parser para reconocer `entity X {}` (cuerpo
   * vacío en la misma línea) sin tokenizar lo que sigue — así no arriesga un
   * E002 espurio si en cambio es la forma corta `{texto}` de una entidad.
   */
  restOfLineStartsWithBrace(): boolean {
    if (this.buffered) {
      throw new Error("Lexer.restOfLineStartsWithBrace: hay un token en el buffer de peek()");
    }
    let j = this.i;
    while (j < this.source.length && (this.source[j] === " " || this.source[j] === "\t" || this.source[j] === "\r")) {
      j += 1;
    }
    return this.source[j] === "}";
  }

  /**
   * Si lo que resta de la línea actual, ignorando espacio en blanco final,
   * termina en '}', descarta los caracteres crudos hasta justo antes de esa
   * '}' (que el próximo next()/peek() tokenizará) y devuelve true. Si no
   * termina en '}', no consume nada y devuelve false. Lo usa el parser para
   * cerrar en la misma línea un cuerpo abierto con contenido detrás del '{'.
   */
  closeTrailingBraceOnLine(): boolean {
    if (this.buffered) {
      throw new Error("Lexer.closeTrailingBraceOnLine: hay un token en el buffer de peek()");
    }
    let j = this.i;
    while (j < this.source.length && this.source[j] !== "\n") j += 1;
    let k = j - 1;
    while (k >= this.i && (this.source[k] === " " || this.source[k] === "\t" || this.source[k] === "\r")) k -= 1;
    if (k < this.i || this.source[k] !== "}") return false;
    while (this.i < k) this.advance();
    return true;
  }

  /**
   * Descarta caracteres crudos hasta el próximo newline (o EOF), sin emitir
   * tokens ni diagnósticos. Recuperación de errores pura: para cuando el
   * parser ya decidió abandonar la línea actual y no quiere que el resto se
   * escanee como tokens de código (lo que generaría diagnósticos E002
   * espurios por caracteres que habrían quedado dentro de una región de
   * texto si la línea no hubiera fallado).
   */
  skipRestOfLine(): void {
    if (this.buffered) {
      throw new Error(
        "Lexer.skipRestOfLine: hay un token en el buffer de peek(); no se puede descartar texto crudo con un lookahead pendiente"
      );
    }
    while (this.i < this.source.length && this.source[this.i] !== "\n") {
      this.advance();
    }
  }
}
