import type { Token, TokenKind } from "../tokens.js";
import {
  describeToken,
  isTopLevelKeyword,
  reportTrailing,
  reportTrailingAfterOpenBrace,
  type TokenCursor,
} from "./cursor.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, EntityDecl, NodeShape } from "../ast.js";

type OpenKind = "LBRACKET" | "LPAREN" | "LBRACE";

const SHAPE_BY_OPEN: Record<OpenKind, NodeShape> = {
  LBRACKET: "rectangle",
  LPAREN: "rounded",
  LBRACE: "decision",
};
const CLOSE_BY_OPEN: Record<OpenKind, TokenKind> = {
  LBRACKET: "RBRACKET",
  LPAREN: "RPAREN",
  LBRACE: "RBRACE",
};
const CLOSE_CHAR: Record<OpenKind, "]" | ")" | "}"> = {
  LBRACKET: "]",
  LPAREN: ")",
  LBRACE: "}",
};

function isOpen(kind: TokenKind): kind is OpenKind {
  return kind === "LBRACKET" || kind === "LPAREN" || kind === "LBRACE";
}

/**
 * `PropList ::= Prop ("," Prop)*`. Devuelve false si tuvo que descartar la
 * línea (el caller no debe seguir leyéndola).
 */
function parseProps(cursor: TokenCursor, entity: EntityDecl, diagnostics: Diagnostic[]): boolean {
  let previous: string | null = null;
  for (;;) {
    const key = cursor.current();
    if (key.kind !== "IDENT") {
      diagnostics.push(
        diagnosticAt("E010", `se esperaba un identificador, se encontró '${describeToken(key)}'`, key.range)
      );
      cursor.skipToNextLine();
      return false;
    }
    cursor.advance();

    if (cursor.current().kind !== "COLON") {
      const hint = previous === "tags" ? "; los tags se separan con espacios, no con comas" : "";
      diagnostics.push(
        diagnosticAt("E042", `se esperaba ':' después de '${key.value}'${hint}`, cursor.current().range)
      );
      cursor.skipToNextLine();
      return false;
    }
    cursor.advance();

    const values: Token[] = [];
    while (cursor.current().kind === "IDENT" && (key.value !== "type" || values.length === 0)) {
      values.push(cursor.advance());
    }
    if (values.length === 0) {
      diagnostics.push(diagnosticAt("E043", `se esperaba el valor de '${key.value}'`, cursor.current().range));
      cursor.skipToNextLine();
      return false;
    }

    if (key.value !== "type" && key.value !== "tags") {
      diagnostics.push(
        diagnosticAt("E034", `propiedad desconocida '${key.value}'; se esperaba 'type' o 'tags'`, key.range)
      );
    } else if (key.value === "type" ? entity.type !== null : entity.tags.length > 0) {
      diagnostics.push(diagnosticAt("E044", `la propiedad '${key.value}' ya fue definida`, key.range));
    } else if (key.value === "type") {
      entity.type = values[0].value;
    } else {
      entity.tags = values.map((value) => value.value);
    }
    entity.range.end = values[values.length - 1].range.end;
    previous = key.value;

    if (cursor.current().kind !== "COMMA") return true;
    cursor.advance();
  }
}

/** `Body ::= "{" Newline (PropList? Newline)* "}"`. `open` ya fue consumido. */
function parseBody(cursor: TokenCursor, entity: EntityDecl, open: Token, diagnostics: Diagnostic[]): void {
  reportTrailingAfterOpenBrace(cursor, diagnostics);
  cursor.skipNewlines();
  for (;;) {
    const token = cursor.current();
    if (token.kind === "EOF") {
      diagnostics.push(
        diagnosticAt("E045", `falta '}' que cierra el cuerpo de la entidad '${entity.id}'`, open.range)
      );
      entity.range.end = token.range.end;
      return;
    }
    if (token.kind === "RBRACE") {
      entity.range.end = cursor.advance().range.end;
      reportTrailing(cursor, diagnostics);
      return;
    }
    if (token.kind === "IDENT" && isTopLevelKeyword(token.value)) {
      // Solo 'type'/'tags' son claves válidas en un cuerpo de entidad: una
      // línea que empieza con una de estas palabras clave es en realidad el
      // siguiente statement de nivel superior. No hace falta lookahead (a
      // diferencia de un bloque, aquí nunca es un edge válido). No se
      // consume la línea, para que el parser de documento la retome.
      diagnostics.push(
        diagnosticAt("E045", `falta '}' que cierra el cuerpo de la entidad '${entity.id}'`, open.range)
      );
      return;
    }
    if (parseProps(cursor, entity, diagnostics)) reportTrailing(cursor, diagnostics);
    cursor.skipNewlines();
  }
}

/**
 * Precondición: el token actual es `entity`. Devuelve null solo si falta el
 * id (E041); con cualquier otro error devuelve la entidad parcial, para que
 * sus referencias no disparen E030 en cascada.
 */
export function parseEntity(cursor: TokenCursor, uri: DocumentUri, diagnostics: Diagnostic[]): EntityDecl | null {
  const keyword = cursor.advance();
  const idToken = cursor.current();
  if (idToken.kind !== "IDENT") {
    diagnostics.push(diagnosticAt("E041", "se esperaba el id de la entidad", idToken.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  const entity: EntityDecl = {
    id: idToken.value,
    label: idToken.value,
    shape: "rectangle",
    type: null,
    tags: [],
    uri,
    range: { start: keyword.range.start, end: idToken.range.end },
    nameRange: idToken.range,
    knowledge: null,
  };

  const open = cursor.current();
  if (isOpen(open.kind)) {
    const openKind = open.kind;
    cursor.advance();
    // `entity X {` sin nada más en la línea, o `entity X {}` con el cierre
    // ahí mismo: el `{` abre el cuerpo (vacío en el segundo caso), no un
    // rombo.
    if (openKind === "LBRACE" && (cursor.restOfLineIsBlank() || cursor.restOfLineStartsWithBrace())) {
      parseBody(cursor, entity, open, diagnostics);
      return entity;
    }
    const text = cursor.readText(CLOSE_CHAR[openKind]);
    if (!text.value) {
      diagnostics.push(diagnosticAt("E011", "se esperaba el texto de la entidad", text.range));
      cursor.skipToNextLine();
      return entity;
    }
    const close = cursor.current();
    if (close.kind !== CLOSE_BY_OPEN[openKind]) {
      diagnostics.push(diagnosticAt("E012", `se esperaba '${CLOSE_CHAR[openKind]}'`, close.range));
      cursor.skipToNextLine();
      return entity;
    }
    cursor.advance();
    entity.shape = SHAPE_BY_OPEN[openKind];
    entity.label = text.value;
    entity.range.end = close.range.end;
  }

  if (cursor.current().kind === "IDENT" && !parseProps(cursor, entity, diagnostics)) return entity;

  if (cursor.current().kind === "LBRACE") {
    parseBody(cursor, entity, cursor.advance(), diagnostics);
    return entity;
  }

  reportTrailing(cursor, diagnostics);
  return entity;
}
