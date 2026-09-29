import { describe, it, expect } from "vitest";
import { Workspace } from "./workspace.js";
import { SCHEMA_URI } from "./schema.js";
import type { Diagnostic } from "../diagnostics.js";

const catalog = "entity usuario (Usuario)\nentity api [API Gateway]\nentity db [Base de datos]\n";
const login = [
  'use "./catalogo.flo"',
  "entity pantalla [Login]",
  'flow acceso "Inicio de sesión" {',
  "  usuario -> pantalla",
  "  pantalla -> api : POST /login",
  "  api -> db",
  "}",
  "",
].join("\n");
const admin = 'use "../catalogo.flo"\nsequence alta {\n  usuario -> api : crear\n  api -> db : INSERT\n}\n';

function workspace(files: Record<string, string>): Workspace {
  const ws = new Workspace();
  for (const [uri, source] of Object.entries(files)) ws.setDocument(uri, source);
  return ws;
}

function codes(diagnostics: Diagnostic[] | undefined) {
  return (diagnostics ?? []).map((d) => [d.code, d.range.start.line, d.range.start.column]);
}

describe("Workspace", () => {
  const files = { "catalogo.flo": catalog, "login.flo": login, "admin/alta.flo": admin };

  it("links a set of documents that share a catalog", () => {
    const result = workspace(files).link();
    for (const list of result.diagnostics.values()) expect(list).toEqual([]);
    expect([...result.documents.keys()]).toEqual(["admin/alta.flo", "catalogo.flo", "login.flo"]);
    expect([...result.documents.get("login.flo")!.catalog.keys()]).toEqual(["usuario", "api", "db", "pantalla"]);
    expect([...result.documents.get("admin/alta.flo")!.catalog.keys()]).toEqual(["usuario", "api", "db"]);
    expect(result.xref.flowsUsing("db")).toEqual(["admin/alta.flo#alta", "login.flo#acceso"]);
    expect(result.xref.definitionOf("api")?.uri).toBe("catalogo.flo");
    expect(result.xref.referencesTo("usuario")).toHaveLength(2);
  });

  it("does not depend on the order documents were added", () => {
    const forward = workspace(files).link();
    const backward = workspace(Object.fromEntries(Object.entries(files).reverse())).link();
    expect([...backward.documents.keys()]).toEqual([...forward.documents.keys()]);
    expect([...backward.entities.keys()]).toEqual([...forward.entities.keys()]);
    expect([...backward.diagnostics.entries()]).toEqual([...forward.diagnostics.entries()]);
  });

  it("merges lexer, parser and resolver diagnostics per document, sorted by position", () => {
    const result = workspace({ "a.flo": 'use "./nope.flo"\nflow f {\n  a -> ghost\n  start ->\n}\n@\nentity a\n' }).link();
    expect(codes(result.diagnostics.get("a.flo"))).toEqual([
      ["E032", 1, 5],
      ["E030", 3, 8],
      ["E014", 4, 11],
      ["E002", 6, 1],
    ]);
  });

  it("reports E032 and E030 in the next link after a used document is removed", () => {
    const ws = workspace(files);
    ws.removeDocument("catalogo.flo");
    const result = ws.link();
    expect(result.documents.has("catalogo.flo")).toBe(false);
    expect(codes(result.diagnostics.get("login.flo"))).toEqual([
      ["E032", 1, 5],
      ["E030", 4, 3],
      ["E030", 5, 15],
      ["E030", 6, 3],
      ["E030", 6, 10],
    ]);
    expect(result.xref.definitionOf("db")).toBeNull();
  });

  it("re-links from scratch after setDocument replaces a document: stale targets are cleared", () => {
    const ws = workspace(files);
    const before = ws.link().documents.get("login.flo")!.document.blocks[0].edges[2];
    expect(before.to.target).toBe("db");

    ws.setDocument("catalogo.flo", "entity usuario (Usuario)\nentity api [API Gateway]\n");
    const result = ws.link();
    const after = result.documents.get("login.flo")!.document.blocks[0].edges[2];
    expect(after.to.target).toBeNull();
    expect(result.diagnostics.get("login.flo")!.map((d) => d.code)).toEqual(["E030"]);
    expect(result.xref.flowsUsing("db")).toEqual([]);
  });
});

const SCHEMA = "type_tags: [decision]\nrelation_types: [affects]\n";
const note = (id: string, extra: string[] = []) =>
  ["---", `id: ${id}`, `title: ${id}`, "memory_type: long_term", ...extra, "---", ""].join("\n");

