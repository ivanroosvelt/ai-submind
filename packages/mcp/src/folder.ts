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
import { IGNORED_DIRS, Workspace, isDocumentUri, isIgnoredUri, type Diagnostic, type LinkResult } from "@flo/core";

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
  for (const [other, errors] of after.diagnostics) {
    if (other === uri) {
      found.push(...errors.map((d) => ({ uri: other, ...d })));
      continue;
    }
    const previous = (before.diagnostics.get(other) ?? []).map(errorKey);
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
  /** Un `fs.watch` no recursivo por directorio mientras se observa (decisión #36); null si no. */
  private watchers: Map<string, FSWatcher> | null = null;

  constructor(root: string) {
    // `.native` devuelve las mayúsculas del disco en macOS (APFS no distingue
    // mayúsculas); `realpathSync` a secas conserva las que vinieron en `root`.
    this.root = realpathSync.native(resolve(root));
  }

  /**
   * Relee toda la carpeta. No sigue enlaces simbólicos: nada de fuera de la
   * raíz entra. El estado nuevo se arma aparte y reemplaza al viejo solo al
   * final: una relectura nunca deja un workspace a medias.
   */
  load(): void {
    const sources = new Map<string, string>();
    const workspace = new Workspace();
    const { dirs, files } = this.walk();
    for (const uri of files) this.refresh(uri, sources, workspace);
    this.sources = sources;
    this.workspace = workspace;
    this.linked = null;
    this.syncWatchers(dirs);
  }

  /**
   * Los directorios de la carpeta (la raíz incluida; sin carpetas ignoradas
   * ni enlaces simbólicos) y los archivos que cuelgan de ellos, como uris. Un
   * directorio ilegible se loguea y se salta.
   */
  protected walk(): { dirs: string[]; files: string[] } {
    const dirs: string[] = [];
    const files: string[] = [];
    const visit = (dir: string): void => {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch (error) {
        console.error(`flo-mcp: se salta un directorio ilegible: ${(error as Error).message}`);
        return;
      }
      dirs.push(dir);
      for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name)) visit(path);
        else if (entry.isFile()) files.push(this.uriOf(path));
      }
    };
    visit(this.root);
    return { dirs, files };
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

  /**
   * Ruta de una herramienta → uri con las mayúsculas del disco, o null si
   * sale de la raíz (por la ruta misma o por un enlace simbólico).
   * Mayúsculas: en FS case-insensitive (APFS), 'KB/a.md' y 'kb/a.md' son el
   * mismo archivo en disco pero claves distintas del mapa `sources`; sin
   * canonizar, `write` vería dos documentos donde el disco solo tiene uno y
   * `check` no encontraría el archivo.
   */
  canonicalUri(path: string): string | null {
    const uri = this.toUri(path);
    const file = uri === null ? null : this.canonicalize(join(this.root, uri));
    return file === null ? null : this.uriOf(file);
  }

  /** `write_node` (spec §6, decisión #34): valida en un workspace de prueba y escribe de forma atómica. */
  write(path: string, content: string): WriteResult {
    const uri = this.canonicalUri(path);
    if (uri === null) return fail(`la ruta '${path}' sale de la carpeta raíz (directamente o por un enlace simbólico)`);
    const file = join(this.root, uri);

    if (!uri.endsWith(".md") && !uri.endsWith(".flo")) return fail(`solo se escriben archivos .md o .flo: '${path}'`);
    if (isIgnoredUri(uri)) return fail(`la ruta '${path}' está en una carpeta ignorada (node_modules, .git)`);

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

  /**
   * Sigue los cambios del disco (spec §6, decisiones #33 y #36): un
   * `fs.watch` no recursivo por directorio, resincronizado en cada `load()`.
   * Quien llama cierra con `close()`.
   */
  watch(): { close(): void } {
    this.watchers ??= new Map();
    this.syncWatchers(this.walk().dirs);
    return {
      close: () => {
        for (const watcher of this.watchers?.values() ?? []) watcher.close();
        this.watchers = null;
      },
    };
  }

  /** Abre watchers para los directorios nuevos y cierra los de los que ya no están. */
  private syncWatchers(dirs: string[]): void {
    const watchers = this.watchers;
    if (watchers === null) return;
    const current = new Set(dirs);
    for (const [dir, watcher] of watchers) {
      if (!current.has(dir)) {
        watcher.close();
        watchers.delete(dir);
      }
    }
    for (const dir of dirs) {
      if (watchers.has(dir)) continue;
      try {
        const watcher = watch(dir, (_event, filename) =>
          this.onChange(filename === null ? null : this.uriOf(join(dir, filename)))
        );
        // Un directorio observado que se borra puede emitir un error: se cierra su watcher.
        watcher.on("error", (error) => {
          console.error(`flo-mcp: ${error.message}`);
          watcher.close();
          if (watchers.get(dir) === watcher) watchers.delete(dir);
        });
        watchers.set(dir, watcher);
      } catch (error) {
        console.error(`flo-mcp: no se pudo observar '${dir}': ${(error as Error).message}`);
      }
    }
  }

  private onChange(uri: string | null): void {
    // Un error de E/S entre el evento y la relectura (borrado, chmod, ENOTDIR,
    // ELOOP) no puede tumbar el proceso del servidor MCP: se loguea y se sigue.
    try {
      if (uri === null) return void this.load();
      if (isIgnoredUri(uri)) return;
      if (isDocumentUri(uri)) return void this.refresh(uri);
      // Un directorio creado, movido o borrado solo avisa por sí mismo, no por sus archivos.
      const isDirectory = statSync(join(this.root, uri), { throwIfNoEntry: false })?.isDirectory() ?? false;
      if (!isDirectory && ![...this.sources.keys()].some((known) => known.startsWith(`${uri}/`))) return;
      // Un directorio borrado y recreado con la misma ruta (git checkout) deja
      // muerto el watcher viejo: se cierran los de ese subárbol y `load` los reabre.
      const path = join(this.root, uri);
      for (const [dir, watcher] of this.watchers ?? []) {
        if (dir === path || dir.startsWith(path + sep)) {
          watcher.close();
          this.watchers?.delete(dir);
        }
      }
      this.load();
    } catch (error) {
      console.error(`flo-mcp: ${(error as Error).message}`);
    }
  }

  protected uriOf(path: string): string {
    return relative(this.root, path).split(sep).join("/");
  }

  /**
   * Relee un archivo; si ya no es un archivo regular (borrado, enlace,
   * directorio) o no se puede leer ni hacerle `lstat` (permisos, ENOTDIR,
   * ELOOP), sale del workspace en vez de propagar la excepción. `load` le
   * pasa el mapa y el workspace que está armando.
   */
  protected refresh(uri: string, sources = this.sources, workspace = this.workspace): void {
    if (!isDocumentUri(uri) || isIgnoredUri(uri)) return;
    this.linked = null;
    const path = join(this.root, uri);
    let source: string | null = null;
    try {
      if (lstatSync(path, { throwIfNoEntry: false })?.isFile()) source = readFileSync(path, "utf8");
    } catch {
      source = null;
    }
    if (source !== null) {
      sources.set(uri, source);
      workspace.setDocument(uri, source);
    } else {
      sources.delete(uri);
      workspace.removeDocument(uri);
    }
  }
}
