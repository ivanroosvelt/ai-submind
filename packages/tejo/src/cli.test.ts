import { describe, expect, it, vi } from "vitest";
import { INSTRUCTIONS, MAP_PROMPT } from "@tejo/mcp";
import { main } from "./cli.js";
import { tempFolder } from "./test-folder.js";

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args) => void out.push(args.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...args) => void err.push(args.join(" ")));
  return { out, err };
}

describe("tejo cli", () => {
  it("--help imprime el uso y sale con 0", async () => {
    const { out } = capture();
    expect(await main(["--help"], process.cwd())).toBe(0);
    expect(out.join("\n")).toContain("tejo init [carpeta]");
  });

  it("un comando desconocido imprime el uso y sale con 1", async () => {
    const { err } = capture();
    expect(await main(["nada"], process.cwd())).toBe(1);
    expect(err.join("\n")).toContain("comando desconocido: nada");
  });

  it("guide notes imprime las instrucciones vigentes", async () => {
    const { out } = capture();
    expect(await main(["guide", "notes"], tempFolder({}))).toBe(0);
    expect(out).toEqual([INSTRUCTIONS]);
  });

  it("guide map imprime el prompt con carpeta y scope", async () => {
    const { out } = capture();
    expect(await main(["guide", "map", "docs/kb", "--scope", "packages/core"], tempFolder({}))).toBe(0);
    expect(out).toEqual([MAP_PROMPT("docs/kb", "packages/core")]);
  });

  it("guide map usa knowledge por defecto", async () => {
    const { out } = capture();
    expect(await main(["guide", "map"], tempFolder({}))).toBe(0);
    expect(out).toEqual([MAP_PROMPT("knowledge")]);
  });

  it.each([[[]], [["nada"]]])("guide %j: mensaje y exit 1", async (args) => {
    const { err } = capture();
    expect(await main(["guide", ...args], tempFolder({}))).toBe(1);
    expect(err.join("\n")).toContain("tema desconocido");
  });

  it("check sale con 1 si hay errores y 0 si no", async () => {
    capture();
    expect(await main(["check", "."], tempFolder({ "a.flo": "entity api\n" }))).toBe(0);
    expect(await main(["check"], tempFolder({ "knowledge/b.flo": "entity api\nentity api\n" }))).toBe(1);
  });

  it("check sobre una carpeta inexistente: mensaje y exit 1, sin excepción", async () => {
    const { err } = capture();
    expect(await main(["check", "nada"], tempFolder({}))).toBe(1);
    expect(err.join("\n")).toContain("la carpeta 'nada' no existe o no es un directorio");
  });

  it("view sobre una carpeta inexistente: mensaje y exit 1", async () => {
    const { err } = capture();
    expect(await main(["view", "nada", "--no-open"], tempFolder({}))).toBe(1);
    expect(err.join("\n")).toContain("la carpeta 'nada' no existe o no es un directorio");
  });

  it("view con --port inválido: exit 1", async () => {
    capture();
    expect(await main(["view", ".", "--port", "abc", "--no-open"], tempFolder({}))).toBe(1);
  });

  it("init prepara el proyecto y check pasa sobre la carpeta creada", async () => {
    const { out } = capture();
    const cwd = tempFolder({});
    expect(await main(["init"], cwd)).toBe(0);
    expect(out.join("\n")).toContain("creado      .mcp.json");
    expect(await main(["check"], cwd)).toBe(0);
  });
});
