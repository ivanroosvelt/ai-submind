import { MEMORY_TYPES, type Where } from "@tejo/core";
import { readFileAsText } from "./file-io.js";
import { writeWorkspaceFile } from "./folder-io.js";
import type { GraphQuery } from "./knowledge-view.js";
import { readLocalViews } from "./local-folder.js";
import type { ViewBox } from "./pan-zoom.js";

/** Una vista guardada de la vista de grafo (spec de conocimiento §7, decisión #46). */
export interface Preset extends GraphQuery {
  name: string;
}

export const PRESETS_DIR = ".flo/views";

const NAME = /^[A-Za-z0-9_-]+$/;
const MEMORY = new Set<string>(MEMORY_TYPES);
const SCALAR = new Set(["string", "number", "boolean"]);

export function isPresetName(name: string): boolean {
  return NAME.test(name);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `Where` estricto, como el esquema `zod` de MCP: una clave desconocida o un tipo incorrecto lo invalida. */
export function isWhere(value: unknown): value is Where {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 2) {
    return typeof value.custom === "string" && "equals" in value && SCALAR.has(typeof value.equals);
  }
  if (keys.length !== 1) return false;
  const inner = value[keys[0]];
  switch (keys[0]) {
    case "and":
    case "or":
      return Array.isArray(inner) && inner.every(isWhere);
    case "not":
      return isWhere(inner);
    case "memory":
      return typeof inner === "string" && MEMORY.has(inner);
    case "typeTag":
    case "contextTag":
    case "custom":
    case "text":
      return typeof inner === "string";
    default:
      return false;
  }
}

const isViewBox = (value: unknown): value is ViewBox =>
  Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && value[2] > 0 && value[3] > 0;

/** El contenido de `.flo/views/<name>.json`; null si no es JSON o no tiene la forma. Manda el nombre del archivo. */
export function parsePreset(name: string, text: string): Preset | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(value) || !isWhere(value.where)) return null;
  const { depth, from = null, viewBox = null } = value;
  if (typeof depth !== "number" || !Number.isInteger(depth) || depth < 0) return null;
  if (from !== null && !(Array.isArray(from) && from.every((id) => typeof id === "string"))) return null;
  if (viewBox !== null && !isViewBox(viewBox)) return null;
  return { name, where: value.where, from, depth, viewBox };
}

export const byName = (a: Preset, b: Preset) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

async function viewsDir(dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (await dir.getDirectoryHandle(".flo")).getDirectoryHandle("views");
  } catch (error) {
    // Sin `.flo/views` (o con un archivo con ese nombre) no hay vistas.
    if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "TypeMismatchError")) return null;
    throw error;
  }
}

/** Las vistas válidas de la carpeta, por nombre; las demás se saltan con un aviso. */
export async function listPresets(dir: FileSystemDirectoryHandle): Promise<Preset[]> {
  const views = await viewsDir(dir);
  if (!views) return [];
  const presets: Preset[] = [];
  for await (const handle of views.values()) {
    if (handle.kind !== "file" || !handle.name.endsWith(".json")) continue;
    const name = handle.name.slice(0, -".json".length);
    let preset: Preset | null = null;
    try {
      if (isPresetName(name)) preset = parsePreset(name, await readFileAsText(await (handle as FileSystemFileHandle).getFile()));
    } catch {
      // Archivo ilegible (permisos, I/O): se salta igual que uno inválido.
      preset = null;
    }
    if (preset) presets.push(preset);
    else console.warn(`tejo: se ignora la vista ${PRESETS_DIR}/${handle.name} (nombre o contenido inválido)`);
  }
  return presets.sort(byName);
}

export const presetUri = (name: string) => `${PRESETS_DIR}/${name}.json`;

export function presetJson({ name, where, from, depth, viewBox }: Preset): string {
  return `${JSON.stringify({ name, where, from, depth, viewBox }, null, 2)}\n`;
}

export async function savePreset(dir: FileSystemDirectoryHandle, preset: Preset): Promise<void> {
  await writeWorkspaceFile(dir, presetUri(preset.name), presetJson(preset));
}

/** Las vistas de `tejo view` (#66), con las mismas reglas que `listPresets`. */
export async function listLocalPresets(): Promise<Preset[]> {
  const presets: Preset[] = [];
  for (const [name, text] of Object.entries(await readLocalViews())) {
    const preset = isPresetName(name) ? parsePreset(name, text) : null;
    if (preset) presets.push(preset);
    else console.warn(`tejo: se ignora la vista ${PRESETS_DIR}/${name}.json (nombre o contenido inválido)`);
  }
  return presets.sort(byName);
}
