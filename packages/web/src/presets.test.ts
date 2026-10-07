import { describe, it, expect, vi, afterEach } from "vitest";
import { isPresetName, isWhere, listLocalPresets, listPresets, parsePreset, savePreset, type Preset } from "./presets.js";
import { memoryDir, type MemoryTree } from "./test-dir.js";

afterEach(() => vi.restoreAllMocks());

vi.mock("./local-folder.js", () => ({
  readLocalViews: vi.fn(async () => ({ b: JSON.stringify({ where: { memory: "long_term" }, depth: 1 }), a: "no json", "x y": "{}" })),
}));

const PRESET: Preset = {
  name: "decisiones",
  where: { and: [{ text: "" }, { typeTag: "decision" }] },
  from: null,
  depth: 1,
  viewBox: [0, 0, 400, 300],
};

describe("isPresetName", () => {
  it("accepts letters, digits, '-' and '_' only", () => {
    expect(isPresetName("mis-vistas_2")).toBe(true);
    for (const bad of ["", "../x", "a/b", "a b", "a.json", "ñandú"]) expect(isPresetName(bad), bad).toBe(false);
  });
});

describe("isWhere", () => {
  it("accepts every Where shape", () => {
    const where = {
      and: [
        { or: [{ memory: "working" }, { not: { typeTag: "x" } }] },
        { contextTag: "project:" },
        { custom: "status" },
        { custom: "level", equals: 3 },
        { text: "a" },
      ],
    };
    expect(isWhere(where)).toBe(true);
  });

  it("rejects unknown keys, wrong types and bad memory types", () => {
    for (const bad of [
      {},
      { type_tag: "x" },
      { text: 1 },
      { and: {} },
      { memory: "forever" },
      { text: "a", extra: 1 },
      { custom: "a", equals: null },
      { equals: 1, other: 2 },
      null,
      [],
    ]) {
      expect(isWhere(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("parsePreset", () => {
  it("reads a valid preset and takes its name from the file", () => {
    expect(parsePreset("decisiones", JSON.stringify({ ...PRESET, name: "otro" }))).toEqual(PRESET);
    expect(parsePreset("x", JSON.stringify({ where: { text: "" }, depth: 0 }))).toEqual({
      name: "x",
      where: { text: "" },
      from: null,
      depth: 0,
      viewBox: null,
    });
  });

  it("rejects broken JSON and wrong shapes", () => {
    const ok = { where: { text: "" }, depth: 1 };
    for (const bad of [
      "no es json",
      "[]",
      JSON.stringify({ ...ok, where: { type_tag: "x" } }),
      JSON.stringify({ ...ok, depth: -1 }),
      JSON.stringify({ ...ok, depth: 1.5 }),
      JSON.stringify({ ...ok, from: "a" }),
      JSON.stringify({ ...ok, from: [1] }),
      JSON.stringify({ ...ok, viewBox: [0, 0, 0, 10] }),
      JSON.stringify({ ...ok, viewBox: [0, 0, 10] }),
    ]) {
      expect(parsePreset("x", bad), bad).toBeNull();
    }
  });
});

describe("listPresets / savePreset", () => {
  it("gives no presets when the folder has no .flo/views", async () => {
    expect(await listPresets(memoryDir({}))).toEqual([]);
    expect(await listPresets(memoryDir({ ".flo": "un archivo" }))).toEqual([]);
  });

  it("round-trips a saved preset as pretty JSON", async () => {
    const tree: MemoryTree = {};
    await savePreset(memoryDir(tree), PRESET);
    const written = ((tree[".flo"] as MemoryTree).views as MemoryTree)["decisiones.json"];
    expect(written).toBe(`${JSON.stringify(PRESET, null, 2)}\n`);
    expect(await listPresets(memoryDir(tree))).toEqual([PRESET]);
  });

  it("lists valid presets by name and skips the rest with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const valid = (name: string) => JSON.stringify({ ...PRESET, name });
    const tree: MemoryTree = {
      ".flo": {
        views: {
          "b.json": valid("b"),
          "a.json": valid("a"),
          "roto.json": "{",
          "con espacio.json": valid("con espacio"),
          "notas.txt": "no es una vista",
          sub: { "c.json": valid("c") },
        },
      },
    };
    expect((await listPresets(memoryDir(tree))).map((preset) => preset.name)).toEqual(["a", "b"]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("skips a file whose getFile() rejects, keeps the rest and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const okPreset = JSON.stringify({ ...PRESET, name: "ok" });
    const okHandle = { kind: "file", name: "ok.json", getFile: async () => new File([okPreset], "ok.json") };
    const brokenHandle = {
      kind: "file",
      name: "roto.json",
      getFile: async () => {
        throw new Error("no se pudo leer");
      },
    };
    const views = {
      kind: "directory",
      name: "views",
      async *values() {
        yield brokenHandle;
        yield okHandle;
      },
    } as unknown as FileSystemDirectoryHandle;
    const flo = { kind: "directory", name: ".flo", getDirectoryHandle: async () => views } as unknown as FileSystemDirectoryHandle;
    const dir = { kind: "directory", name: "", getDirectoryHandle: async () => flo } as unknown as FileSystemDirectoryHandle;
    expect((await listPresets(dir)).map((preset) => preset.name)).toEqual(["ok"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("listLocalPresets", () => {
  it("valida y ordena como listPresets", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const presets = await listLocalPresets();
    expect(presets.map((p) => p.name)).toEqual(["b"]);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
