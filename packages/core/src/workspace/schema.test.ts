import { describe, it, expect } from "vitest";
import { parseSchema } from "./schema.js";
import type { Diagnostic } from "../diagnostics.js";

function codes(diagnostics: Diagnostic[]) {
  return diagnostics.map((d) => [d.code, d.range.start.line, d.range.start.column]);
}

describe("parseSchema", () => {
  it("reads both vocabularies", () => {
    const { schema, diagnostics } = parseSchema("type_tags: [decision, architecture]\nrelation_types: [affects]\n");
    expect(diagnostics).toEqual([]);
    expect([...schema!.typeTags]).toEqual(["decision", "architecture"]);
    expect([...schema!.relationTypes]).toEqual(["affects"]);
  });

  it("reports structural problems as E068, sorted, and yields no schema", () => {
    const { schema, diagnostics } = parseSchema("type_tags: decision\nextra: 1\n");
    expect(schema).toBeNull();
    expect(codes(diagnostics)).toEqual([
      ["E068", 1, 1], // falta 'relation_types'
      ["E068", 1, 12], // 'type_tags' no es lista
      ["E068", 2, 1], // clave desconocida
    ]);
  });

  it("reports non-identifier values and an empty file as E068", () => {
    expect(codes(parseSchema("type_tags: [ok, 3]\nrelation_types: []\n").diagnostics)).toEqual([["E068", 1, 17]]);
    expect(codes(parseSchema("").diagnostics)).toEqual([["E068", 1, 1]]);
  });

  it("reports YAML syntax errors as E061", () => {
    const { schema, diagnostics } = parseSchema("type_tags: [a\n");
    expect(schema).toBeNull();
    expect(diagnostics.map((d) => d.code)).toEqual(["E061"]);
  });
});
