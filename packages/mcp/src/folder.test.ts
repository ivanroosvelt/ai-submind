import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FloFolder } from "./folder.js";

const node = (id: string, extra: string[] = []): string =>
  ["---", `id: ${id}`, `title: Nodo ${id}`, "memory_type: long_term", ...extra, "---", "Cuerpo.", ""].join("\n");

/** Carpeta fija de la Fase K3. Catálogo: api, a, b, c; `roto.flo` pierde `api` (E031). */
const FILES: Record<string, string> = {
  "knowledge.schema.yaml": "type_tags: [decision]\nrelation_types: [affects]\n",
  "catalogo.flo": "entity api\n",
  "roto.flo": "entity api\n",
  "kb/a.md": node("a", ["type_tags: [decision]", 'use: ["../catalogo.flo"]', "relations:", "  - target: api", "    type: affects"]),
  // `use` dentro de una cerca ```flo (pendiente de K1): api resuelve sin E030.
  "kb/b.md": node("b") + '\n```flo\nuse "../catalogo.flo"\nflow f {\n  api -> b\n}\n```\n',
  "kb/c.md": node("c", ['use: ["./a.md"]', "relations:", "  - target: a", "    type: affects"]),
  "README.md": "# Notas sin frontmatter\n",
  "notas.txt": "no es un documento\n",
  "node_modules/pkg/x.md": node("x"),
  ".git/y.flo": "entity y\n",
};

const temps: string[] = [];

function tempDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "flo-mcp-"));
  temps.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function loaded(files: Record<string, string> = FILES): FloFolder {
  const folder = new FloFolder(tempDir(files));
  folder.load();
  return folder;
}

afterEach(() => {
  for (const root of temps.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("FloFolder load", () => {
  it("loads .flo, .md with frontmatter and the schema, skipping ignored folders and other files", () => {
    const folder = loaded();
    expect([...folder.link().entities.keys()]).toEqual(["api", "a", "b", "c"]);
  });

  it("reports only non-empty diagnostics, keyed by uri", () => {
    const folder = loaded();
    expect(folder.diagnostics()).toEqual({ "roto.flo": [expect.objectContaining({ code: "E031" })] });
  });

  it("returns one file's diagnostics, or null if it is not a workspace document", () => {
    const folder = loaded();
    expect(folder.diagnostics("kb/a.md")).toEqual({ "kb/a.md": [] });
    expect(folder.diagnostics("README.md")).toBeNull();
    expect(folder.diagnostics("notas.txt")).toBeNull();
  });

  it("does not follow symbolic links out of the root", () => {
    const outside = tempDir({ "x.md": node("fuera") });
    const root = tempDir({ "knowledge.schema.yaml": "type_tags: []\nrelation_types: []\n" });
    symlinkSync(outside, join(root, "enlace"));
    const folder = new FloFolder(root);
    folder.load();
    expect([...folder.link().entities.keys()]).toEqual([]);
  });

  it("reloads from scratch", () => {
    const folder = loaded();
    rmSync(join(folder.root, "kb"), { recursive: true });
    folder.load();
    expect([...folder.link().entities.keys()]).toEqual(["api"]);
  });
});

describe("FloFolder toUri", () => {
  it("normalizes paths inside the root to POSIX uris", () => {
    const folder = loaded();
    expect(folder.toUri("kb/a.md")).toBe("kb/a.md");
    expect(folder.toUri("./kb/../kb/a.md")).toBe("kb/a.md");
    expect(folder.toUri(join(folder.root, "kb", "a.md"))).toBe("kb/a.md");
    expect(folder.toUri("..nota.md")).toBe("..nota.md");
  });

  it("rejects paths outside the root and the root itself", () => {
    const folder = loaded();
    expect(folder.toUri("../fuera.md")).toBeNull();
    expect(folder.toUri("kb/../../fuera.md")).toBeNull();
    expect(folder.toUri("/etc/passwd")).toBeNull();
    expect(folder.toUri("")).toBeNull();
    expect(folder.toUri(".")).toBeNull();
  });
});
