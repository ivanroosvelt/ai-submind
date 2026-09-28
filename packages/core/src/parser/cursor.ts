import type { Token } from "../tokens.js";
import type { Lexer } from "../lexer.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";

/**
 * Un token de lookahead sobre el Lexer, más la recuperación de errores que
 * comparten todos los parsers. El lexer no tiene lookahead propio en uso
 * (nadie llama a `lexer.peek()`), así que `readText` y `restOfLineIsBlank`
 * son válidos siempre que este cursor no tenga un token en buffer.
 */
export class TokenCursor {
  private buffered: Token | null = null;

  constructor(readonly lexer: Lexer) {}

  current(): Token {
    if (this.buffered === null) this.buffered = this.lexer.next();
    return this.buffered;
  }

  advance(): Token {
    const token = this.current();
    if (token.kind !== "EOF") this.buffered = null;
    return token;
  }

  /**
   * Mira un token más allá de current(), sin consumir nada. Usa el peek()
   * propio del lexer: como current() ya dejó el lexer sin lookahead pendiente
   * (o lo llena ahora mismo), este peek() del lexer queda libre para mirar el
   * token siguiente.
   */
  peekNext(): Token {
    this.current();
    return this.lexer.peek();
  }

  /**
   * Si lo que resta de la línea actual (desde donde va el lexer, incluido el
   * token ya cacheado como current()) termina en '}' ignorando espacio en
   * blanco, descarta ese current() y los caracteres crudos previos a esa '}'
   * sin tokenizarlos, dejando la '}' como próximo current(). No toca nada si
   * no encuentra esa '}' al final: repone el token para que el caller siga
   * igual que si esto no se hubiera llamado.
   */
  closeTrailingBraceOnLine(): boolean {
    const pending = this.buffered;
    this.buffered = null;
    if (!this.lexer.closeTrailingBraceOnLine()) {
      this.buffered = pending;
      return false;
    }
    return true;
  }

  /** Pide texto al lexer. Requiere que no haya lookahead pendiente. */
  readText(closer: "]" | ")" | "}" | "\n"): Token {
    if (this.buffered !== null) throw new Error("readText con lookahead pendiente");
    return this.lexer.readTextUntil(closer);
  }

  /** Mira la línea cruda que queda. Requiere que no haya lookahead pendiente. */
  restOfLineIsBlank(): boolean {
    if (this.buffered !== null) throw new Error("restOfLineIsBlank con lookahead pendiente");
    return this.lexer.restOfLineIsBlank();
  }

  /** Pide al lexer si el próximo carácter no blanco de la línea es '}'. */
  restOfLineStartsWithBrace(): boolean {
    if (this.buffered !== null) throw new Error("restOfLineStartsWithBrace con lookahead pendiente");
    return this.lexer.restOfLineStartsWithBrace();
  }

  atLineEnd(): boolean {
    const kind = this.current().kind;
    return kind === "NEWLINE" || kind === "EOF";
  }

  skipNewlines(): void {
    while (this.current().kind === "NEWLINE") this.advance();
  }

  /**
   * Abandona la línea actual sin escanearla como tokens de código: descarta
   * el token en buffer (si hay uno, ya fue leído del lexer) y le pide al
   * lexer que descarte el resto de caracteres crudos hasta el próximo
   * newline. Evita E002 espurios por caracteres que habrían quedado dentro
   * de una región de texto si la línea no hubiera fallado.
   *
   * Si el token en buffer ya es NEWLINE o EOF, el cursor ya está en el
   * límite de línea — no hay nada crudo que descartar, y llamar a
   * skipRestOfLine() ahí saltaría de más la línea siguiente completa.
   */
  skipToNextLine(): void {
    if (this.buffered !== null) {
      const already = this.buffered;
      this.buffered = null;
      if (already.kind === "NEWLINE") return;
      if (already.kind === "EOF") {
        this.buffered = already;
        return;
      }
    }
    this.lexer.skipRestOfLine();
    this.buffered = this.lexer.next(); // será NEWLINE (o EOF)
    if (this.buffered.kind === "NEWLINE") this.buffered = null;
  }
}

/** Cómo mostrar un token inesperado en un mensaje de error. */
export function describeToken(token: Token): string {
  return token.kind === "STRING" ? `"${token.value}"` : token.value || token.kind;
}

/** E016 si queda algo en la línea; descarta el resto para seguir en la siguiente. */
export function reportTrailing(cursor: TokenCursor, diagnostics: Diagnostic[]): void {
  if (cursor.atLineEnd()) return;
  diagnostics.push(diagnosticAt("E016", "contenido inesperado al final de la línea", cursor.current().range));
  cursor.skipToNextLine();
}

/**
 * Como reportTrailing(), para el contenido que sigue a un '{' que abre un
 * cuerpo (bloque o entidad) en la misma línea. Un '}' inmediato (cuerpo
 * vacío en una línea) no es contenido sobrante: el caller lo ve como
 * current() y lo cierra él mismo. Si hay contenido y la línea cruda termina
 * en '}', reporta un único E016 en ese primer token y deja la '}' como
 * próximo current(), sin escanear el resto como tokens de código (evita
 * E002 espurios por texto de etiqueta). Si no termina en '}', cae en
 * reportTrailing de siempre: E016 y se descarta el resto de la línea.
 */
export function reportTrailingAfterOpenBrace(cursor: TokenCursor, diagnostics: Diagnostic[]): void {
  if (cursor.atLineEnd() || cursor.current().kind === "RBRACE") return;
  const trailing = cursor.current();
  if (cursor.closeTrailingBraceOnLine()) {
    diagnostics.push(diagnosticAt("E016", "contenido inesperado al final de la línea", trailing.range));
    return;
  }
  reportTrailing(cursor, diagnostics);
}

/**
 * Palabras clave de nivel superior (decisiones #3, #13 y #23): solo son
 * especiales al inicio de una línea de nivel superior, pero una línea que
 * empieza con una de ellas dentro de un cuerpo sin cerrar lo cierra.
 */
export function isTopLevelKeyword(value: string): boolean {
  return value === "entity" || value === "flow" || value === "sequence" || value === "use";
}