describe("Workspace with .md documents", () => {
  it("lets a flow use the entity of a .md, transitively through its 'use:'", () => {
    const result = workspace({
      [SCHEMA_URI]: SCHEMA,
      "catalogo.flo": "entity api\n",
      "notas/pkce.md": note("pkce", ['use: ["../catalogo.flo"]']),
      "flujo.flo": 'use "./notas/pkce.md"\nflow f {\n  pkce -> api\n}\n',
    }).link();
    for (const list of result.diagnostics.values()) expect(list).toEqual([]);
    expect([...result.documents.keys()]).toEqual(["catalogo.flo", "flujo.flo", "notas/pkce.md"]);
    expect([...result.documents.get("flujo.flo")!.catalog.keys()]).toEqual(["api", "pkce"]);
    expect(result.xref.flowsUsing("pkce")).toEqual(["flujo.flo#f"]);
    expect(result.diagnostics.get(SCHEMA_URI)).toEqual([]);
  });

  it("does not cascade from a partially invalid frontmatter", () => {
    const result = workspace({
      [SCHEMA_URI]: SCHEMA,
      "n.md": "---\nid: n\ntitle: 3\nmemory_type: nope\n---\n",
      "f.flo": 'use "./n.md"\nflow f {\n  n -> n\n}\n',
    }).link();
    expect(codes(result.diagnostics.get("n.md"))).toEqual([
      ["E063", 3, 8],
      ["E064", 4, 14],
    ]);
    expect(result.diagnostics.get("f.flo")).toEqual([]);
  });

  it("validates type_tags and relation types against the schema", () => {
    const result = workspace({
      [SCHEMA_URI]: SCHEMA,
      "catalogo.flo": "entity api\n",
      "n.md": note("n", [
        "type_tags: [decision, nope]", // 5
        'use: ["./catalogo.flo"]', // 6
        "relations:", // 7
        "  - target: api", // 8
        "    type: breaks", // 9
      ]),
    }).link();
    expect(codes(result.diagnostics.get("n.md"))).toEqual([
      ["E065", 5, 23],
      ["E066", 9, 11],
    ]);
  });

  it("reports a single E068 on the first .md when there is no schema, and skips vocabulary", () => {
    const result = workspace({
      "b.md": note("b", ["type_tags: [whatever]"]),
      "a.md": note("a", ["type_tags: [whatever]"]),
    }).link();
    expect(codes(result.diagnostics.get("a.md"))).toEqual([["E068", 1, 1]]);
    expect(result.diagnostics.get("b.md")).toEqual([]);
    expect(result.diagnostics.has(SCHEMA_URI)).toBe(false);
  });

  it("does not let clearing a link() result's schema diagnostics corrupt the next link()", () => {
    const ws = workspace({ [SCHEMA_URI]: "type_tags: x\nrelation_types: []\n", "a.md": note("a") });
    ws.link().diagnostics.get(SCHEMA_URI)!.length = 0;
    const second = ws.link();
    expect(codes(second.diagnostics.get(SCHEMA_URI))).toEqual([["E068", 1, 12]]);
  });

  it("reports an invalid schema on the schema document only", () => {
    const result = workspace({
      [SCHEMA_URI]: "type_tags: x\nrelation_types: []\n",
      "a.md": note("a", ["type_tags: [whatever]"]),
    }).link();
    expect(codes(result.diagnostics.get(SCHEMA_URI))).toEqual([["E068", 1, 12]]);
    expect(result.diagnostics.get("a.md")).toEqual([]);
    expect(result.documents.has(SCHEMA_URI)).toBe(false);
  });

  it("brings E068 back after the schema is removed", () => {
    const ws = workspace({ [SCHEMA_URI]: SCHEMA, "a.md": note("a") });
    expect(ws.link().diagnostics.get("a.md")).toEqual([]);
    ws.removeDocument(SCHEMA_URI);
    const result = ws.link();
    expect(codes(result.diagnostics.get("a.md"))).toEqual([["E068", 1, 1]]);
    expect(result.diagnostics.has(SCHEMA_URI)).toBe(false);
  });

  it("ignores a .md without frontmatter, also when an existing one loses it", () => {
    const ws = workspace({
      [SCHEMA_URI]: SCHEMA,
      "README.md": "# hola\n",
      "n.md": note("n"),
      "f.flo": 'use "./n.md"\nflow f {\n  n -> n\n}\n',
    });
    expect(ws.link().documents.has("README.md")).toBe(false);
    ws.setDocument("n.md", "# ya no tiene frontmatter\n");
    const result = ws.link();
    expect(result.documents.has("n.md")).toBe(false);
    expect(result.diagnostics.has("n.md")).toBe(false);
    expect(codes(result.diagnostics.get("f.flo")).map(([code]) => code)).toEqual(["E032", "E030", "E030"]);
  });
});

