import type { Token } from "../tokens.js";
import type { Diagnostic } from "../diagnostics.js";
import type { SequenceDiagram, SequenceParticipant, SequenceMessage } from "../ast.js";

export function parseSequenceBody(
  tokens: Token[],
  diagnostics: Diagnostic[]
): SequenceDiagram {
  const participants: SequenceParticipant[] = [];
  const messages: SequenceMessage[] = [];
  let pos = 0;

  function current(): Token {
    return tokens[pos];
  }

  function advance(): Token {
    const token = tokens[pos];
    if (token.kind !== "EOF") pos += 1;
    return token;
  }

  function skipNewlines(): void {
    while (current().kind === "NEWLINE") advance();
  }

  function skipToNextLine(): void {
    while (current().kind !== "NEWLINE" && current().kind !== "EOF") advance();
    if (current().kind === "NEWLINE") advance();
  }

  function ensureParticipant(id: string, line: number, column: number): void {
    if (!participants.some((participant) => participant.id === id)) {
      participants.push({ id, label: id, position: { line, column } });
    }
  }

  skipNewlines();
  while (current().kind !== "EOF") {
    const startToken = current();

    if (startToken.kind !== "IDENT") {
      diagnostics.push({
        code: "E020",
        message: `se esperaba 'participant' o el id de un participante, se encontró '${startToken.value || startToken.kind}'`,
        line: startToken.range.start.line,
        column: startToken.range.start.column,
        severity: "error",
      });
      skipToNextLine();
      skipNewlines();
      continue;
    }

    if (startToken.value === "participant") {
      advance();
      const idToken = current();
      if (idToken.kind !== "IDENT") {
        diagnostics.push({
          code: "E021",
          message: "se esperaba el id del participante",
          line: idToken.range.start.line,
          column: idToken.range.start.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      let label = idToken.value;
      if (current().kind === "IDENT" && current().value === "as") {
        advance();
        const labelToken = current();
        if (labelToken.kind === "TEXT" && labelToken.value) {
          label = labelToken.value;
          advance();
        } else {
          diagnostics.push({
            code: "E022",
            message: "se esperaba el texto del alias después de 'as'",
            line: labelToken.range.start.line,
            column: labelToken.range.start.column,
            severity: "error",
          });
          skipToNextLine();
          skipNewlines();
          continue;
        }
      }
      const existing = participants.find((participant) => participant.id === idToken.value);
      if (existing) {
        diagnostics.push({
          code: "E023",
          message: `el participante '${idToken.value}' ya fue declarado`,
          line: idToken.range.start.line,
          column: idToken.range.start.column,
          severity: "error",
        });
      } else {
        participants.push({ id: idToken.value, label, position: { line: idToken.range.start.line, column: idToken.range.start.column } });
      }
    } else {
      const fromToken = startToken;
      advance();
      if (current().kind !== "ARROW") {
        diagnostics.push({
          code: "E024",
          message: "se esperaba '->'",
          line: current().range.start.line,
          column: current().range.start.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const toToken = current();
      if (toToken.kind !== "IDENT") {
        diagnostics.push({
          code: "E025",
          message: "se esperaba el id del participante destino",
          line: toToken.range.start.line,
          column: toToken.range.start.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      if (current().kind !== "COLON") {
        diagnostics.push({
          code: "E026",
          message: "se esperaba ':' seguido del mensaje",
          line: current().range.start.line,
          column: current().range.start.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const labelToken = current();
      if (labelToken.kind !== "TEXT" || !labelToken.value) {
        diagnostics.push({
          code: "E027",
          message: "se esperaba el texto del mensaje",
          line: labelToken.range.start.line,
          column: labelToken.range.start.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      ensureParticipant(fromToken.value, fromToken.range.start.line, fromToken.range.start.column);
      ensureParticipant(toToken.value, toToken.range.start.line, toToken.range.start.column);
      messages.push({ from: fromToken.value, to: toToken.value, label: labelToken.value, position: { line: fromToken.range.start.line, column: fromToken.range.start.column } });
    }

    if (current().kind !== "EOF" && current().kind !== "NEWLINE") {
      diagnostics.push({
        code: "E016",
        message: "contenido inesperado al final de la línea",
        line: current().range.start.line,
        column: current().range.start.column,
        severity: "error",
      });
      skipToNextLine();
    }
    skipNewlines();
  }

  return { kind: "sequence", participants, messages };
}
