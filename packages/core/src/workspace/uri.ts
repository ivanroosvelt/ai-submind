import type { DocumentUri } from "../ast.js";

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
