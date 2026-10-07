import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isDocumentUri } from "@tejo/core";
import { BLOCK_END, BLOCK_START, WELCOME_NOTE, agentsBlock, skill } from "./templates.js";

export type InitReport = { created: string[]; updated: string[]; unchanged: string[] };

type Write = { path: string; content: string };

const readIfExists = (file: string): string | null => (existsSync(file) ? readFileSync(file, "utf8") : null);

/** ¿La carpeta (recorrida sin seguir enlaces) tiene algún .flo o .md? */
function hasDocuments(dir: string): boolean {
  if (!existsSync(dir)) return false;
  return readdirSync(dir, { recursive: true, withFileTypes: false }).some((entry) => isDocumentUri(String(entry)));
}

/** `AGENTS.md` con el bloque de tejo puesto o reemplazado; el resto del texto no se toca. */
function withBlock(current: string | null, block: string): string {
  if (current === null) return block;
  const end = current.indexOf(BLOCK_END);
  // El inicio es el último marcador antes del fin: un inicio huérfano no arrastra texto ajeno.
  const start = end >= 0 ? current.lastIndexOf(BLOCK_START, end) : -1;
  if (start >= 0) {
    const after = current.slice(end + BLOCK_END.length).replace(/^\n/, "");
    return current.slice(0, start) + block + after;
  }
  return `${current.replace(/\n*$/, "\n")}\n${block}`;
}

/** `tejo init` (spec §4.1, decisión #65): idempotente; calcula todo antes de escribir. */
export function init(cwd: string, folderArg: string): InitReport {
  const absolute = resolve(cwd, folderArg);
  const rel = relative(cwd, absolute);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`la carpeta tiene que estar dentro del proyecto: '${folderArg}'`);
  }
  const folder = rel.split(sep).join("/");

  const mcpPath = join(cwd, ".mcp.json");
  const mcpText = readIfExists(mcpPath);
  let config: Record<string, unknown> = {};
  if (mcpText !== null) {
    try {
      config = JSON.parse(mcpText);
    } catch (error) {
      throw new Error(`.mcp.json no es JSON válido: ${(error as Error).message}`);
    }
  }
  const isObject = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isObject(config)) throw new Error(".mcp.json no es un objeto JSON");
  if (config.mcpServers !== undefined && !isObject(config.mcpServers)) {
    throw new Error("mcpServers en .mcp.json no es un objeto");
  }
  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
  config.mcpServers = { ...servers, tejo: { command: "npx", args: ["tejo", "mcp", folder] } };

  const writes: Write[] = [
    { path: ".mcp.json", content: `${JSON.stringify(config, null, 2)}\n` },
    { path: ".claude/skills/tejo/SKILL.md", content: skill(folder) },
    { path: "AGENTS.md", content: withBlock(readIfExists(join(cwd, "AGENTS.md")), agentsBlock(folder)) },
  ];
  const claude = readIfExists(join(cwd, "CLAUDE.md"));
  if (claude !== null && !claude.includes("@AGENTS.md")) {
    writes.push({ path: "CLAUDE.md", content: `${claude.replace(/\n*$/, "\n")}\n@AGENTS.md\n` });
  }

  const report: InitReport = { created: [], updated: [], unchanged: [] };
  const folderPath = join(cwd, folder);
  if (hasDocuments(folderPath)) report.unchanged.push(`${folder}/`);
  else writes.push({ path: `${folder}/bienvenida.md`, content: WELCOME_NOTE });

  for (const { path, content } of writes) {
    const file = join(cwd, path);
    const current = readIfExists(file);
    if (current === content) {
      report.unchanged.push(path);
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    (current === null ? report.created : report.updated).push(path);
  }
  return report;
}
