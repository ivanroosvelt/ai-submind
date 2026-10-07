import { statSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_FOLDER = "knowledge";

/** La carpeta de conocimiento de un comando, absoluta; falla si no es un directorio. */
export function resolveFolder(arg: string | undefined, cwd: string): string {
  const name = arg ?? DEFAULT_FOLDER;
  const path = resolve(cwd, name);
  if (!statSync(path, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`la carpeta '${name}' no existe o no es un directorio`);
  }
  return path;
}
