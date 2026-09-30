export type MemoryTree = { [name: string]: string | MemoryTree };

/** Carpeta en memoria con la forma de File System Access que usa la web; lo escrito queda en `tree`. Solo tests. */
export function memoryDir(tree: MemoryTree, name = ""): FileSystemDirectoryHandle {
  const fail = (child: string, kind: string) => new DOMException(`'${child}': ${kind}`, kind);
  const fileHandle = (child: string) => ({
    kind: "file",
    name: child,
    getFile: async () => new File([tree[child] as string], child),
    createWritable: async () => {
      let data = "";
      return {
        write: async (chunk: string) => {
          data += chunk;
        },
        close: async () => {
          tree[child] = data;
        },
      };
    },
  });
  return {
    kind: "directory",
    name,
    async *values() {
      for (const [child, value] of Object.entries(tree)) {
        yield typeof value === "string" ? fileHandle(child) : memoryDir(value, child);
      }
    },
    async getDirectoryHandle(child: string, options?: { create?: boolean }) {
      if (!(child in tree)) {
        if (!options?.create) throw fail(child, "NotFoundError");
        tree[child] = {};
      }
      const value = tree[child];
      if (typeof value === "string") throw fail(child, "TypeMismatchError");
      return memoryDir(value, child);
    },
    async getFileHandle(child: string, options?: { create?: boolean }) {
      if (!(child in tree)) {
        if (!options?.create) throw fail(child, "NotFoundError");
        tree[child] = "";
      }
      if (typeof tree[child] !== "string") throw fail(child, "TypeMismatchError");
      return fileHandle(child);
    },
  } as unknown as FileSystemDirectoryHandle;
}
