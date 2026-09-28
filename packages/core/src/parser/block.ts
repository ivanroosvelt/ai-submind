import type { Token } from "../tokens.js";
import { describeToken, type TokenCursor, reportTrailing } from "./cursor.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { BlockKind, DiagramBlock, Edge, Ref } from "../ast.js";

function refOf(token: Token): Ref {
  return { name: token.value, range: token.range, target: null };
}

/**
 * `Edge ::= Ident "->" Ident (":" Text)?`, con el texto obligatorio en
 * `sequence`. Devuelve null si la línea no parsea (ya descartada).
 */
function parseEdgeLine(cursor: TokenCursor, kind: BlockKind, diagnostics: Diagnostic[]): Edge | null {
  const fromToken = cursor.current();
  if (fromToken.kind !== "IDENT") {
    diagnostics.push(
      diagnosticAt("E010", `se esperaba un identificador, se encontró '${describeToken(fromToken)}'`, fromToken.range)
    );
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  if (cursor.current().kind !== "ARROW") {
    diagnostics.push(diagnosticAt("E024", "se esperaba '->'", cursor.current().range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  const toToken = cursor.current();
  if (toToken.kind !== "IDENT") {
    diagnostics.push(diagnosticAt("E014", "se esperaba el id destino", toToken.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  let label: string | null = null;
  let end = toToken.range.end;
  if (cursor.current().kind === "COLON") {
    cursor.advance();
    const labelToken = cursor.readText("\n");
    if (!labelToken.value && kind === "sequence") {
      diagnostics.push(diagnosticAt("E027", "se esperaba el texto del mensaje", labelToken.range));
      cursor.skipToNextLine();
      return null;
    }
    label = labelToken.value || null;
    end = labelToken.range.end;
  } else if (kind === "sequence") {
    diagnostics.push(diagnosticAt("E026", "se esperaba ':' seguido del mensaje", cursor.current().range));
    cursor.skipToNextLine();
    return null;
  }

  reportTrailing(cursor, diagnostics);
  return {
    from: refOf(fromToken),
    to: refOf(toToken),
    label,
    range: { start: fromToken.range.start, end },
  };
}

/**
 * `Block ::= ("flow" | "sequence") Ident String? "{" Newline Edge* "}"`.
 * Precondición: el token actual es la palabra clave. Devuelve null si el
 * header no parsea (la línea ya fue descartada). Un `}` que falta no
 * descarta el bloque: se reporta E052 y se devuelve lo parseado.
 */
export function parseBlock(cursor: TokenCursor, diagnostics: Diagnostic[]): DiagramBlock | null {
  const keyword = cursor.advance();
  const kind = keyword.value as BlockKind;

  const nameToken = cursor.current();
  if (nameToken.kind !== "IDENT") {
    diagnostics.push(diagnosticAt("E050", `se esperaba el nombre del bloque '${kind}'`, nameToken.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();

  let title: string | null = null;
  if (cursor.current().kind === "STRING") title = cursor.advance().value;

  const open = cursor.current();
  if (open.kind !== "LBRACE") {
    diagnostics.push(diagnosticAt("E051", "se esperaba '{' para abrir el bloque", open.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();
  reportTrailing(cursor, diagnostics);
  cursor.skipNewlines();

  const edges: Edge[] = [];
  let end = open.range.end;
  for (;;) {
    const token = cursor.current();
    if (token.kind === "EOF") {
      diagnostics.push(diagnosticAt("E052", `falta '}' que cierra el bloque '${nameToken.value}'`, open.range));
      end = token.range.end;
      break;
    }
    if (token.kind === "RBRACE") {
      end = cursor.advance().range.end;
      reportTrailing(cursor, diagnostics);
      break;
    }
    const edge = parseEdgeLine(cursor, kind, diagnostics);
    if (edge) edges.push(edge);
    cursor.skipNewlines();
  }

  return {
    kind,
    name: nameToken.value,
    title,
    edges,
    range: { start: keyword.range.start, end },
    nameRange: nameToken.range,
  };
}
