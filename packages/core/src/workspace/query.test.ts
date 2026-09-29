import { describe, it, expect } from "vitest";
import { Workspace, type LinkResult } from "./workspace.js";
import { SCHEMA_URI } from "./schema.js";
import { query, tagCatalog, type QueryOptions, type QueryResult } from "./query.js";

const md = (lines: string[]): string => [...lines, ""].join("\n");

/** Workspace fijo de la Fase K2. Orden del catálogo: api, db, cache, incidente, passwords, pkce, auth. */
const files: Record<string, string> = {
  [SCHEMA_URI]: "type_tags: [business_rule, decision, incident]\nrelation_types: [affects, enforces, visualized_by]\n",
  "catalogo.flo": "entity api\nentity db\nentity cache\n",
  "flujos/auth.flo": md([
    'use "../catalogo.flo"',
    "flow acceso {",
    "  api -> db",
    "  db -> api",
    "}",
    "sequence detalle {",
    "  api -> cache : get",
    "}",
    "flow admin {",
    "  api -> db",
    "  api -> ghost",
    "}",
  ]),
  "kb/incidente.md": md([
    "---",
    "id: incidente",
    "title: Caída del cache",
    "memory_type: working",
    "type_tags: [incident]",
    'context_tags: ["project:ops"]',
    "custom_tags:",
    '  security_level: "3"',
    "  urgent: true",
    'use: ["../catalogo.flo"]',
    "relations:",
    "  - target: cache",
    "    type: affects",
    "---",
    "El CACHE se cayó.",
  ]),
  "kb/passwords.md": md([
    "---",
    "id: passwords",
    "title: Reglas de contraseñas",
    "memory_type: short_term",
    "type_tags: [business_rule]",
    'context_tags: ["project:core"]',
    "custom_tags:",
    "  status: draft",
    "relations:",
    "  - target: fantasma",
    "    type: affects",
    "---",
    "Mínimo 12 caracteres.",
  ]),
  "kb/pkce.md": md([
    "---",
    "id: pkce",
    'title: "Decisión: OAuth2 + PKCE"',
    "memory_type: long_term",
    "type_tags: [decision]",
    'context_tags: ["project:core", "flow:authentication"]',
    "custom_tags:",
    "  status: approved",
    "  security_level: 3",
    'use: ["../catalogo.flo"]',
    "relations:",
    "  - target: ./passwords.md",
    "    type: enforces",
    "  - target: ../flujos/auth.flo#acceso",
    "    type: visualized_by",
    "  - target: api",
    "    type: affects",
    "---",
    "",
    "# Decisión de arquitectura",
    "",
    "Usamos PKCE en el cliente.",
    "",
    "```flo",
    "entity auth",
    "flow validacion {",
    "  api -> auth",
    "}",
    "```",
  ]),
  // Pierde contra kb/pkce.md (E031): no aporta relaciones ni tags.
  "kb/zz_dup.md": md([
    "---",
    "id: pkce",
    "title: Duplicado",
    "memory_type: long_term",
    "type_tags: [decision]",
    'context_tags: ["project:dup"]',
    "---",
  ]),
};

function linkFiles(input: Record<string, string>): LinkResult {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(input)) workspace.setDocument(uri, source);
  return workspace.link();
}

const link = linkFiles(files);
const run = (opts: QueryOptions = {}): QueryResult => query(link, opts);
const ids = (result: QueryResult): string[] => result.nodes.map((node) => node.id);
const distances = (result: QueryResult): [string, number][] => result.nodes.map((node) => [node.id, node.distance]);
const edges = (result: QueryResult): string[] => result.edges.map((edge) => `${edge.from}->${edge.to}:${edge.type}`);

