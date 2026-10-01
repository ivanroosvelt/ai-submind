import { ask } from "./dialogs.js";

const FLO_PICKER_OPTIONS: FilePickerOptions = {
  types: [{ description: "Documento .flo o .md", accept: { "text/plain": [".flo", ".md"] } }],
};

export function hasFileSystemAccess(): boolean {
  return typeof window !== "undefined" && typeof window.showOpenFilePicker === "function";
}

export interface OpenResult {
  source: string;
  handle: FileSystemFileHandle | null;
  name: string;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("no se pudo leer el archivo"));
    reader.readAsText(file);
  });
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function openFloFileFallback(): Promise<OpenResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".flo,.md,text/plain";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      readFileAsText(file).then((source) => resolve({ source, handle: null, name: file.name }), reject);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

export async function openFloFile(): Promise<OpenResult | null> {
  if (hasFileSystemAccess()) {
    let handle: FileSystemFileHandle;
    try {
      [handle] = await window.showOpenFilePicker!(FLO_PICKER_OPTIONS);
    } catch (error) {
      if (isAbortError(error)) return null;
      throw error;
    }
    const file = await handle.getFile();
    return { source: await readFileAsText(file), handle, name: handle.name };
  }
  return openFloFileFallback();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export async function saveFloFile(
  source: string,
  handle: FileSystemFileHandle | null,
  name: string
): Promise<FileSystemFileHandle | null> {
  if (hasFileSystemAccess()) {
    let target: FileSystemFileHandle;
    if (handle) {
      target = handle;
    } else {
      try {
        target = await window.showSaveFilePicker!({ ...FLO_PICKER_OPTIONS, suggestedName: name.slice(name.lastIndexOf("/") + 1) });
      } catch (error) {
        if (isAbortError(error)) return null;
        throw error;
      }
    }
    const writable = await target.createWritable();
    await writable.write(source);
    await writable.close();
    return target;
  }
  const chosenName = await ask("Nombre del archivo para descargar:", name);
  if (chosenName === null) return null;
  downloadText(source, chosenName.trim() || name, "text/plain");
  return null;
}
