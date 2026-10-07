import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { runMcp } from "@tejo/mcp";
import { check } from "./check.js";
import { DEFAULT_FOLDER, resolveFolder } from "./folder-arg.js";

export const USAGE = `uso:
  tejo init [carpeta]                     prepara la carpeta, .mcp.json, la skill y AGENTS.md
  tejo mcp [carpeta]                      servidor MCP por stdio (lo arranca el agente)
  tejo view [carpeta] [--port N] [--no-open]  visor en http://127.0.0.1:8356
  tejo check [carpeta]                    lista los errores; sale con 1 si hay alguno

carpeta: por defecto '${DEFAULT_FOLDER}'.`;

/** Corre un comando y devuelve el exit code; los errores esperables salen como mensaje, no como excepción. */
export async function main(argv: string[], cwd: string): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    console.log(USAGE);
    return 0;
  }
  try {
    switch (command) {
      case "check": {
        const { positionals } = parseArgs({ args: rest, allowPositionals: true });
        const { lines, errors } = check(resolveFolder(positionals[0], cwd));
        for (const line of lines) (errors > 0 ? console.error : console.log)(line);
        return errors > 0 ? 1 : 0;
      }
      case "mcp": {
        const { positionals } = parseArgs({ args: rest, allowPositionals: true });
        await runMcp(resolveFolder(positionals[0], cwd));
        return 0;
      }
      default:
        console.error(`comando desconocido: ${command}\n\n${USAGE}`);
        return 1;
    }
  } catch (error) {
    console.error(`tejo: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

// Punto de entrada: realpath porque npx/npm llaman al bin por un enlace simbólico.
const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) {
  const code = await main(process.argv.slice(2), process.cwd());
  // `mcp` (y `view`, Task 5) siguen vivos: no se fuerza la salida con código 0.
  if (code !== 0) process.exit(code);
}
