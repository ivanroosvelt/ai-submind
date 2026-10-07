import type { WorkspaceSnapshot } from "./workspace.js";

/** La API de `tejo view` (decisión #66), relativa a la página. */
const encode = (uri: string) => uri.split("/").map(encodeURIComponent).join("/");

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("application/json")) {
    throw new Error(`sin API local en ${path}`);
  }
  return res.json();
}

export async function readLocalFiles(): Promise<Record<string, string>> {
  const body = (await getJson("api/files")) as { files?: unknown };
  if (typeof body.files !== "object" || body.files === null) throw new Error("respuesta inválida de api/files");
  return body.files as Record<string, string>;
}

/** Con `tejo view` detrás, el workspace es la carpeta del disco; sin él (Pages, vite), null. */
export async function openLocalFolder(): Promise<WorkspaceSnapshot | null> {
  let files: Record<string, string>;
  try {
    files = await readLocalFiles();
  } catch {
    return null;
  }
  const uris = Object.keys(files).sort();
  return { files, saved: { ...files }, active: uris[0] ?? "", dir: null, local: true };
}

export async function writeLocalFile(uri: string, source: string): Promise<void> {
  const res = await fetch(`api/files/${encode(uri)}`, { method: "PUT", body: source });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `no se pudo guardar '${uri}' (${res.status})`);
  }
}

export async function readLocalViews(): Promise<Record<string, string>> {
  return (await getJson("api/views")) as Record<string, string>;
}

/** Avisa cada cambio del disco; devuelve cómo dejar de escuchar. */
export function watchLocalFolder(onChange: () => void): () => void {
  const source = new EventSource("api/events");
  source.addEventListener("change", onChange);
  return () => source.close();
}
