import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { init, staleFiles } from "./init.js";
import { staleNotice } from "./templates.js";
import { check } from "./check.js";
import { tempFolder } from "./test-folder.js";

const read = (cwd: string, path: string) => readFileSync(join(cwd, path), "utf8");

const LATEST = "@ivanroosveltlt/tejo@latest";
const SKILLS = [".claude/skills/tejo/SKILL.md", ".claude/skills/tejo-map/SKILL.md"];

describe("tejo init", () => {
  it("en un proyecto vacío crea carpeta, nota, .mcp.json, skill y AGENTS.md", () => {
    const cwd = tempFolder({});
    const report = init(cwd, "knowledge");
    expect(report.created.sort()).toEqual([...SKILLS, ".mcp.json", "AGENTS.md", "knowledge/bienvenida.md"].sort());
    expect(JSON.parse(read(cwd, ".mcp.json"))).toEqual({
      mcpServers: { tejo: { command: "npx", args: ["-y", LATEST, "mcp", "knowledge"] } },
    });
    const notes = read(cwd, ".claude/skills/tejo/SKILL.md");
    expect(notes).toMatch(/^---\nname: tejo\ndescription: /);
    expect(notes).toContain("npx -y @ivanroosveltlt/tejo@latest guide notes knowledge");
    expect(notes).toContain("npx @ivanroosveltlt/tejo check knowledge");
    const map = read(cwd, ".claude/skills/tejo-map/SKILL.md");
    expect(map).toMatch(/^---\nname: tejo-map\ndescription: /);
    expect(map).toContain("npx -y @ivanroosveltlt/tejo@latest guide map knowledge");
    expect(map).toContain("--scope");
    expect(read(cwd, "AGENTS.md")).toContain("tejo-map");
    expect(read(cwd, "AGENTS.md")).toContain("<!-- tejo:start -->");
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
    expect(check(join(cwd, "knowledge")).errors).toBe(0);
  });

  it("es idempotente", () => {
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    const files = [".mcp.json", "AGENTS.md", ...SKILLS];
    const before = files.map((p) => read(cwd, p));
    const report = init(cwd, "knowledge");
    expect(report.created).toEqual([]);
    expect(report.updated).toEqual([]);
    expect(files.map((p) => read(cwd, p))).toEqual(before);
  });

  it("fusiona un .mcp.json existente y conserva lo ajeno", () => {
    const cwd = tempFolder({ ".mcp.json": JSON.stringify({ mcpServers: { otro: { command: "x" } }, extra: 1 }) });
    init(cwd, "knowledge");
    const config = JSON.parse(read(cwd, ".mcp.json"));
    expect(config.extra).toBe(1);
    expect(config.mcpServers.otro).toEqual({ command: "x" });
    expect(config.mcpServers.tejo.args).toEqual(["-y", LATEST, "mcp", "knowledge"]);
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
    expect(report.updated.sort()).toEqual([...SKILLS, ".mcp.json", "AGENTS.md"].sort());
    expect(JSON.parse(read(cwd, ".mcp.json")).mcpServers.tejo.args).toEqual(["-y", LATEST, "mcp", "docs/kb"]);
    expect(read(cwd, ".claude/skills/tejo/SKILL.md")).toContain("guide notes docs/kb");
  });

  it("migra un proyecto de 0.1.x (args sin @latest) sin tocar sus notas", () => {
    const old = { mcpServers: { tejo: { command: "npx", args: ["-y", "@ivanroosveltlt/tejo", "mcp", "knowledge"] } } };
    const cwd = tempFolder({ ".mcp.json": `${JSON.stringify(old, null, 2)}\n`, "knowledge/propia.md": "# propia\n" });
    const report = init(cwd, "knowledge");
    expect(report.updated).toContain(".mcp.json");
    expect(report.created).toContain(".claude/skills/tejo-map/SKILL.md");
    expect(JSON.parse(read(cwd, ".mcp.json")).mcpServers.tejo.args).toEqual(["-y", LATEST, "mcp", "knowledge"]);
    expect(read(cwd, "knowledge/propia.md")).toBe("# propia\n");
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
    expect(JSON.parse(read(cwd, ".mcp.json")).mcpServers.tejo.args).toEqual(["-y", LATEST, "mcp", "docs/kb"]);
  });

  it("rechaza una carpeta fuera del proyecto", () => {
    const cwd = tempFolder({});
    expect(() => init(cwd, "../fuera")).toThrow("la carpeta tiene que estar dentro del proyecto: '../fuera'");
  });
});

describe("staleFiles", () => {
  it("vacío justo después de init", () => {
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    expect(staleFiles(cwd, "knowledge")).toEqual([]);
  });

  it("lista una skill borrada y un bloque de AGENTS.md viejo", () => {
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    rmSync(join(cwd, ".claude/skills/tejo-map/SKILL.md"));
    writeFileSync(join(cwd, "AGENTS.md"), "<!-- tejo:start -->\nviejo\n<!-- tejo:end -->\n");
    expect(staleFiles(cwd, "knowledge")).toEqual([".claude/skills/tejo-map/SKILL.md", "AGENTS.md"]);
  });

  it("lista un .mcp.json de 0.1.x", () => {
    const old = { mcpServers: { tejo: { command: "npx", args: ["-y", "@ivanroosveltlt/tejo", "mcp", "knowledge"] } } };
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    writeFileSync(join(cwd, ".mcp.json"), JSON.stringify(old));
    expect(staleFiles(cwd, "knowledge")).toEqual([".mcp.json"]);
  });

  it("ignora el formato de .mcp.json si la entrada tejo es la correcta", () => {
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    const config = JSON.parse(read(cwd, ".mcp.json"));
    writeFileSync(join(cwd, ".mcp.json"), JSON.stringify({ otro: 1, ...config }));
    expect(staleFiles(cwd, "knowledge")).toEqual([]);
  });

  it("ignora claves extra y otro orden en la entrada tejo de .mcp.json", () => {
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    const { command, args } = JSON.parse(read(cwd, ".mcp.json")).mcpServers.tejo;
    const entry = { env: {}, args, command, type: "stdio" };
    writeFileSync(join(cwd, ".mcp.json"), JSON.stringify({ mcpServers: { tejo: entry } }));
    expect(staleFiles(cwd, "knowledge")).toEqual([]);
  });

  it("ignora finales de línea CRLF", () => {
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    writeFileSync(join(cwd, "AGENTS.md"), read(cwd, "AGENTS.md").replace(/\n/g, "\r\n"));
    expect(staleFiles(cwd, "knowledge")).toEqual([]);
  });

  it("no lanza: .mcp.json inválido o carpeta fuera del proyecto dan []", () => {
    const cwd = tempFolder({ ".mcp.json": "{ no" });
    expect(staleFiles(cwd, "knowledge")).toEqual([]);
    expect(staleFiles(cwd, "../fuera")).toEqual([]);
  });

  it("no cuenta CLAUDE.md ni la nota de bienvenida", () => {
    const cwd = tempFolder({});
    init(cwd, "knowledge");
    writeFileSync(join(cwd, "CLAUDE.md"), "# sin @AGENTS\n");
    rmSync(join(cwd, "knowledge/bienvenida.md"));
    expect(staleFiles(cwd, "knowledge")).toEqual([]);
  });
});

describe("staleNotice", () => {
  it("nombra los archivos y el comando para actualizar", () => {
    const text = staleNotice("docs/kb", [".mcp.json", "AGENTS.md"]);
    expect(text).toContain("`.mcp.json`, `AGENTS.md`");
    expect(text).toContain("npx @ivanroosveltlt/tejo@latest init docs/kb");
  });
});
