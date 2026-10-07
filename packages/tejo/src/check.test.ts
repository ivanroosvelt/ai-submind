import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { check } from "./check.js";
import { resolveFolder } from "./folder-arg.js";
import { tempFolder } from "./test-folder.js";

describe("check", () => {
  it("sin errores: ninguna línea de diagnóstico y 0 errores", () => {
    const result = check(tempFolder({ "a.flo": "entity api\n" }));
    expect(result.errors).toBe(0);
    expect(result.lines).toEqual(["Sin errores en 1 archivos."]);
  });

  it("con errores: una línea por diagnóstico, prefijada por la uri, y resumen", () => {
    // Un id declarado dos veces en el mismo documento: E031 (#2).
    const result = check(tempFolder({ "a.flo": "entity web\n", "kb/b.flo": "entity api\nentity api\n" }));
    expect(result.errors).toBe(1);
    expect(result.lines[0]).toMatch(/^kb\/b\.flo E031 error \[\d+:\d+\]: /);
    expect(result.lines.at(-1)).toBe("1 errores en 1 archivos.");
  });
});

describe("resolveFolder", () => {
  it("por defecto es knowledge dentro de cwd", () => {
    const cwd = tempFolder({ "knowledge/a.md": "# x\n" });
    expect(resolveFolder(undefined, cwd)).toBe(join(cwd, "knowledge"));
  });

  it("falla si no existe o es un archivo", () => {
    const cwd = tempFolder({ "x.md": "# x\n" });
    expect(() => resolveFolder("nada", cwd)).toThrow("la carpeta 'nada' no existe o no es un directorio");
    expect(() => resolveFolder("x.md", cwd)).toThrow("la carpeta 'x.md' no existe o no es un directorio");
  });
});