describe("Workspace relations", () => {
  const RELATIONS_SCHEMA = "type_tags: [decision]\nrelation_types: [enforces, visualized_by, affects]\n";
  const pkce = [
    "---", // 1
    "id: pkce", // 2
    "title: PKCE", // 3
    "memory_type: long_term", // 4
    "relations:", // 5
    "  - target: ../reglas/passwords.md", // 6
    "    type: enforces", // 7
    "  - target: ../flujos/auth.flo#acceso", // 8
    "    type: visualized_by", // 9
    "  - target: api", // 10  alcanzable solo vía el use implícito de flujos/auth.flo
    "    type: affects", // 11
    "  - target: ../flujos/auth.flo", // 12  .flo sin #bloque
    "    type: affects", // 13
    "  - target: ../flujos/auth.flo#nope", // 14
    "    type: affects", // 15
    "  - target: fantasma", // 16
    "    type: affects", // 17
    "---",
    "",
  ].join("\n");
  const files = {
    [SCHEMA_URI]: RELATIONS_SCHEMA,
    "catalogo.flo": "entity api\nentity auth\n",
    "flujos/auth.flo": 'use "../catalogo.flo"\nflow acceso {\n  api -> auth\n}\n',
    "reglas/passwords.md": note("br_passwords"),
    "decisiones/pkce.md": pkce,
  };

  it("resolves the three target forms and reports the rest as E035", () => {
    const result = workspace(files).link();
    expect(codes(result.diagnostics.get("decisiones/pkce.md"))).toEqual([
      ["E035", 12, 13],
      ["E035", 14, 13],
      ["E035", 16, 13],
    ]);
    const relations = result.entities.get("pkce")!.knowledge!.relations;
    expect(relations.map((relation) => relation.resolved)).toEqual([
      { kind: "entity", id: "br_passwords" },
      { kind: "block", id: "flujos/auth.flo#acceso" },
      { kind: "entity", id: "api" },
      null,
      null,
      null,
    ]);
    // Post-orden DFS de los use implícitos, en orden de aparición (decisión #24).
    expect([...result.documents.get("decisiones/pkce.md")!.catalog.keys()]).toEqual([
      "br_passwords",
      "api",
      "auth",
      "pkce",
    ]);
  });

  it("indexes relations both ways; only the id form counts as a reference", () => {
    const { xref } = workspace(files).link();
    expect(xref.relationsFrom("pkce")).toHaveLength(6);
    expect(xref.relationsFrom("api")).toEqual([]);
    expect(xref.relationsTo("api").map(({ from, relation }) => [from, relation.target])).toEqual([["pkce", "api"]]);
    expect(xref.relationsTo("br_passwords").map(({ from }) => from)).toEqual(["pkce"]);
    expect(xref.referencesTo("api")).toEqual([
      {
        uri: "decisiones/pkce.md",
        range: { start: { line: 10, column: 13 }, end: { line: 10, column: 16 } },
      },
      {
        uri: "flujos/auth.flo",
        range: { start: { line: 3, column: 3 }, end: { line: 3, column: 6 } },
      },
    ]);
    expect(xref.referencesTo("br_passwords")).toEqual([]);
  });

  it("accepts relation cycles between .md documents", () => {
    const result = workspace({
      [SCHEMA_URI]: RELATIONS_SCHEMA,
      "a.md": note("a", ["relations:", "  - target: ./b.md", "    type: affects"]),
      "b.md": note("b", ["relations:", "  - target: ./a.md", "    type: affects"]),
    }).link();
    for (const list of result.diagnostics.values()) expect(list).toEqual([]);
    expect(result.xref.relationsTo("a").map(({ from }) => from)).toEqual(["b"]);
    expect(result.xref.relationsTo("b").map(({ from }) => from)).toEqual(["a"]);
  });

  it("reports E032 for a missing 'use:' path in a .md", () => {
    const result = workspace({ [SCHEMA_URI]: RELATIONS_SCHEMA, "x.md": note("x", ['use: ["./nope.flo"]']) }).link();
    expect(codes(result.diagnostics.get("x.md"))).toEqual([["E032", 5, 7]]);
  });
});
