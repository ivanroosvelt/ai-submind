import { Lexer } from "../lexer.js";
import type { Token } from "../tokens.js";
import { TokenCursor, describeToken, reportTrailing } from "./cursor.js";
import { parseEntity } from "./entity.js";
import { parseBlock } from "./block.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument, UseDecl } from "../ast.js";

function topLevelMessage(token: Token): string {
  if (token.kind === "IDENT" && token.value === "diagram") {
    return "el header 'diagram <tipo>' ya no existe: declara entidades con 'entity' y diagramas con 'flow <nombre> { ... }' o 'sequence <nombre> { ... }'";
  }
  return `se esperaba 'entity', 'flow', 'sequence' o 'use', se encontró '${describeToken(token)}'`;
}

/** `Use ::= "use" String Newline`. Devuelve null si la línea no parsea (ya descartada). */
function parseUse(cursor: TokenCursor, diagnostics: Diagnostic[]): UseDecl | null {
  const keyword = cursor.advance();
  const pathToken = cursor.current();
  if (pathToken.kind !== "STRING") {
    diagnostics.push(diagnosticAt("E046", "se esperaba la ruta entre comillas después de 'use'", pathToken.range));
    cursor.skipToNextLine();
    return null;
  }
  cursor.advance();
  reportTrailing(cursor, diagnostics);
  return {
    path: pathToken.value,
    range: { start: keyword.range.start, end: pathToken.range.end },
    pathRange: pathToken.range,
  };
}

/**
 * `Document ::= (BlankLine | Use | EntityDecl | Block)* EOF`. Las palabras
 * clave solo son especiales aquí, al inicio de una línea de nivel superior.
 *
 * Una racha de líneas inválidas consecutivas produce un solo E040 (en la
 * primera): así un archivo en la sintaxis vieja o el cuerpo huérfano de un
 * bloque cuyo header falló no generan un error por línea. La racha la corta
 * el siguiente statement válido.
 */
export function parseDocument(
  source: string,
  uri: DocumentUri
): { document: ParsedDocument; diagnostics: Diagnostic[] } {
  // Editores de Windows escriben BOM al guardar (#51, como en un .md): se
  // descarta, y las columnas de la línea 1 son las que ve el editor.
  const lexer = new Lexer(source.replace(/^\uFEFF/, ""));
  const cursor = new TokenCursor(lexer);
  const diagnostics: Diagnostic[] = [];
  const document: ParsedDocument = { uri, uses: [], entities: [], blocks: [] };
  let inErrorRun = false;

  cursor.skipNewlines();
  while (cursor.current().kind !== "EOF") {
    const token = cursor.current();
    const keyword = token.kind === "IDENT" ? token.value : null;

    if (keyword === "entity") {
      const entity = parseEntity(cursor, uri, diagnostics);
      if (entity) document.entities.push(entity);
      inErrorRun = entity === null;
    } else if (keyword === "flow" || keyword === "sequence") {
      const block = parseBlock(cursor, diagnostics);
      if (block) document.blocks.push(block);
      inErrorRun = block === null;
    } else if (keyword === "use") {
      const use = parseUse(cursor, diagnostics);
      if (use) document.uses.push(use);
      inErrorRun = use === null;
    } else {
      if (!inErrorRun) diagnostics.push(diagnosticAt("E040", topLevelMessage(token), token.range));
      inErrorRun = true;
      cursor.skipToNextLine();
    }
    cursor.skipNewlines();
  }

  diagnostics.push(...lexer.diagnostics);
  return { document, diagnostics };
}
