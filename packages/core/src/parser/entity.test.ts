import { describe, it, expect } from "vitest";
import { Lexer } from "../lexer.js";
import { TokenCursor } from "./cursor.js";
import { parseEntity } from "./entity.js";
import type { Diagnostic } from "../diagnostics.js";

function parseEntitySource(source: string) {
  const lexer = new Lexer(source);
  const cursor = new TokenCursor(lexer);
  const diagnostics: Diagnostic[] = [];
  const entity = parseEntity(cursor, "catalog.flo", diagnostics);
  diagnostics.push(...lexer.diagnostics);
  return { entity, diagnostics, next: cursor.current() };
}

describe("parseEntity", () => {
  it("parses the short form with shape and properties, with exact ranges", () => {
    const { entity, diagnostics } = parseEntitySource(
      "entity Api [API Gateway] type: service, tags: http internal\n"
    );
    expect(diagnostics).toEqual([]);
    expect(entity).toEqual({
      id: "Api",
      label: "API Gateway",
      shape: "rectangle",
      type: "service",
      tags: ["http", "internal"],
      uri: "catalog.flo",
      range: { start: { line: 1, column: 1 }, end: { line: 1, column: 60 } },
      nameRange: { start: { line: 1, column: 8 }, end: { line: 1, column: 11 } },
      knowledge: null,
    });
  });

  it("maps the three delimiters to the three shapes", () => {
    expect(parseEntitySource("entity a [A]\n").entity?.shape).toBe("rectangle");
    expect(parseEntitySource("entity a (A)\n").entity?.shape).toBe("rounded");
    expect(parseEntitySource("entity a {A}\n").entity?.shape).toBe("decision");
  });

  it("defaults to a rectangle labelled with its id when there is no shape", () => {
    const { entity, diagnostics } = parseEntitySource("entity Cache\n");
    expect(diagnostics).toEqual([]);
    expect(entity).toMatchObject({ id: "Cache", label: "Cache", shape: "rectangle", type: null, tags: [] });
  });

  it("parses the body form after a shape", () => {
    const { entity, diagnostics, next } = parseEntitySource(
      "entity Worker [Job Runner] {\n  type: service\n\n  tags: async internal\n}\nentity Next\n"
    );
    expect(diagnostics).toEqual([]);
    expect(entity).toMatchObject({ label: "Job Runner", type: "service", tags: ["async", "internal"] });
    expect(entity?.range.end).toEqual({ line: 5, column: 2 });
    expect(next).toMatchObject({ kind: "NEWLINE" });
  });

  it("reads '{' as a body (not a decision) when the rest of the line is blank or a comment", () => {
    const body = parseEntitySource("entity Worker {\n  type: service\n}\n");
    expect(body.diagnostics).toEqual([]);
    expect(body.entity).toMatchObject({ shape: "rectangle", label: "Worker", type: "service" });

    const commented = parseEntitySource("entity Worker { // metadatos\n  type: service\n}\n");
    expect(commented.diagnostics).toEqual([]);
    expect(commented.entity?.type).toBe("service");

    const decision = parseEntitySource("entity Ok {¿Válido?}\n");
    expect(decision.diagnostics).toEqual([]);
    expect(decision.entity).toMatchObject({ shape: "decision", label: "¿Válido?" });
  });

  it("reports E034 for an unknown property and still returns the entity", () => {
    const { entity, diagnostics } = parseEntitySource("entity a [A] owner: team, type: store\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E034"]);
    expect(diagnostics[0].range.start).toEqual({ line: 1, column: 14 });
    expect(entity?.type).toBe("store");
  });

  it("reports E044 for a repeated property, keeping the first value", () => {
    const { entity, diagnostics } = parseEntitySource("entity a [A] type: x {\n  type: y\n}\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E044"]);
    expect(entity?.type).toBe("x");
  });

  it("reports E042 for a missing ':' and E043 for a missing value", () => {
    expect(parseEntitySource("entity a type service\n").diagnostics.map((d) => d.code)).toEqual(["E042"]);
    expect(parseEntitySource("entity a type:\n").diagnostics.map((d) => d.code)).toEqual(["E043"]);
  });

  it("accepts exactly one identifier for type (a second one is trailing content)", () => {
    const { diagnostics } = parseEntitySource("entity a type: x y\n");
    expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
  });

  it("reports E041 and returns null when the id is missing", () => {
    const { entity, diagnostics } = parseEntitySource("entity [A]\n");
    expect(entity).toBeNull();
    expect(diagnostics.map((d) => d.code)).toEqual(["E041"]);
  });

  it("reports E011 for an empty shape and E045 for an unclosed body, returning the entity in both cases", () => {
    const empty = parseEntitySource("entity a []\n");
    expect(empty.diagnostics.map((d) => d.code)).toEqual(["E011"]);
    expect(empty.entity?.id).toBe("a");

    const unclosed = parseEntitySource("entity a {\n  type: x\n");
    expect(unclosed.diagnostics.map((d) => d.code)).toEqual(["E045"]);
    expect(unclosed.diagnostics[0].range.start).toEqual({ line: 1, column: 10 });
    expect(unclosed.entity?.type).toBe("x");
  });
});
