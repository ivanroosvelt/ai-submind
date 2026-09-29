import { randomBytes } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
  type FSWatcher,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
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

export type UriDiagnostic = Diagnostic & { uri: string };

export type WriteResult = { ok: true; uri: string } | { ok: false; error: string; diagnostics: UriDiagnostic[] };

const fail = (error: string, diagnostics: UriDiagnostic[] = []): WriteResult => ({ ok: false, error, diagnostics });

const errorKey = (d: Diagnostic): string =>
  `${d.code} ${d.range.start.line}:${d.range.start.column}-${d.range.end.line}:${d.range.end.column} ${d.message}`;

/**
 * Errores que `write_node` no acepta (decisión #34): todos los del archivo
 * escrito, y en los demás los que `before` no tenía (multiconjunto).
 */
function newErrors(before: LinkResult, after: LinkResult, uri: string): UriDiagnostic[] {
  const found: UriDiagnostic[] = [];
  for (const [other, list] of after.diagnostics) {
    const errors = list.filter((d) => d.severity === "error");
    if (other === uri) {
      found.push(...errors.map((d) => ({ uri: other, ...d })));
      continue;
    }
    const previous = (before.diagnostics.get(other) ?? []).filter((d) => d.severity === "error").map(errorKey);
    for (const d of errors) {
      const index = previous.indexOf(errorKey(d));
      if (index >= 0) previous.splice(index, 1);
      else found.push({ uri: other, ...d });
    }
  }
  return found;
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
    // `.native` devuelve las mayúsculas del disco en macOS (APFS no distingue
    // mayúsculas); `realpathSync` a secas conserva las que vinieron en `root`.
    this.root = realpathSync.native(resolve(root));
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

  /** `write_node` (spec §6, decisión #34): valida en un workspace de prueba y escribe de forma atómica. */
  write(path: string, content: string): WriteResult {
    const guard = this.toUri(path);
    if (guard === null) return fail(`la ruta '${path}' sale de la carpeta raíz`);

    // Mayúsculas: en FS case-insensitive (APFS), 'KB/a.md' y 'kb/a.md' son el
    // mismo archivo en disco pero claves distintas del mapa `sources`; sin
    // canonizar, el workspace de prueba vería dos documentos donde el disco
    // solo tiene uno. `canonicalize` resuelve el ancestro existente más
    // cercano con las mayúsculas del disco (y de paso hace de guarda de
    // enlaces simbólicos: reemplaza al viejo `insideRoot`).
    const file = this.canonicalize(join(this.root, guard));
    if (file === null) return fail(`la ruta '${path}' sale de la carpeta raíz por un enlace simbólico`);
    const uri = this.uriOf(file);

    if (!uri.endsWith(".md") && !uri.endsWith(".flo")) return fail(`solo se escriben archivos .md o .flo: '${path}'`);
    if (isIgnored(uri)) return fail(`la ruta '${path}' está en una carpeta ignorada (node_modules, .git)`);

    const trial = new Workspace();
    for (const [other, source] of this.sources) if (other !== uri) trial.setDocument(other, source);
    trial.setDocument(uri, content);
    const after = trial.link();
    if (!after.diagnostics.has(uri)) {
      return fail(`'${path}' no es un documento del workspace: un .md tiene que empezar con '---'`);
    }
    const errors = newErrors(this.link(), after, uri);
    if (errors.length > 0) return fail(`'${path}' no se escribió: tiene errores o rompe otros archivos`, errors);

    const temp = join(dirname(file), `.${basename(file)}.${randomBytes(6).toString("hex")}.tmp`);
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(temp, content);
      renameSync(temp, file);
    } catch (error) {
      try {
        rmSync(temp, { force: true });
      } catch {
        // El temporal puede colgar de una ruta que ya no es un directorio (ENOTDIR); no hay nada que limpiar.
      }
      return fail(`no se pudo escribir '${path}': ${(error as NodeJS.ErrnoException).code ?? "error de E/S"}`);
    }
    this.sources.set(uri, content);
    this.workspace.setDocument(uri, content);
    this.linked = null;
    return { ok: true, uri };
  }

  /**
   * Sube por los ancestros de `file` (él mismo incluido) hasta uno que
   * exista, lo resuelve con `realpathSync.native` (mayúsculas del disco) y
   * reconstruye los segmentos que todavía no existen tal como vinieron.
   * Null si el ancestro resuelto sale de la raíz (por ejemplo, un enlace
   * simbólico).
   */
  private canonicalize(file: string): string | null {
    const pending: string[] = [];
    let dir = file;
    for (;;) {
      try {
        const real = realpathSync.native(dir);
        if (real !== this.root && !real.startsWith(this.root + sep)) return null;
        return pending.length > 0 ? join(real, ...pending) : real;
      } catch {
        pending.unshift(basename(dir));
        dir = dirname(dir);
      }
    }
  }

  /** Sigue los cambios del disco (spec §6, decisión #33). Quien llama cierra el watcher. */
  watch(): FSWatcher {
    const watcher = watch(this.root, { recursive: true }, (_event, filename) => this.onChange(filename));
    watcher.on("error", (error) => console.error(`flo-mcp: ${error.message}`));
    return watcher;
  }

  private onChange(filename: string | null): void {
    if (filename === null) return this.load();
    const uri = filename.split(sep).join("/");
    if (isIgnored(uri)) return;
    if (isDocumentUri(uri)) return this.refresh(uri);
    // Un directorio creado, movido o borrado solo avisa por sí mismo, no por sus archivos.
    const isDirectory = statSync(join(this.root, uri), { throwIfNoEntry: false })?.isDirectory() ?? false;
    if (isDirectory || [...this.sources.keys()].some((known) => known.startsWith(`${uri}/`))) this.load();
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
