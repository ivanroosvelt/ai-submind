import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { SCHEMA_URI, Workspace, type Diagnostic, type LinkResult } from "@flo/core";

/** Carpetas que ni la carga ni el watcher recorren (spec de conocimiento §6). */
export const IGNORED = new Set(["node_modules", ".git"]);

/** Los documentos del workspace: `.flo`, `.md` y el esquema en la raíz (decisión #29). */
export function isDocumentUri(uri: string): boolean {
  return uri === SCHEMA_URI || uri.endsWith(".flo") || uri.endsWith(".md");
}

export function isIgnored(uri: string): boolean {
  return uri.split("/").some((segment) => IGNORED.has(segment));
}

/**
 * Una carpeta del disco como workspace (decisión #33). El disco manda: el
 * estado es el mapa `uri → fuente` leído de él. `link()` es perezoso y se
 * invalida con cada cambio; nunca se conserva un `LinkResult` viejo porque
 * el siguiente `link()` reescribe sus `Ref.target`.
 */
export class FloFolder {
  readonly root: string;
  protected sources = new Map<string, string>();
  protected workspace = new Workspace();
  protected linked: LinkResult | null = null;

  constructor(root: string) {
    this.root = realpathSync(resolve(root));
  }

  /** Relee toda la carpeta. No sigue enlaces simbólicos: nada de fuera de la raíz entra. */
  load(): void {
    this.sources.clear();
    this.workspace = new Workspace();
    this.linked = null;
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory() && !IGNORED.has(entry.name)) walk(path);
        else if (entry.isFile()) this.refresh(this.uriOf(path));
      }
    };
    walk(this.root);
  }

  link(): LinkResult {
    return (this.linked ??= this.workspace.link());
  }

  /**
   * Sin `uri`: los diagnósticos de los documentos que tienen alguno. Con
   * `uri`: los de ese documento (también vacíos), o null si no es un
   * documento del workspace.
   */
  diagnostics(uri?: string): Record<string, Diagnostic[]> | null {
    const all = this.link().diagnostics;
    if (uri !== undefined) {
      const found = all.get(uri);
      return found ? { [uri]: found } : null;
    }
    return Object.fromEntries([...all].filter(([, list]) => list.length > 0));
  }

  /** Ruta de una herramienta (relativa a la raíz, o absoluta dentro de ella) → uri, o null si sale de la raíz. */
  toUri(path: string): string | null {
    const rel = relative(this.root, resolve(this.root, path));
    if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
    return rel.split(sep).join("/");
  }

  protected uriOf(path: string): string {
    return relative(this.root, path).split(sep).join("/");
  }

  /** Relee un archivo; si ya no es un archivo regular (borrado, enlace, directorio), sale del workspace. */
  protected refresh(uri: string): void {
    if (!isDocumentUri(uri) || isIgnored(uri)) return;
    this.linked = null;
    const path = join(this.root, uri);
    if (lstatSync(path, { throwIfNoEntry: false })?.isFile()) {
      const source = readFileSync(path, "utf8");
      this.sources.set(uri, source);
      this.workspace.setDocument(uri, source);
    } else {
      this.sources.delete(uri);
      this.workspace.removeDocument(uri);
    }
  }
}