describe("query", () => {
  it("links the fixture with exactly the expected diagnostics", () => {
    const codes = Object.fromEntries(
      [...link.diagnostics].map(([uri, list]) => [uri, list.map((diagnostic) => diagnostic.code)])
    );
    expect(codes).toEqual({
      "catalogo.flo": [],
      "flujos/auth.flo": ["E030"],
      "kb/incidente.md": [],
      "kb/passwords.md": ["E035"],
      "kb/pkce.md": [],
      "kb/zz_dup.md": ["E031"],
      [SCHEMA_URI]: [],
    });
  });

  it("returns every entity in catalog order when where is omitted", () => {
    const result = run();
    expect(ids(result)).toEqual(["api", "db", "cache", "incidente", "passwords", "pkce", "auth"]);
    expect(result.nodes.every((node) => node.distance === 0)).toBe(true);
  });

  it("lists relation edges and merged flow edges in document order", () => {
    const result = run();
    expect(edges(result)).toEqual([
      "api->db:flow",
      "db->api:flow",
      "api->cache:flow",
      "incidente->cache:affects",
      "pkce->passwords:enforces",
      "pkce->api:affects",
      "api->auth:flow",
    ]);
    expect(result.edges.map((edge) => edge.blocks)).toEqual([
      ["flujos/auth.flo#acceso", "flujos/auth.flo#admin"],
      ["flujos/auth.flo#acceso"],
      ["flujos/auth.flo#detalle"],
      undefined,
      undefined,
      undefined,
      ["kb/pkce.md#validacion"],
    ]);
  });

  it.each<[string, QueryOptions["where"], string[]]>([
    ["memory", { memory: "long_term" }, ["pkce"]],
    ["typeTag", { typeTag: "incident" }, ["incidente"]],
    ["exact contextTag", { contextTag: "project:core" }, ["passwords", "pkce"]],
    ["contextTag key with any value", { contextTag: "project:" }, ["incidente", "passwords", "pkce"]],
    ["custom key present", { custom: "status" }, ["passwords", "pkce"]],
    ["custom equals string", { custom: "status", equals: "approved" }, ["pkce"]],
    ["custom equals keeps the type (3 is not '3')", { custom: "security_level", equals: 3 }, ["pkce"]],
    ["custom equals boolean", { custom: "urgent", equals: true }, ["incidente"]],
    ["custom key inherited from Object.prototype", { custom: "constructor" }, []],
    ["text in title, ignoring case and keeping accents", { text: "CAÍDA" }, ["incidente"]],
    ["text in body", { text: "12 caracteres" }, ["passwords"]],
    ["text inside an embedded flo fence", { text: "validacion" }, ["pkce"]],
    ["text does not see .flo entities", { text: "db" }, []],
    ["and", { and: [{ memory: "short_term" }, { contextTag: "project:core" }] }, ["passwords"]],
    ["or", { or: [{ typeTag: "incident" }, { memory: "long_term" }] }, ["incidente", "pkce"]],
    ["not also matches .flo entities", { not: { memory: "working" } }, ["api", "db", "cache", "passwords", "pkce", "auth"]],
    ["empty and matches everything", { and: [] }, ["api", "db", "cache", "incidente", "passwords", "pkce", "auth"]],
    ["empty or matches nothing", { or: [] }, []],
  ])("filters seeds by %s", (_name, where, expected) => {
    expect(ids(run({ where }))).toEqual(expected);
  });

  it("intersects from with where, in catalog order, ignoring unknown ids", () => {
    expect(ids(run({ from: ["pkce", "api", "nope"] }))).toEqual(["api", "pkce"]);
    expect(ids(run({ from: ["pkce", "api", "nope"], where: { memory: "long_term" } }))).toEqual(["pkce"]);
    expect(run({ from: [] })).toEqual({ nodes: [], edges: [] });
  });

  it("only returns edges between nodes of the result", () => {
    expect(edges(run({ where: { memory: "long_term" } }))).toEqual([]);
  });

  it("expands undirected over relations and flows up to depth", () => {
    const one = run({ where: { memory: "long_term" }, depth: 1 });
    expect(distances(one)).toEqual([["pkce", 0], ["api", 1], ["passwords", 1]]);
    expect(edges(one)).toEqual(["pkce->passwords:enforces", "pkce->api:affects"]);

    const two = run({ where: { memory: "long_term" }, depth: 2 });
    expect(distances(two)).toEqual([
      ["pkce", 0],
      ["api", 1],
      ["passwords", 1],
      ["db", 2],
      ["cache", 2],
      ["auth", 2],
    ]);
    expect(edges(two)).toEqual([
      "api->db:flow",
      "db->api:flow",
      "api->cache:flow",
      "pkce->passwords:enforces",
      "pkce->api:affects",
      "api->auth:flow",
    ]);
  });

  it("follows incoming relations and flow edges alike", () => {
    expect(distances(run({ from: ["cache"], depth: 1 }))).toEqual([["cache", 0], ["api", 1], ["incidente", 1]]);
    expect(edges(run({ where: { typeTag: "incident" }, depth: 2 }))).toEqual([
      "api->cache:flow",
      "incidente->cache:affects",
    ]);
  });

  it("stops on cycles and lists each node once at its minimum distance", () => {
    expect(distances(run({ where: { memory: "long_term" }, depth: 10 }))).toEqual([
      ["pkce", 0],
      ["api", 1],
      ["passwords", 1],
      ["db", 2],
      ["cache", 2],
      ["auth", 2],
      ["incidente", 3],
    ]);
  });

  it("treats a negative depth as 0", () => {
    expect(ids(run({ where: { memory: "long_term" }, depth: -1 }))).toEqual(["pkce"]);
  });

  it("projects meta by default, for .md and .flo entities", () => {
    const [api, pkce] = run({ from: ["api", "pkce"] }).nodes;
    expect(pkce).toEqual({
      id: "pkce",
      title: "Decisión: OAuth2 + PKCE",
      uri: "kb/pkce.md",
      distance: 0,
      memoryType: "long_term",
      typeTags: ["decision"],
      contextTags: ["project:core", "flow:authentication"],
      customTags: { status: "approved", security_level: 3 },
    });
    expect(pkce).not.toHaveProperty("body");
    expect(pkce).not.toHaveProperty("diagrams");
    expect(api).toEqual({
      id: "api",
      title: "api",
      uri: "catalogo.flo",
      distance: 0,
      memoryType: null,
      typeTags: [],
      contextTags: [],
      customTags: {},
    });
  });

  it("adds the body with full, and the embedded flo sources with full+diagrams", () => {
    const [api, pkce] = run({ from: ["api", "pkce"], project: "full" }).nodes;
    expect(pkce.body).toBe(
      "\n# Decisión de arquitectura\n\nUsamos PKCE en el cliente.\n\n```flo\nentity auth\nflow validacion {\n  api -> auth\n}\n```\n"
    );
    expect(pkce).not.toHaveProperty("diagrams");
    expect(api.body).toBe("");

    const [apiFull, pkceFull] = run({ from: ["api", "pkce"], project: "full+diagrams" }).nodes;
    expect(pkceFull.diagrams).toEqual(["entity auth\nflow validacion {\n  api -> auth\n}"]);
    expect(apiFull.diagrams).toEqual([]);
  });

  it("does not share arrays or objects with the linked documents", () => {
    const [pkce] = run({ from: ["pkce"] }).nodes;
    pkce.typeTags.push("x");
    pkce.customTags.status = "x";
    expect(run({ from: ["pkce"] }).nodes[0].typeTags).toEqual(["decision"]);
    expect(link.entities.get("pkce")!.knowledge!.customTags.status).toBe("approved");
  });

  it("returns embedded flo sources without carriage returns on CRLF files", () => {
    const crlfWorkspace = linkFiles({
      [SCHEMA_URI]: "type_tags: []\nrelation_types: []\n",
      "kb/test.md": ["---", "id: a", "title: A", "memory_type: working", "---", "```flo", "entity x", "```", ""].join(
        "\r\n"
      ),
    });
    const [node] = query(crlfWorkspace, { from: ["a"], project: "full+diagrams" }).nodes;
    expect(node.diagrams).toEqual(["entity x"]);
  });
});

describe("tagCatalog", () => {
  it("lists the tags in use by winning declarations, in catalog order without repeats", () => {
    expect(tagCatalog(link)).toEqual({
      typeTags: ["incident", "business_rule", "decision"],
      contextTags: ["project:ops", "project:core", "flow:authentication"],
      customTags: { security_level: ["3", 3], urgent: [true], status: ["draft", "approved"] },
    });
  });

  it("handles custom tag keys named like Object.prototype members", () => {
    const tagged = linkFiles({
      [SCHEMA_URI]: "type_tags: []\nrelation_types: []\n",
      "a.md": md(["---", "id: a", "title: A", "memory_type: working", "custom_tags:", "  constructor: x", "  toString: 1", "---"]),
    });
    expect(tagCatalog(tagged).customTags).toEqual({ constructor: ["x"], toString: [1] });
    expect(ids(query(tagged, { where: { custom: "constructor", equals: "x" } }))).toEqual(["a"]);
  });

  it("is empty for a workspace without knowledge", () => {
    expect(tagCatalog(linkFiles({ "a.flo": "entity a\n" }))).toEqual({ typeTags: [], contextTags: [], customTags: {} });
  });
});
