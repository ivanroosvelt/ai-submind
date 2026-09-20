import { Lexer } from "../lexer.js";
import type { Token } from "../tokens.js";
import { parseFlowchartBody } from "./flowchart.js";
import { parseSequenceBody } from "./sequence.js";
import type { Diagram } from "../ast.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";

export interface ParseResult {
  diagram: Diagram | null;
  diagnostics: Diagnostic[];
}

function sortDiagnosticsByPosition(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column
  );
}

export function parse(source: string): ParseResult {
  const result = parseUnsorted(source);
  sortDiagnosticsByPosition(result.diagnostics);
  return result;
}

function parseUnsorted(source: string): ParseResult {
  const lexer = new Lexer(source);
  const diagnostics: Diagnostic[] = [];

  let buffered: Token | null = null;
  function current(): Token {
    if (buffered === null) buffered = lexer.next();
    return buffered;
  }
  function advance(): Token {
    const token = current();
    if (token.kind !== "EOF") buffered = null;
    return token;
  }

  function finish(diagram: Diagram | null): ParseResult {
    diagnostics.push(...lexer.diagnostics);
    return { diagram, diagnostics };
  }

  while (current().kind === "NEWLINE") advance();

  if (current().kind === "EOF") {
    diagnostics.push(
      diagnosticAt("E003", "el archivo está vacío, se esperaba 'diagram <tipo>'", {
        start: { line: 1, column: 1 },
        end: { line: 1, column: 1 },
      })
    );
    return finish(null);
  }

  const keywordToken = current();
  if (keywordToken.kind !== "IDENT" || keywordToken.value !== "diagram") {
    diagnostics.push(
      diagnosticAt("E004", "se esperaba 'diagram' al inicio del archivo", keywordToken.range)
    );
    return finish(null);
  }
  advance();

  const kindToken = current();
  if (kindToken.kind !== "IDENT" || (kindToken.value !== "flowchart" && kindToken.value !== "sequence")) {
    diagnostics.push(
      diagnosticAt(
        "E005",
        "se esperaba 'flowchart' o 'sequence' después de 'diagram'",
        kindToken.range
      )
    );
    return finish(null);
  }
  advance();

  if (current().kind !== "NEWLINE" && current().kind !== "EOF") {
    diagnostics.push(
      diagnosticAt("E006", "contenido inesperado después del tipo de diagrama", current().range)
    );
    return finish(null);
  }
  if (current().kind === "NEWLINE") advance();

  const diagram =
    kindToken.value === "flowchart"
      ? parseFlowchartBody(lexer, diagnostics)
      : parseSequenceBody(lexer, diagnostics);
  return finish(diagram);
}
