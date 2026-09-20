import type { Token } from "../tokens.js";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { Range, SequenceDiagram, SequenceParticipant, SequenceMessage } from "../ast.js";

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

  function ensureParticipant(id: string, range: Range): void {
    if (!participants.some((participant) => participant.id === id)) {
      participants.push({ id, label: id, range, nameRange: range });
    }
  }

  skipNewlines();
  while (current().kind !== "EOF") {
    const startToken = current();

    if (startToken.kind !== "IDENT") {
      diagnostics.push(
        diagnosticAt(
          "E020",
          `se esperaba 'participant' o el id de un participante, se encontró '${startToken.value || startToken.kind}'`,
          startToken.range
        )
      );
      skipToNextLine();
      skipNewlines();
      continue;
    }

    if (startToken.value === "participant") {
      advance();
      const idToken = current();
      if (idToken.kind !== "IDENT") {
        diagnostics.push(
          diagnosticAt("E021", "se esperaba el id del participante", idToken.range)
        );
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      let label = idToken.value;
      let lastConsumedRange = idToken.range;
      if (current().kind === "IDENT" && current().value === "as") {
        advance();
        const labelToken = current();
        if (labelToken.kind === "TEXT" && labelToken.value) {
          label = labelToken.value;
          lastConsumedRange = labelToken.range;
          advance();
        } else {
          diagnostics.push(
            diagnosticAt(
              "E022",
              "se esperaba el texto del alias después de 'as'",
              labelToken.range
            )
          );
          skipToNextLine();
          skipNewlines();
          continue;
        }
      }
      const existing = participants.find((participant) => participant.id === idToken.value);
      if (existing) {
        diagnostics.push(
          diagnosticAt(
            "E023",
            `el participante '${idToken.value}' ya fue declarado`,
            idToken.range
          )
        );
      } else {
        participants.push({
          id: idToken.value,
          label,
          range: { start: idToken.range.start, end: lastConsumedRange.end },
          nameRange: idToken.range,
        });
      }
    } else {
      const fromToken = startToken;
      advance();
      if (current().kind !== "ARROW") {
        diagnostics.push(diagnosticAt("E024", "se esperaba '->'", current().range));
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const toToken = current();
      if (toToken.kind !== "IDENT") {
        diagnostics.push(
          diagnosticAt("E025", "se esperaba el id del participante destino", toToken.range)
        );
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      if (current().kind !== "COLON") {
        diagnostics.push(
          diagnosticAt("E026", "se esperaba ':' seguido del mensaje", current().range)
        );
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      const labelToken = current();
      if (labelToken.kind !== "TEXT" || !labelToken.value) {
        diagnostics.push(
          diagnosticAt("E027", "se esperaba el texto del mensaje", labelToken.range)
        );
        skipToNextLine();
        skipNewlines();
        continue;
      }
      advance();
      ensureParticipant(fromToken.value, fromToken.range);
      ensureParticipant(toToken.value, toToken.range);
      messages.push({
        from: fromToken.value,
        to: toToken.value,
        label: labelToken.value,
        range: { start: fromToken.range.start, end: labelToken.range.end },
        fromRange: fromToken.range,
        toRange: toToken.range,
      });
    }

    if (current().kind !== "EOF" && current().kind !== "NEWLINE") {
      diagnostics.push(
        diagnosticAt("E016", "contenido inesperado al final de la línea", current().range)
      );
      skipToNextLine();
    }
    skipNewlines();
  }

  return { kind: "sequence", participants, messages };
}
