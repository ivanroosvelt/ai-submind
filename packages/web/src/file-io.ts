const FLO_PICKER_OPTIONS: FilePickerOptions = {
  types: [{ description: "Diagrama .flo", accept: { "text/plain": [".flo"] } }],
};

export function hasFileSystemAccess(): boolean {
  return typeof window !== "undefined" && typeof window.showOpenFilePicker === "function";
}

export interface OpenResult {
  source: string;
  handle: FileSystemFileHandle | null;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("no se pudo leer el archivo"));
    reader.readAsText(file);
  });
}

function openFloFileFallback(): Promise<OpenResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".flo,text/plain";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      readFileAsText(file).then((source) => resolve({ source, handle: null }));
    });
    input.click();
  });
}

export async function openFloFile(): Promise<OpenResult | null> {
  if (hasFileSystemAccess()) {
    const [handle] = await window.showOpenFilePicker!(FLO_PICKER_OPTIONS);
    const file = await handle.getFile();
    return { source: await readFileAsText(file), handle };
  }
  return openFloFileFallback();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadText(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export async function saveFloFile(
  source: string,
  handle: FileSystemFileHandle | null
): Promise<FileSystemFileHandle | null> {
  if (hasFileSystemAccess()) {
    const target = handle ?? (await window.showSaveFilePicker!(FLO_PICKER_OPTIONS));
    const writable = await target.createWritable();
    await writable.write(source);
    await writable.close();
    return target;
  }
  downloadText(source, "diagrama.flo", "text/plain");
  return null;
}
