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
        line: startToken.line,
        column: startToken.column,
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
          line: idToken.line,
          column: idToken.column,
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
            line: labelToken.line,
            column: labelToken.column,
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
          line: idToken.line,
          column: idToken.column,
          severity: "error",
        });
      } else {
        participants.push({ id: idToken.value, label, position: { line: idToken.line, column: idToken.column } });
      }
    } else {
      const fromToken = startToken;
      advance();
      if (current().kind !== "ARROW") {
        diagnostics.push({
          code: "E024",
          message: "se esperaba '->'",
          line: current().line,
          column: current().column,
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
          line: toToken.line,
          column: toToken.column,
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
          line: current().line,
          column: current().column,
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
          line: labelToken.line,
          column: labelToken.column,
          severity: "error",
        });
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      ensureParticipant(fromToken.value, fromToken.line, fromToken.column);
      ensureParticipant(toToken.value, toToken.line, toToken.column);
      messages.push({ from: fromToken.value, to: toToken.value, label: labelToken.value, position: { line: fromToken.line, column: fromToken.column } });
    }

    if (current().kind !== "EOF" && current().kind !== "NEWLINE") {
      diagnostics.push({
        code: "E016",
        message: "contenido inesperado al final de la línea",
        line: current().line,
        column: current().column,
        severity: "error",
      });
      skipToNextLine();
    }
    skipNewlines();
  }

  return { kind: "sequence", participants, messages };
}
