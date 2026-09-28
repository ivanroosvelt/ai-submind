import { Lexer } from "../lexer.js";
import type { Token } from "../tokens.js";
import { TokenCursor, describeToken } from "./cursor.js";
import { parseEntity } from "./entity.js";
import { parseBlock } from "./block.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { DocumentUri, ParsedDocument } from "../ast.js";

function topLevelMessage(token: Token): string {
  if (token.kind === "IDENT" && token.value === "diagram") {
    return "el header 'diagram <tipo>' ya no existe: declara entidades con 'entity' y diagramas con 'flow <nombre> { ... }' o 'sequence <nombre> { ... }'";
  }
  return `se esperaba 'entity', 'flow' o 'sequence', se encontró '${describeToken(token)}'`;
}

/**
 * `Document ::= (BlankLine | EntityDecl | Block)* EOF`. Las palabras clave
 * solo son especiales aquí, al inicio de una línea de nivel superior.
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
  const lexer = new Lexer(source);
  const cursor = new TokenCursor(lexer);
  const diagnostics: Diagnostic[] = [];
  const document: ParsedDocument = { uri, entities: [], blocks: [] };
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
