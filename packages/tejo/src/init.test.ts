import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { init } from "./init.js";
import { check } from "./check.js";
import { tempFolder } from "./test-folder.js";

const read = (cwd: string, path: string) => readFileSync(join(cwd, path), "utf8");

describe("tejo init", () => {
  it("en un proyecto vacío crea carpeta, nota, .mcp.json, skill y AGENTS.md", () => {
    const cwd = tempFolder({});
    const report = init(cwd, "knowledge");
    expect(report.created.sort()).toEqual(
      [".claude/skills/tejo/SKILL.md", ".mcp.json", "AGENTS.md", "knowledge/bienvenida.md"].sort()
    );
    expect(JSON.parse(read(cwd, ".mcp.json"))).toEqual({
      mcpServers: { tejo: { command: "npx", args: ["-y", "@ivanroosveltlt/tejo", "mcp", "knowledge"] } },
    });
    expect(read(cwd, ".claude/skills/tejo/SKILL.md")).toMatch(/^---\nname: tejo\ndescription: /);
    expect(read(cwd, ".claude/skills/tejo/SKILL.md")).toContain("write_node");
    expect(read(cwd, "AGENTS.md")).toContain("<!-- tejo:start -->");
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
    expect(check(join(cwd, "knowledge")).errors).toBe(0);
  });

  it("es idempotente", () => {
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    const before = [".mcp.json", "AGENTS.md", ".claude/skills/tejo/SKILL.md"].map((p) => read(cwd, p));
    const report = init(cwd, "knowledge");
    expect(report.created).toEqual([]);
    expect(report.updated).toEqual([]);
    expect([".mcp.json", "AGENTS.md", ".claude/skills/tejo/SKILL.md"].map((p) => read(cwd, p))).toEqual(before);
  });

  it("fusiona un .mcp.json existente y conserva lo ajeno", () => {
    const cwd = tempFolder({ ".mcp.json": JSON.stringify({ mcpServers: { otro: { command: "x" } }, extra: 1 }) });
    init(cwd, "knowledge");
    const config = JSON.parse(read(cwd, ".mcp.json"));
    expect(config.extra).toBe(1);
    expect(config.mcpServers.otro).toEqual({ command: "x" });
    expect(config.mcpServers.tejo.args).toEqual(["-y", "@ivanroosveltlt/tejo", "mcp", "knowledge"]);
  });

  it("un .mcp.json inválido aborta sin escribir nada", () => {
    const cwd = tempFolder({ ".mcp.json": "{ no" });
    expect(() => init(cwd, "knowledge")).toThrow(/^\.mcp\.json no es JSON válido/);
    expect(existsSync(join(cwd, "knowledge"))).toBe(false);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
    expect(read(cwd, ".mcp.json")).toBe("{ no");
  });

  it.each([["[]"], ["null"], ['"x"'], ['{"mcpServers":[]}'], ['{"mcpServers":null}']])(
    ".mcp.json %s (no objeto) aborta sin escribir nada",
    (text) => {
      const cwd = tempFolder({ ".mcp.json": text });
      expect(() => init(cwd, "knowledge")).toThrow(/no es un objeto/);
      expect(existsSync(join(cwd, "knowledge"))).toBe(false);
      expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
      expect(read(cwd, ".mcp.json")).toBe(text);
    },
  );

  it("un marcador de inicio huérfano no hace perder texto ajeno", () => {
    const user = "# Mío\n\n<!-- tejo:start -->\nTexto propio importante.\n";
    const cwd = tempFolder({ "AGENTS.md": user });
    init(cwd, "knowledge");
    init(cwd, "knowledge");
    const agents = read(cwd, "AGENTS.md");
    expect(agents.startsWith(user)).toBe(true);
    expect(agents.split("<!-- tejo:end -->").length).toBe(2);
    expect(agents.split("<!-- tejo:start -->").length).toBe(3);
  });

  it("respeta el texto ajeno de AGENTS.md y solo reemplaza su bloque", () => {
    const cwd = tempFolder({ "AGENTS.md": "# Mi proyecto\n\nReglas propias.\n" });
    init(cwd, "knowledge");
    init(cwd, "docs/kb");
    const agents = read(cwd, "AGENTS.md");
    expect(agents.startsWith("# Mi proyecto\n\nReglas propias.\n")).toBe(true);
    expect(agents.split("<!-- tejo:start -->").length).toBe(2);
    expect(agents).toContain("docs/kb/");
    expect(agents).not.toContain("`knowledge/`");
  });

  it("otra carpeta en una segunda corrida actualiza .mcp.json y la skill", () => {
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    const report = init(cwd, "docs/kb");
    expect(report.updated.sort()).toEqual([".claude/skills/tejo/SKILL.md", ".mcp.json", "AGENTS.md"].sort());
    expect(JSON.parse(read(cwd, ".mcp.json")).mcpServers.tejo.args).toEqual(["-y", "@ivanroosveltlt/tejo", "mcp", "docs/kb"]);
    expect(read(cwd, ".claude/skills/tejo/SKILL.md")).toContain("docs/kb/");
  });

  it("agrega @AGENTS.md a un CLAUDE.md existente una sola vez", () => {
    const cwd = tempFolder({ "CLAUDE.md": "# Instrucciones\n" });
    init(cwd, "knowledge");
    init(cwd, "knowledge");
    expect(read(cwd, "CLAUDE.md")).toBe("# Instrucciones\n\n@AGENTS.md\n");
  });

  it("no crea la nota de bienvenida si la carpeta ya tiene documentos", () => {
    const cwd = tempFolder({ "knowledge/propia.md": "# propia\n" });
    const report = init(cwd, "knowledge");
    expect(existsSync(join(cwd, "knowledge/bienvenida.md"))).toBe(false);
    expect(report.unchanged).toContain("knowledge/");
  });

  it("acepta una ruta de carpeta con ./ o barra final y la normaliza", () => {
    const cwd = tempFolder({});
    init(cwd, "./docs/kb/");
    expect(JSON.parse(read(cwd, ".mcp.json")).mcpServers.tejo.args).toEqual(["-y", "@ivanroosveltlt/tejo", "mcp", "docs/kb"]);
  });

  it("rechaza una carpeta fuera del proyecto", () => {
    const cwd = tempFolder({});
    expect(() => init(cwd, "../fuera")).toThrow("la carpeta tiene que estar dentro del proyecto: '../fuera'");
  });
});
