import { describe, it, expect } from "vitest";
import { Workspace, type LinkResult } from "./workspace.js";
import { entityAt, renameEntity, type TextEdit } from "./navigation.js";

function link(files: Record<string, string>): LinkResult {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

const files = {
  "catalog.flo": "entity api [API]\nentity db\nentity db\n",
  "login.flo": 'use "./catalog.flo"\nflow login {\n  api -> db\n  api -> ghost\n}\n',
  "kb/nota.md": [
    "---",
    'id: "nota"',
    "title: Nota",
    "memory_type: long_term",
    'use: ["../catalog.flo"]',
    "relations:",
    "  - target: db",
    "    type: usa",
    "  - target: ../login.flo#login",
    "    type: usa",
    "---",
    "```flo",
    "flow embebido {",
    "  nota -> db",
    "}",
    "```",
    "",
  ].join("\n"),
};

const at = (line: number, column: number) => ({ line, column });

describe("entityAt", () => {
  const linked = link(files);
  const doc = (uri: string) => linked.documents.get(uri)!.document;

  it("finds a declaration by its name", () => {
    expect(entityAt(doc("catalog.flo"), at(1, 8))).toBe("api");
    expect(entityAt(doc("catalog.flo"), at(1, 11))).toBe("api"); // justo después del id
  });

  it("finds a resolved reference in a block", () => {
    expect(entityAt(doc("login.flo"), at(3, 3))).toBe("api");
    expect(entityAt(doc("login.flo"), at(3, 10))).toBe("db");
  });

  it("returns null for unresolved references and for other text", () => {
    expect(entityAt(doc("login.flo"), at(4, 10))).toBeNull(); // ghost
    expect(entityAt(doc("login.flo"), at(2, 1))).toBeNull(); // 'flow'
  });

  it("finds relation targets and embedded-block references in a .md", () => {
    expect(entityAt(doc("kb/nota.md"), at(7, 13))).toBe("db");
    expect(entityAt(doc("kb/nota.md"), at(2, 6))).toBe("nota");
    expect(entityAt(doc("kb/nota.md"), at(14, 12))).toBe("db");
  });
});

function edited(source: string, edits: TextEdit[]): string {
  const lines = source.split("\n");
  for (const edit of [...edits].reverse()) {
    const { start, end } = edit.range;
    expect(start.line).toBe(end.line); // un id nunca cruza líneas
    const line = lines[start.line - 1];
    lines[start.line - 1] = line.slice(0, start.column - 1) + edit.text + line.slice(end.column - 1);
  }
  return lines.join("\n");
}

function renamed(id: string, newId: string): Record<string, string> {
  const result = renameEntity(link(files), id, newId);
  if ("error" in result) throw new Error(result.error);
  const out: Record<string, string> = {};
  for (const [uri, edits] of result.edits) out[uri] = edited(files[uri as keyof typeof files], edits);
  return out;
}

describe("renameEntity", () => {
  it("renames the winning declaration and every resolved reference, in every document", () => {
    const out = renamed("db", "store");
    expect(out["catalog.flo"]).toBe("entity api [API]\nentity store\nentity db\n"); // la perdedora (E031) no cambia
    expect(out["login.flo"]).toContain("  api -> store\n  api -> ghost");
    expect(out["kb/nota.md"]).toContain("  - target: store\n");
    expect(out["kb/nota.md"]).toContain("  nota -> store\n");
  });

  it("does not touch path-form relation targets", () => {
    expect(renamed("db", "store")["kb/nota.md"]).toContain("  - target: ../login.flo#login\n");
  });

  it("replaces a quoted YAML id whole", () => {
    expect(renamed("nota", "memo")["kb/nota.md"]).toContain("\nid: memo\n");
  });

  it("quotes the new id in YAML when YAML would read it as another type, never in .flo", () => {
    const out = renamed("db", "yes");
    expect(out["kb/nota.md"]).toContain('  - target: "yes"\n');
    expect(out["kb/nota.md"]).toContain("  nota -> yes\n");
    expect(out["login.flo"]).toContain("  api -> yes\n");
    expect(renamed("nota", "Null")["kb/nota.md"]).toContain('\nid: "Null"\n');
  });

  it("orders the edits of each document by position", () => {
    const result = renameEntity(link(files), "db", "store");
    if ("error" in result) throw new Error(result.error);
    const lines = result.edits.get("kb/nota.md")!.map((edit) => edit.range.start.line);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
  });

  it("rejects unknown ids, invalid identifiers and existing ids", () => {
    const linked = link(files);
    expect(renameEntity(linked, "ghost", "x")).toEqual({ error: "no existe la entidad 'ghost'" });
    expect(renameEntity(linked, "db", "1db")).toEqual({
      error: "'1db' no es un identificador: letras, dígitos y '_', sin empezar con dígito",
    });
    expect(renameEntity(linked, "db", "api")).toEqual({ error: "ya existe una entidad 'api'" });
  });

  it("returns no edits when the id does not change", () => {
    expect(renameEntity(link(files), "db", "db")).toEqual({ edits: new Map() });
  });

  it("returns each document's edits in source order, also within one line", () => {
    const result = renameEntity(link({ "a.flo": "entity api\nflow f {\n  api -> api\n}\n" }), "api", "gw");
    if ("error" in result) throw new Error(result.error);
    expect(result.edits.get("a.flo")!.map((edit) => edit.range.start)).toEqual([
      { line: 1, column: 8 },
      { line: 3, column: 3 },
      { line: 3, column: 10 },
    ]);
  });
});
