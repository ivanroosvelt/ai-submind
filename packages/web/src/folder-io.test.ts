import { describe, it, expect, vi, afterEach } from "vitest";
import { ensurePermission, isWorkspaceFile, openFolder, writeWorkspaceFile } from "./folder-io.js";

type Tree = { [name: string]: string | Tree };

function fakeDir(name: string, tree: Tree): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *values() {
      for (const [child, value] of Object.entries(tree)) {
        yield typeof value === "string"
          ? { kind: "file", name: child, getFile: async () => new File([value], child) }
          : fakeDir(child, value);
      }
    },
  } as unknown as FileSystemDirectoryHandle;
}

/** Un directorio que registra lo que se escribe, por ruta. */
function recordingDir(written: Record<string, string>, prefix = ""): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    getDirectoryHandle: vi.fn(async (name: string) => recordingDir(written, `${prefix}${name}/`)),
    getFileHandle: vi.fn(async (name: string) => ({
      createWritable: async () => ({
        write: async (data: string) => {
          written[`${prefix}${name}`] = data;
        },
        close: async () => {},
      }),
    })),
  } as unknown as FileSystemDirectoryHandle;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
});

describe("isWorkspaceFile", () => {
  it("accepts .flo, .md and the root schema only", () => {
    expect(isWorkspaceFile("a.flo")).toBe(true);
    expect(isWorkspaceFile("kb/n.md")).toBe(true);
    expect(isWorkspaceFile("knowledge.schema.yaml")).toBe(true);
    expect(isWorkspaceFile("sub/knowledge.schema.yaml")).toBe(false);
    expect(isWorkspaceFile("logo.png")).toBe(false);
    expect(isWorkspaceFile("node_modules/x/a.flo")).toBe(false);
    expect(isWorkspaceFile(".git/a.md")).toBe(false);
  });
});

describe("openFolder", () => {
  it("reads a real-looking folder with the File System Access API", async () => {
    const dir = fakeDir("proyecto", {
      "knowledge.schema.yaml": "type_tags: []\nrelation_types: []\n",
      "catalog.flo": "entity a\n",
      "logo.png": "binario",
      "README.md": "# sin frontmatter\n",
      flujos: { "login.flo": "flow f {\n}\n", "knowledge.schema.yaml": "no" },
      node_modules: { pkg: { "x.flo": "entity x\n" } },
      ".git": { "HEAD.md": "---\n" },
    });
    window.showDirectoryPicker = vi.fn().mockResolvedValue(dir);

    const snapshot = await openFolder();

    expect(window.showDirectoryPicker).toHaveBeenCalledWith({ mode: "readwrite" });
    expect(Object.keys(snapshot!.files).sort()).toEqual([
      "README.md",
      "catalog.flo",
      "flujos/login.flo",
      "knowledge.schema.yaml",
    ]);
    expect(snapshot!.saved).toEqual(snapshot!.files);
    expect(snapshot!.active).toBe("README.md");
    expect(snapshot!.dir).toBe(dir);
  });

  it("returns null when the picker is cancelled", async () => {
    window.showDirectoryPicker = vi.fn().mockRejectedValue(new DOMException("x", "AbortError"));
    expect(await openFolder()).toBeNull();
  });

  it("falls back to <input webkitdirectory>, read-only", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      const file = (path: string, content: string) => {
        const f = new File([content], path.split("/").pop()!);
        Object.defineProperty(f, "webkitRelativePath", { value: path });
        return f;
      };
      const files = [file("proyecto/a.flo", "entity a\n"), file("proyecto/node_modules/b.flo", "x"), file("proyecto/img.png", "x")];
      Object.defineProperty(this, "files", { value: files, configurable: true });
      this.dispatchEvent(new Event("change"));
    });

    const snapshot = await openFolder();

    expect(snapshot).toEqual({ files: { "a.flo": "entity a\n" }, saved: { "a.flo": "entity a\n" }, active: "a.flo", dir: null });
  });
});

describe("writeWorkspaceFile", () => {
  it("writes into nested folders, creating them", async () => {
    const written: Record<string, string> = {};
    const dir = recordingDir(written);
    await writeWorkspaceFile(dir, "kb/notas/a.md", "---\n");
    expect(written).toEqual({ "kb/notas/a.md": "---\n" });
    expect(dir.getDirectoryHandle).toHaveBeenCalledWith("kb", { create: true });
  });
});

describe("ensurePermission", () => {
  it("asks for the requested mode only when it is not granted yet", async () => {
    const granted = { queryPermission: vi.fn().mockResolvedValue("granted"), requestPermission: vi.fn() };
    expect(await ensurePermission(granted as unknown as FileSystemDirectoryHandle, "read")).toBe(true);
    expect(granted.queryPermission).toHaveBeenCalledWith({ mode: "read" });
    expect(granted.requestPermission).not.toHaveBeenCalled();
    const denied = { queryPermission: vi.fn().mockResolvedValue("prompt"), requestPermission: vi.fn().mockResolvedValue("denied") };
    expect(await ensurePermission(denied as unknown as FileSystemDirectoryHandle, "readwrite")).toBe(false);
    expect(denied.requestPermission).toHaveBeenCalledWith({ mode: "readwrite" });
  });

  it("assumes permission when the browser has no permission API", async () => {
    expect(await ensurePermission({} as FileSystemDirectoryHandle, "readwrite")).toBe(true);
  });
});
