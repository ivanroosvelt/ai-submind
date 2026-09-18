import { tokenize } from "../lexer";
import { parseFlowchartBody } from "./flowchart";
import { parseSequenceBody } from "./sequence";
import type { Diagram } from "../ast";
import type { Diagnostic } from "../diagnostics";

export interface ParseResult {
  diagram: Diagram | null;
  diagnostics: Diagnostic[];
}

export function parse(source: string): ParseResult {
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
      line: keywordToken.line,
      column: keywordToken.column,
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
      line: kindToken.line,
      column: kindToken.column,
      severity: "error",
    });
    return { diagram: null, diagnostics };
  }
  advance();

  if (current().kind !== "NEWLINE" && current().kind !== "EOF") {
    diagnostics.push({
      code: "E006",
      message: "contenido inesperado después del tipo de diagrama",
      line: current().line,
      column: current().column,
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
