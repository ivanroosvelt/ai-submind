// Smoke del paquete tal como lo instala npm (spec §7): pack → install → init → check → view.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pkg = new URL("..", import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), "tejo-smoke-"));
const run = (cmd, args, cwd = work) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString();
let view;

try {
  const tgz = run("pnpm", ["pack", "--pack-destination", work], pkg).trim().split("\n").at(-1);
  run("npm", ["init", "-y"]);
  run("npm", ["install", "--save-dev", "--no-audit", "--no-fund", tgz]);
  console.log(run("npx", ["--no-install", "tejo", "init"]));
  console.log(run("npx", ["--no-install", "tejo", "check"]));
  const config = JSON.parse(readFileSync(join(work, ".mcp.json"), "utf8"));
  if (config.mcpServers.tejo.args.join(" ") !== "-y @ivanroosveltlt/tejo@latest mcp knowledge") throw new Error("'.mcp.json' inesperado");
  if (!run("npx", ["--no-install", "tejo", "guide", "map"]).includes("map-plan.md")) throw new Error("'tejo guide map' inesperado");

  const version = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version;
  if (run("npx", ["--no-install", "tejo", "--version"]).trim() !== version) throw new Error("'tejo --version' inesperado");

  // Se lanza el bin instalado con node (sin npx) para que kill() mate al proceso real y no deje huérfanos.
  view = spawn("node", [join(work, "node_modules/@ivanroosveltlt/tejo/dist/cli.js"), "view", "--no-open", "--port", "0"], { cwd: work });
  const url = await new Promise((resolve, reject) => {
    view.stdout.on("data", (chunk) => {
      const match = /http:\/\/127\.0\.0\.1:\d+\//.exec(String(chunk));
      if (match) resolve(match[0]);
    });
    view.on("exit", (code) => reject(new Error(`tejo view salió con ${code}`)));
  });
  const index = await (await fetch(url)).text();
  const files = await (await fetch(`${url}api/files`)).json();
  if (!index.includes("<title>tejo</title>")) throw new Error("el visor no está en el paquete");
  if (!files.files["bienvenida.md"]) throw new Error("api/files no devolvió la nota de bienvenida");
  console.log("smoke ok");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  view?.kill();
  rmSync(work, { recursive: true, force: true });
}
