import { tokenize } from "../lexer.js";
import { parseFlowchartBody } from "./flowchart.js";
import { parseSequenceBody } from "./sequence.js";
import type { Diagram } from "../ast.js";
import type { Diagnostic } from "../diagnostics.js";

export interface ParseResult {
  diagram: Diagram | null;
  diagnostics: Diagnostic[];
}

function sortDiagnosticsByPosition(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
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
    diagnostics.push({
      code: "E003",
      message: "el archivo está vacío, se esperaba 'diagram <tipo>'",
      line: 1,
      column: 1,
      severity: "error",
    });
    return { diagram: null, diagnostics };
  }

  const keywordToken = current();
  if (keywordToken.kind !== "IDENT" || keywordToken.value !== "diagram") {
    diagnostics.push({
      code: "E004",
      message: "se esperaba 'diagram' al inicio del archivo",
      line: keywordToken.range.start.line,
      column: keywordToken.range.start.column,
      severity: "error",
    });
    return { diagram: null, diagnostics };
  }
  advance();

  const kindToken = current();
  if (kindToken.kind !== "IDENT" || (kindToken.value !== "flowchart" && kindToken.value !== "sequence")) {
    diagnostics.push({
      code: "E005",
      message: "se esperaba 'flowchart' o 'sequence' después de 'diagram'",
      line: kindToken.range.start.line,
      column: kindToken.range.start.column,
      severity: "error",
    });
    return { diagram: null, diagnostics };
  }
  advance();

  if (current().kind !== "NEWLINE" && current().kind !== "EOF") {
    diagnostics.push({
      code: "E006",
      message: "contenido inesperado después del tipo de diagrama",
      line: current().range.start.line,
      column: current().range.start.column,
      severity: "error",
    });
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
