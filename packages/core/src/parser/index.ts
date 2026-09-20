import { tokenize } from "../lexer.js";
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
  const { tokens, diagnostics: lexDiagnostics } = tokenize(source);
  const diagnostics: Diagnostic[] = [...lexDiagnostics];

  let pos = 0;
  function current() {
    return tokens[pos];
  }
  function advance() {
    const token = tokens[pos];
    if (token.kind !== "EOF") pos += 1;
    return token;
  }

  while (current().kind === "NEWLINE") advance();

  if (current().kind === "EOF") {
    diagnostics.push(
      diagnosticAt("E003", "el archivo está vacío, se esperaba 'diagram <tipo>'", {
        start: { line: 1, column: 1 },
        end: { line: 1, column: 1 },
      })
    );
    return { diagram: null, diagnostics };
  }

  const keywordToken = current();
  if (keywordToken.kind !== "IDENT" || keywordToken.value !== "diagram") {
    diagnostics.push(
      diagnosticAt("E004", "se esperaba 'diagram' al inicio del archivo", keywordToken.range)
    );
    return { diagram: null, diagnostics };
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
    return { diagram: null, diagnostics };
  }
  advance();

  if (current().kind !== "NEWLINE" && current().kind !== "EOF") {
    diagnostics.push(
      diagnosticAt("E006", "contenido inesperado después del tipo de diagrama", current().range)
    );
    return { diagram: null, diagnostics };
  }
  if (current().kind === "NEWLINE") advance();

  const bodyTokens = tokens.slice(pos);
  const diagram =
    kindToken.value === "flowchart"
      ? parseFlowchartBody(bodyTokens, diagnostics)
      : parseSequenceBody(bodyTokens, diagnostics);
  return { diagram, diagnostics };
}
