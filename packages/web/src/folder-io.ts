import { IGNORED_DIRS, SCHEMA_URI, isDocumentUri, isIgnoredUri } from "@flo/core";
import { isAbortError, readFileAsText } from "./file-io.js";
import type { WorkspaceSnapshot } from "./workspace.js";


/** Decisión #37 (la regla de carga de #33 en el navegador): .flo, .md y el esquema solo en la raíz. */
export function isWorkspaceFile(uri: string): boolean {
  return !isIgnoredUri(uri) && isDocumentUri(uri);
}

export function hasDirectoryAccess(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function snapshotOf(files: Record<string, string>, dir: FileSystemDirectoryHandle | null): WorkspaceSnapshot {
  const uris = Object.keys(files).sort();
  return { files, saved: { ...files }, active: uris.find((uri) => uri !== SCHEMA_URI) ?? uris[0] ?? "", dir };
}

async function readDirectory(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  files: Record<string, string>
): Promise<void> {
  for await (const handle of dir.values()) {
    const uri = `${prefix}${handle.name}`;
    if (handle.kind === "directory") {
      if (!IGNORED_DIRS.has(handle.name)) await readDirectory(handle as FileSystemDirectoryHandle, `${uri}/`, files);
    } else if (isWorkspaceFile(uri)) {
      files[uri] = await readFileAsText(await (handle as FileSystemFileHandle).getFile());
    }
  }
}

function openFolderFallback(): Promise<WorkspaceSnapshot | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.addEventListener("change", () => {
      // webkitRelativePath = "<carpeta elegida>/<ruta>": la uri es la ruta sin la carpeta.
      const entries = Array.from(input.files ?? [])
        .map((file) => [file.webkitRelativePath.split("/").slice(1).join("/"), file] as const)
        .filter(([uri]) => isWorkspaceFile(uri));
      Promise.all(entries.map(async ([uri, file]) => [uri, await readFileAsText(file)] as const)).then(
        (read) => resolve(snapshotOf(Object.fromEntries(read), null)),
        reject
      );
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Abre una carpeta como workspace; null si se cancela. */
export async function openFolder(): Promise<WorkspaceSnapshot | null> {
  if (!hasDirectoryAccess()) return openFolderFallback();
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await window.showDirectoryPicker!({ mode: "readwrite" });
  } catch (error) {
    if (isAbortError(error)) return null;
    throw error;
  }
  const files: Record<string, string> = {};
  await readDirectory(dir, "", files);
  return snapshotOf(files, dir);
}

/** Escribe `uri` dentro de la carpeta, creando las subcarpetas que falten. */
export async function writeWorkspaceFile(dir: FileSystemDirectoryHandle, uri: string, source: string): Promise<void> {
  const parts = uri.split("/");
  let current = dir;
  for (const part of parts.slice(0, -1)) current = await current.getDirectoryHandle(part, { create: true });
  const file = await current.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await file.createWritable();
  await writable.write(source);
  await writable.close();
}

/** Un handle restaurado del borrador pierde el permiso al recargar la página: se vuelve a pedir. */
export async function ensurePermission(dir: FileSystemDirectoryHandle, mode: "read" | "readwrite"): Promise<boolean> {
  if (!dir.queryPermission || !dir.requestPermission) return true;
  const descriptor = { mode };
  if ((await dir.queryPermission(descriptor)) === "granted") return true;
  return (await dir.requestPermission(descriptor)) === "granted";
}
