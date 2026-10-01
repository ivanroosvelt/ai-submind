import type { BlockId, DocumentUri } from "../ast.js";

/**
 * Resuelve la ruta de un `use` relativa al documento que la declara. Las
 * uris son rutas POSIX relativas a la raíz del workspace; un '/' inicial
 * parte de la raíz. Devuelve null si la ruta sale de la raíz o no nombra
 * nada. Sin `node:path`: `@flo/core` también corre en el navegador.
 */
export function resolveUse(from: DocumentUri, path: string): DocumentUri | null {
  const parts = path.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.length === 0 ? null : parts.join("/");
}

/** Identidad de un bloque en el workspace: `uri#nombre` (decisión #25). */
export function blockId(uri: DocumentUri, name: string): BlockId {
  return `${uri}#${name}`;
}

/** Inverso de `blockId`: el nombre es un identificador (sin '#'), así que va después del último '#'. */
export function parseBlockId(id: BlockId): { uri: DocumentUri; name: string } {
  const hash = id.lastIndexOf("#");
  return { uri: id.slice(0, hash), name: id.slice(hash + 1) };
}

/** Carpetas que ni la carga ni el watcher recorren (#33, #37). */
export const IGNORED_DIRS: ReadonlySet<string> = new Set(["node_modules", ".git"]);

/** Los documentos del workspace: `.flo` y `.md` (decisión #62: sin esquema). */
export function isDocumentUri(uri: string): boolean {
  return uri.endsWith(".flo") || uri.endsWith(".md");
}

export function isIgnoredUri(uri: string): boolean {
  return uri.split("/").some((segment) => IGNORED_DIRS.has(segment));
}
