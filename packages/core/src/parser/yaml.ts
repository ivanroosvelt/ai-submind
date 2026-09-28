import { LineCounter, parseDocument as parseYaml } from "yaml";
import { diagnosticAt, type Diagnostic } from "../diagnostics.js";
import type { Position, Range } from "../ast.js";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/; // la misma regla que el IDENT del lexer

export function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENT.test(value);
}

export interface YamlSource {
  contents: unknown;
  /** Rango de un nodo (sin comentarios de cola); el de `fallback` si el nodo falta o está vacío. */
  rangeOf(node: unknown, fallback?: unknown): Range;
  /** Errores de sintaxis del YAML (E061). */
  diagnostics: Diagnostic[];
}

type YamlSpan = { range?: [number, number, number] | null } | null | undefined;

/** `text` empieza en la línea `firstLine` del archivo, columna 1. */
export function parseYamlSource(text: string, firstLine: number): YamlSource {
  const lineCounter = new LineCounter();
  const doc = parseYaml(text, { lineCounter });

  const position = (offset: number): Position => {
    const { line, col } = lineCounter.linePos(offset);
    return { line: line + firstLine - 1, column: col };
  };
  const span = (node: unknown): [number, number] | null => {
    const range = (node as YamlSpan)?.range;
    return range && range[1] > range[0] ? [range[0], range[1]] : null;
  };

  return {
    contents: doc.contents,
    rangeOf(node, fallback) {
      const [start, end] = span(node) ?? span(fallback) ?? [0, 0];
      return { start: position(start), end: position(end) };
    },
    diagnostics: doc.errors.map((error) =>
      diagnosticAt("E061", `error de sintaxis YAML: ${yamlMessage(error.message)}`, {
        start: position(error.pos[0]),
        end: position(error.pos[1]),
      })
    ),
  };
}

// Los mensajes de `yaml` traen la posición y un extracto del fuente; el
// Range ya lleva la posición.
function yamlMessage(message: string): string {
  return message.split("\n")[0].replace(/ at line \d+, column \d+:?$/, "");
}
