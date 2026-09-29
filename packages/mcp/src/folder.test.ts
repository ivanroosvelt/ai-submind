import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

describe("FloFolder write", () => {
  it("writes a valid new .md atomically, creating folders, and links it at once", () => {
    const folder = loaded();
    const content = node("n", ["relations:", "  - target: ../a.md", "    type: affects"]);
    expect(folder.write("kb/nuevo/n.md", content)).toEqual({ ok: true, uri: "kb/nuevo/n.md" });
    expect(readFileSync(join(folder.root, "kb/nuevo/n.md"), "utf8")).toBe(content);
    expect(readdirSync(join(folder.root, "kb/nuevo"))).toEqual(["n.md"]);
    expect(folder.link().entities.has("n")).toBe(true);
  });

  it("writes a valid .flo, and overwrites an existing file", () => {
    const folder = loaded();
    expect(folder.write("flujos/f.flo", 'use "../catalogo.flo"\nflow f {\n  api -> api\n}\n')).toMatchObject({ ok: true });
    expect(folder.write("kb/a.md", node("a", ["type_tags: [decision]"]))).toMatchObject({ ok: true });
    expect(folder.link().xref.relationsFrom("a")).toEqual([]);
  });

  it("is not blocked by errors other files already had", () => {
    const folder = loaded();
    expect(folder.diagnostics()).toHaveProperty("roto.flo");
    expect(folder.write("kb/d.md", node("d"))).toMatchObject({ ok: true });
  });

  it("rejects a file with errors and leaves the disk untouched", () => {
    const folder = loaded();
    const result = folder.write("kb/m.md", node("m").replace("long_term", "forever"));
    expect(result).toMatchObject({ ok: false, diagnostics: [expect.objectContaining({ uri: "kb/m.md", code: "E064" })] });
    expect(existsSync(join(folder.root, "kb/m.md"))).toBe(false);
    expect(folder.link().entities.has("m")).toBe(false);
  });

  it("rejects an edit that breaks another file", () => {
    const folder = loaded();
    const before = readFileSync(join(folder.root, "kb/a.md"), "utf8");
    const result = folder.write("kb/a.md", node("z"));
    expect(result).toMatchObject({ ok: false, diagnostics: [expect.objectContaining({ uri: "kb/c.md", code: "E035" })] });
    expect(readFileSync(join(folder.root, "kb/a.md"), "utf8")).toBe(before);
  });

  it("rejects a .md without frontmatter", () => {
    const folder = loaded();
    expect(folder.write("kb/nota.md", "# Hola\n")).toMatchObject({ ok: false, error: expect.stringMatching(/no es un documento/) });
    expect(existsSync(join(folder.root, "kb/nota.md"))).toBe(false);
  });

  it("rejects paths outside the root, other extensions and ignored folders", () => {
    const folder = loaded();
    const rejected = (path: string, pattern: RegExp): void =>
      expect(folder.write(path, node("q"))).toEqual({ ok: false, error: expect.stringMatching(pattern), diagnostics: [] });
    rejected("../fuera.md", /sale de la carpeta raíz/);
    rejected(join(tmpdir(), "fuera.md"), /sale de la carpeta raíz/);
    rejected("kb/x.txt", /solo se escriben archivos \.md o \.flo/);
    rejected("knowledge.schema.yaml", /solo se escriben archivos \.md o \.flo/);
    rejected("node_modules/q.md", /carpeta ignorada/);
    expect(existsSync(join(folder.root, "node_modules/q.md"))).toBe(false);
  });

  it("rejects a path that leaves the root through a symbolic link", () => {
    const outside = tempDir({});
    const folder = loaded();
    symlinkSync(outside, join(folder.root, "enlace"));
    expect(folder.write("enlace/sub/q.md", node("q"))).toMatchObject({ ok: false, error: expect.stringMatching(/enlace simbólico/) });
    expect(readdirSync(outside)).toEqual([]);
  });

  it("reports an I/O failure instead of throwing", () => {
    const folder = loaded();
    // kb/a.md es un archivo: no puede ser directorio de otro.
    expect(folder.write("kb/a.md/q.md", node("q"))).toMatchObject({ ok: false, error: expect.stringMatching(/no se pudo escribir/) });
  });
});
