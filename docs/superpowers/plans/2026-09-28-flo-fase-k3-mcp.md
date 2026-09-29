# .flo — servidor MCP local (Fase K3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-09-29 (`df0ff8d`..`a296d3a`, fixes de la revisión final `55c6f11`..`d0b2ffe`). Revisiones por task: task 2 — una ruta con otras mayúsculas (`KB/a.md`) esquivaba la validación en un FS insensible a mayúsculas; `write` canoniza con `realpathSync.native` y el error de E/S solo da el código. Task 3 — una excepción en el callback del watcher tumbaba el servidor; `refresh` trata una lectura fallida como borrado y `onChange` captura y registra. Revisión final: el servidor termina al cerrarse stdin; `load()` tolera directorios ilegibles y reemplaza el estado al final; el `fs.watch` recursivo pasó a un watcher por directorio (decisión #36, por el reemplazo atómico en Linux); `engines` `>=20`, `check` canoniza mayúsculas como `write` (`canonicalUri`) y los tests del watcher esperan a que arranque. Suite: 37 tests en `@flo/mcp`. Lo que quedó sin hacer está en §11, "Pendientes diferidos (Fase K3)". El código y los tests de este plan reflejan lo entregado (incluidos esos fixes).

**Goal:** Paquete nuevo `@flo/mcp` con el binario `flo-mcp <carpeta>`: carga
una carpeta del disco en un `Workspace` de `@flo/core`, la sigue con
`fs.watch` y expone cinco herramientas MCP por stdio (`query`, `get_node`,
`list_tags`, `check`, `write_node`), con validación estricta de la entrada y
escritura atómica que se rechaza si el type-checker falla.

**Architecture:** Tres módulos. `folder.ts` (`FloFolder`) es el estado: el
mapa `uri → fuente` leído del disco, el `Workspace` vivo, el `LinkResult`
enlazado de forma perezosa (se invalida con cada cambio y se vuelve a
enlazar en la siguiente herramienta), la guarda de rutas, la escritura
validada en un workspace de prueba y el watcher. `tools.ts`
(`createServer`) registra las herramientas sobre un `McpServer` del SDK con
esquemas `zod` estrictos y serializa los resultados como JSON. `main.ts` es
el binario: valida el argumento, carga, observa, conecta por stdio y
termina al cerrarse stdin. Todo el I/O de `FloFolder` es síncrono (un
solo hilo, orden determinista).

**Tech Stack:** TypeScript 5 (strict, NodeNext), Node ≥ 20, `@modelcontextprotocol/sdk` 1.31, `zod` 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md`
(§6 `@flo/mcp`, §10 K3, §11 testing K3). Decisiones vigentes en
`docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` §11
(#21, #24, #25, #27, #29, #30, #31, #32 y las nuevas #33–#36 de esta fase,
#33–#35 escritas en §11 junto con este plan, #36 en la revisión final). Pendientes de §11 que este plan
recoge: **K2 → K3** (validar `QueryOptions` con `zod` estricto: task 4) y
**K1 → K3** (test de `use` dentro de una cerca ` ```flo `: task 1; el
relleno de líneas de las cercas no se toca, no hay perfil que lo pida).
Orden de fases: D → E → K1 → K2 → **K3** → F → K4.

## Global Constraints

- **Dependencias nuevas permitidas por el spec (§6), solo en `packages/mcp`:**
  `@modelcontextprotocol/sdk` `^1.31.0` y `zod` `^4.0.0`; más
  `@types/node` `^22.0.0` como devDependency (un paquete Node lo necesita
  para tipar `node:fs`). Ninguna otra. `@flo/core` no cambia.
- **Node ≥ 20** (`engines` del paquete).
- **`@flo/mcp` consume `@flo/core` por `dist/`** (como `@flo/web`): antes
  de correr sus tests, `pnpm --filter @flo/core build`.
- **Imports relativos con sufijo `.js`** (`"module": "NodeNext"`).
- **Mensajes para el agente y comentarios en español**; nombres de test en
  inglés.
- **stdout es el protocolo MCP**: nada de `console.log` en `packages/mcp`;
  los avisos van a `console.error`.
- **Sin códigos de diagnóstico nuevos**: los rechazos de ruta de
  `write_node` son mensajes (`error`), no `Diagnostic`.
- **Snapshots de SVG**: ninguno cambia (no se toca `@flo/core`).
- Un commit por task (`feat(mcp): ...`), con la línea final
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verificación final (desde la raíz): `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

## Review Focus

1. **Escape de la raíz por enlace simbólico** (un directorio dentro de la
   carpeta que apunta afuera): `write_node` lo rechaza y la carga no lo
   recorre. Tests en tasks 1 y 2.
2. **Editar un archivo rompe a otro** (renombrar el `id` de un `.md` que
   otro referencia): se rechaza con los diagnósticos nuevos del otro
   archivo y el disco no cambia; los errores que ya existían en otros
   archivos no bloquean. Tests en task 2.
3. **`.md` sin frontmatter por `write_node`**: no es documento del
   workspace (#21); se rechaza en vez de escribir un archivo que ningún
   `query` verá. Test en task 2.
4. **Borrar, mover o recrear una carpeta entera en disco, o reemplazar un
   archivo con `rename`**: el watcher del directorio padre avisa por nombre;
   la carpeta se relee completa, las entidades de adentro
   desaparecen/aparecen y los watchers se resincronizan. Tests en task 3.
5. **JSON mal formado desde el agente** (`type_tag` en vez de `typeTag`,
   `depth` negativo, `project` desconocido, clave extra): error de
   validación claro, nunca un `TypeError` de `query`. Tests en task 4.

---

## File Structure

- Create `packages/mcp/package.json`, `tsconfig.json`, `tsconfig.build.json`
  — paquete `@flo/mcp`, binario `flo-mcp` → `dist/main.js`.
- Create `packages/mcp/src/folder.ts` — `FloFolder`: carga, enlace
  perezoso, diagnósticos, guarda de ruta, escritura validada, watcher.
- Create `packages/mcp/src/folder.test.ts` — carpeta temporal real.
- Create `packages/mcp/src/tools.ts` — `createServer(folder)`: las cinco
  herramientas y el esquema `zod` de `Where`.
- Create `packages/mcp/src/tools.test.ts` — cliente MCP real por
  `InMemoryTransport`.
- Create `packages/mcp/src/main.ts` — binario stdio.
- Modify `README.md` — sección de `@flo/mcp` (task 4).

---

### Task 1: Paquete `@flo/mcp` y `FloFolder` de solo lectura

**Files:**
- Create: `packages/mcp/package.json`, `packages/mcp/tsconfig.json`, `packages/mcp/tsconfig.build.json`
- Create: `packages/mcp/src/folder.ts`
- Test: `packages/mcp/src/folder.test.ts`

**Interfaces:**
- Consumes (de `@flo/core`, ya existentes): `Workspace` (`setDocument(uri, source)`, `removeDocument(uri)`, `link(): LinkResult`), `SCHEMA_URI` (`"knowledge.schema.yaml"`), tipos `Diagnostic` (`{ code, message, range, severity }`) y `LinkResult` (`entities: Map<EntityId, EntityDecl>` en orden del catálogo, `diagnostics: Map<uri, Diagnostic[]>`, `xref`).
- Produces:
  - `isDocumentUri(uri: string): boolean`, `isIgnored(uri: string): boolean`, `IGNORED`
  - `class FloFolder { readonly root: string; constructor(root: string); load(): void; link(): LinkResult; diagnostics(uri?: string): Record<string, Diagnostic[]> | null; toUri(path: string): string | null }`
  - Protegidos para las tasks 2 y 3 (mismo archivo): `sources`, `workspace`, `linked`, `walk(): { dirs: string[]; files: string[] }`, `uriOf(path)`, `refresh(uri, sources?, workspace?)`.

Semántica (decisión #33): la raíz se resuelve con `realpathSync.native`
(mayúsculas del disco). `load()` arma el estado nuevo aparte y lo
reemplaza solo al final, así una relectura nunca deja un workspace a
medias; `walk()` no entra en `node_modules`, `.git` ni enlaces simbólicos,
y un directorio ilegible se registra con `console.error` y se salta.
`refresh()` trata un archivo que no se puede leer (o al que no se le puede
hacer `lstat`) igual que uno borrado: sale del workspace.

- [ ] **Step 1: Crear el paquete**

`packages/mcp/package.json`:

```json
{
  "name": "@flo/mcp",
  "version": "0.1.0",
  "description": "Servidor MCP local que expone una carpeta de documentos .flo y .md a agentes LLM.",
  "type": "module",
  "bin": {
    "flo-mcp": "dist/main.js"
  },
  "files": [
    "dist"
  ],
  "license": "MIT",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@flo/core": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.31.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/mcp/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`packages/mcp/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["**/*.test.ts"]
}
```

Run: `pnpm install && pnpm --filter @flo/core build`
Expected: instala sin errores; `packages/core/dist/index.js` existe.

- [ ] **Step 2: Write the failing test**

`packages/mcp/src/folder.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FloFolder } from "./folder.js";

const node = (id: string, extra: string[] = []): string =>
  ["---", `id: ${id}`, `title: Nodo ${id}`, "memory_type: long_term", ...extra, "---", "Cuerpo.", ""].join("\n");

/** Carpeta fija de la Fase K3. Catálogo: api, a, b, c; `roto.flo` pierde `api` (E031). */
const FILES: Record<string, string> = {
  "knowledge.schema.yaml": "type_tags: [decision]\nrelation_types: [affects]\n",
  "catalogo.flo": "entity api\n",
  "roto.flo": "entity api\n",
  "kb/a.md": node("a", ["type_tags: [decision]", 'use: ["../catalogo.flo"]', "relations:", "  - target: api", "    type: affects"]),
  // `use` dentro de una cerca ```flo (pendiente de K1): api resuelve sin E030.
  "kb/b.md": node("b") + '\n```flo\nuse "../catalogo.flo"\nflow f {\n  api -> b\n}\n```\n',
  "kb/c.md": node("c", ['use: ["./a.md"]', "relations:", "  - target: a", "    type: affects"]),
  "README.md": "# Notas sin frontmatter\n",
  "notas.txt": "no es un documento\n",
  "node_modules/pkg/x.md": node("x"),
  ".git/y.flo": "entity y\n",
};

const temps: string[] = [];

function tempDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "flo-mcp-"));
  temps.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function loaded(files: Record<string, string> = FILES): FloFolder {
  const folder = new FloFolder(tempDir(files));
  folder.load();
  return folder;
}

afterEach(() => {
  for (const root of temps.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("FloFolder load", () => {
  it("loads .flo, .md with frontmatter and the schema, skipping ignored folders and other files", () => {
    const folder = loaded();
    expect([...folder.link().entities.keys()]).toEqual(["api", "a", "b", "c"]);
  });

  it("reports only non-empty diagnostics, keyed by uri", () => {
    const folder = loaded();
    expect(folder.diagnostics()).toEqual({ "roto.flo": [expect.objectContaining({ code: "E031" })] });
  });

  it("returns one file's diagnostics, or null if it is not a workspace document", () => {
    const folder = loaded();
    expect(folder.diagnostics("kb/a.md")).toEqual({ "kb/a.md": [] });
    expect(folder.diagnostics("README.md")).toBeNull();
    expect(folder.diagnostics("notas.txt")).toBeNull();
  });

  it("does not follow symbolic links out of the root", () => {
    const outside = tempDir({ "x.md": node("fuera") });
    const root = tempDir({ "knowledge.schema.yaml": "type_tags: []\nrelation_types: []\n" });
    symlinkSync(outside, join(root, "enlace"));
    const folder = new FloFolder(root);
    folder.load();
    expect([...folder.link().entities.keys()]).toEqual([]);
  });

  it("reloads from scratch", () => {
    const folder = loaded();
    rmSync(join(folder.root, "kb"), { recursive: true });
    folder.load();
    expect([...folder.link().entities.keys()]).toEqual(["api"]);
  });

  it("does not throw when a file cannot be read (E/S entre lstat y read)", () => {
    const folder = loaded();
    const path = join(folder.root, "kb/secreto.md");
    writeFileSync(path, node("secreto"));
    chmodSync(path, 0o000);
    try {
      expect(() => folder.load()).not.toThrow();
      const ids = [...folder.link().entities.keys()];
      // Corriendo como root, 0o000 no bloquea la lectura: no se afirma la
      // ausencia de "secreto", solo que cargar no revienta y el resto sigue.
      expect(ids).toContain("api");
      expect(ids).toContain("a");
    } finally {
      chmodSync(path, 0o644);
    }
  });

  it("skips an unreadable directory instead of throwing, keeping the rest", () => {
    const root = tempDir(FILES);
    const hidden = join(root, "privado");
    mkdirSync(hidden);
    writeFileSync(join(hidden, "p.md"), node("p"));
    chmodSync(hidden, 0o000);
    try {
      const folder = new FloFolder(root);
      expect(() => folder.load()).not.toThrow();
      // Como root, 0o000 no bloquea: no se afirma la ausencia de "p".
      expect([...folder.link().entities.keys()]).toEqual(expect.arrayContaining(["api", "a", "b", "c"]));
    } finally {
      chmodSync(hidden, 0o755);
    }
  });
});

describe("FloFolder toUri", () => {
  it("normalizes paths inside the root to POSIX uris", () => {
    const folder = loaded();
    expect(folder.toUri("kb/a.md")).toBe("kb/a.md");
    expect(folder.toUri("./kb/../kb/a.md")).toBe("kb/a.md");
    expect(folder.toUri(join(folder.root, "kb", "a.md"))).toBe("kb/a.md");
    expect(folder.toUri("..nota.md")).toBe("..nota.md");
  });

  it("rejects paths outside the root and the root itself", () => {
    const folder = loaded();
    expect(folder.toUri("../fuera.md")).toBeNull();
    expect(folder.toUri("kb/../../fuera.md")).toBeNull();
    expect(folder.toUri("/etc/passwd")).toBeNull();
    expect(folder.toUri("")).toBeNull();
    expect(folder.toUri(".")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @flo/mcp test`
Expected: FAIL — `Failed to resolve import "./folder.js"`.

- [ ] **Step 4: Write minimal implementation**

`packages/mcp/src/folder.ts`:

```ts
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
        if (entry.isDirectory() && !IGNORED.has(entry.name)) visit(path);
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
    if (!isDocumentUri(uri) || isIgnored(uri)) return;
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @flo/mcp test && pnpm --filter @flo/mcp typecheck`
Expected: PASS (9 tests), typecheck sin errores.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp pnpm-lock.yaml
git commit -m "feat(mcp): paquete @flo/mcp y carga de carpeta

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `write` — guarda de ruta, validación y escritura atómica

**Files:**
- Modify: `packages/mcp/src/folder.ts`
- Test: `packages/mcp/src/folder.test.ts`

**Interfaces:**
- Consumes: `FloFolder` de la task 1 (`sources`, `workspace`, `linked`, `link()`, `toUri()`, `uriOf()`, `isIgnored`).
- Produces:
  - `type UriDiagnostic = Diagnostic & { uri: string }`
  - `type WriteResult = { ok: true; uri: string } | { ok: false; error: string; diagnostics: UriDiagnostic[] }`
  - `FloFolder.canonicalUri(path: string): string | null` (la usa también `check` en la task 4)
  - `FloFolder.write(path: string, content: string): WriteResult`

Semántica (decisión #34): guarda léxica (`toUri`) → canonización en
disco: el ancestro existente más cercano del archivo (él incluido) se
resuelve con `realpathSync.native` y tiene que quedar dentro de la raíz;
así `KB/a.md` en un FS insensible a mayúsculas es el mismo documento que
`kb/a.md` y un enlace simbólico hacia afuera se rechaza → extensión y
carpetas ignoradas sobre el uri canónico → workspace de prueba (todas las
fuentes actuales + el archivo nuevo) → rechazo si el archivo escrito no es
documento, si tiene errores, o si otro archivo tiene un error que antes no
tenía (multiconjunto por código, rango y mensaje) → escritura en un
temporal del mismo directorio y `rename` → el estado se actualiza en el
acto. Un fallo de E/S devuelve solo el código de error, sin rutas del
equipo.

- [ ] **Step 1: Write the failing tests**

En `packages/mcp/src/folder.test.ts`, ampliar el import de `node:fs` con
`existsSync`, `readFileSync` y `readdirSync`; agregar después de
`loaded()` la detección del FS:

```ts
/** Detectado una sola vez: los tests de mayúsculas solo tienen sentido en un FS case-insensitive (macOS/Windows). */
const CASE_INSENSITIVE_FS = ((): boolean => {
  const dir = mkdtempSync(join(tmpdir(), "flo-mcp-case-"));
  writeFileSync(join(dir, "case.txt"), "");
  const insensitive = existsSync(join(dir, "CASE.txt"));
  rmSync(dir, { recursive: true, force: true });
  return insensitive;
})();
```

y al final del archivo:

```ts
describe("FloFolder write", () => {
  it("writes a valid new .md atomically, creating folders, and links it at once", () => {
    const folder = loaded();
    const content = node("n", ["relations:", "  - target: ../a.md", "    type: affects"]);
    expect(folder.write("kb/nuevo/n.md", content)).toEqual({ ok: true, uri: "kb/nuevo/n.md" });
    expect(readFileSync(join(folder.root, "kb/nuevo/n.md"), "utf8")).toBe(content);
    expect(readdirSync(join(folder.root, "kb/nuevo"))).toEqual(["n.md"]);
    expect(folder.link().entities.has("n")).toBe(true);
  });

  it("writes a valid .flo, and overwrites an existing file", () => {
    const folder = loaded();
    expect(folder.write("flujos/f.flo", 'use "../catalogo.flo"\nflow f {\n  api -> api\n}\n')).toMatchObject({ ok: true });
    expect(folder.write("kb/a.md", node("a", ["type_tags: [decision]"]))).toMatchObject({ ok: true });
    expect(folder.link().xref.relationsFrom("a")).toEqual([]);
  });

  it("is not blocked by errors other files already had", () => {
    const folder = loaded();
    expect(folder.diagnostics()).toHaveProperty("roto.flo");
    expect(folder.write("kb/d.md", node("d"))).toMatchObject({ ok: true });
  });

  it("rejects a file with errors and leaves the disk untouched", () => {
    const folder = loaded();
    const result = folder.write("kb/m.md", node("m").replace("long_term", "forever"));
    expect(result).toMatchObject({ ok: false, diagnostics: [expect.objectContaining({ uri: "kb/m.md", code: "E064" })] });
    expect(existsSync(join(folder.root, "kb/m.md"))).toBe(false);
    expect(folder.link().entities.has("m")).toBe(false);
  });

  it("rejects an edit that breaks another file", () => {
    const folder = loaded();
    const before = readFileSync(join(folder.root, "kb/a.md"), "utf8");
    const result = folder.write("kb/a.md", node("z"));
    expect(result).toMatchObject({ ok: false, diagnostics: [expect.objectContaining({ uri: "kb/c.md", code: "E035" })] });
    expect(readFileSync(join(folder.root, "kb/a.md"), "utf8")).toBe(before);
  });

  it.runIf(CASE_INSENSITIVE_FS)(
    "rejects a case-variant path exactly like the lowercase one, canonized to the on-disk case",
    () => {
      const folder = loaded();
      const before = readFileSync(join(folder.root, "kb/a.md"), "utf8");
      const result = folder.write("KB/a.md", node("z"));
      expect(result).toMatchObject({ ok: false, diagnostics: [expect.objectContaining({ uri: "kb/c.md", code: "E035" })] });
      expect(readFileSync(join(folder.root, "kb/a.md"), "utf8")).toBe(before);
    },
  );

  it.runIf(CASE_INSENSITIVE_FS)("writes through a case-variant directory using the on-disk case", () => {
    const folder = loaded();
    expect(folder.write("KB/d.md", node("d"))).toMatchObject({ ok: true, uri: "kb/d.md" });
    expect(folder.link().entities.get("d")?.uri).toBe("kb/d.md");
  });

  it("rejects a .md without frontmatter", () => {
    const folder = loaded();
    expect(folder.write("kb/nota.md", "# Hola\n")).toMatchObject({ ok: false, error: expect.stringMatching(/no es un documento/) });
    expect(existsSync(join(folder.root, "kb/nota.md"))).toBe(false);
  });

  it("rejects paths outside the root, other extensions and ignored folders", () => {
    const folder = loaded();
    const rejected = (path: string, pattern: RegExp): void =>
      expect(folder.write(path, node("q"))).toEqual({ ok: false, error: expect.stringMatching(pattern), diagnostics: [] });
    rejected("../fuera.md", /sale de la carpeta raíz/);
    rejected(join(tmpdir(), "fuera.md"), /sale de la carpeta raíz/);
    rejected("kb/x.txt", /solo se escriben archivos \.md o \.flo/);
    rejected("knowledge.schema.yaml", /solo se escriben archivos \.md o \.flo/);
    rejected("node_modules/q.md", /carpeta ignorada/);
    expect(existsSync(join(folder.root, "node_modules/q.md"))).toBe(false);
  });

  it("rejects a path that leaves the root through a symbolic link", () => {
    const outside = tempDir({});
    const folder = loaded();
    symlinkSync(outside, join(folder.root, "enlace"));
    expect(folder.write("enlace/sub/q.md", node("q"))).toMatchObject({ ok: false, error: expect.stringMatching(/enlace simbólico/) });
    expect(readdirSync(outside)).toEqual([]);
  });

  it("reports an I/O failure instead of throwing", () => {
    const folder = loaded();
    // kb/a.md es un archivo: no puede ser directorio de otro.
    expect(folder.write("kb/a.md/q.md", node("q"))).toMatchObject({ ok: false, error: expect.stringMatching(/no se pudo escribir/) });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/mcp test`
Expected: FAIL — `folder.write is not a function`.

- [ ] **Step 3: Implement**

En `packages/mcp/src/folder.ts`, ampliar los imports:

```ts
import { randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
```

Agregar los tipos y helpers (a nivel de módulo, antes de la clase):

```ts
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
```

Agregar a la clase `FloFolder`, después de `toUri`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/mcp test && pnpm --filter @flo/mcp typecheck`
Expected: PASS (20 tests; los 2 de mayúsculas se saltan en un FS
sensible a mayúsculas).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/folder.ts packages/mcp/src/folder.test.ts
git commit -m "feat(mcp): write_node valida en un workspace de prueba y escribe atómico

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `watch` — el disco manda

**Files:**
- Modify: `packages/mcp/src/folder.ts`
- Test: `packages/mcp/src/folder.test.ts`

**Interfaces:**
- Consumes: `FloFolder` de las tasks 1–2 (`load`, `walk`, `refresh`, `uriOf`, `sources`).
- Produces: `FloFolder.watch(): { close(): void }`.

Semántica (decisiones #33 y #36): un `fs.watch` **no recursivo por
directorio** (los que da `walk()`), resincronizado en cada `load()`; el
recursivo de Node en Linux vigila cada archivo por inodo y deja de ver un
archivo tras reemplazarlo con `rename`. Un evento sobre un documento
(`.flo`, `.md`, el esquema en la raíz) relee ese archivo; sobre un
directorio que existe, o sobre una ruta que es prefijo de un documento
cargado (una carpeta borrada o movida), cierra los watchers de ese
subárbol (una carpeta borrada y recreada deja muerto el viejo) y relee la
carpeta entera; un evento sin nombre también relee; el resto (temporales
`.tmp` de `write`, `.txt`, carpetas ignoradas) se ignora. Toda excepción
dentro del callback se registra con `console.error`: nunca tumba el
servidor. Un error de un watcher lo cierra.

- [ ] **Step 1: Write the failing tests**

Agregar `vi` al import de `vitest` y `renameSync` al de `node:fs`, y al
final de `packages/mcp/src/folder.test.ts`:

```ts
describe("FloFolder watch", () => {
  const watchers: { close(): void }[] = [];
  afterEach(() => {
    for (const watcher of watchers.splice(0)) watcher.close();
  });

  /** fs.watch no avisa cuándo está listo: lo escrito enseguida puede perderse mientras arranca. */
  const settle = (): Promise<void> => new Promise((done) => setTimeout(done, 200));

  async function watched(): Promise<FloFolder> {
    const folder = loaded();
    watchers.push(folder.watch());
    await settle();
    return folder;
  }

  const ids = (folder: FloFolder): string[] => [...folder.link().entities.keys()];
  const eventually = (check: () => void) => vi.waitFor(check, { timeout: 5000, interval: 50 });
  const TIMEOUT = 15000;

  it("picks up a file written on disk", async () => {
    const folder = await watched();
    writeFileSync(join(folder.root, "kb/w.md"), node("w"));
    await eventually(() => expect(ids(folder)).toContain("w"));
  }, TIMEOUT);

  it("picks up an edit and a deletion", async () => {
    const folder = await watched();
    writeFileSync(join(folder.root, "kb/b.md"), node("b2"));
    await eventually(() => expect(ids(folder)).toContain("b2"));
    rmSync(join(folder.root, "kb/b.md"));
    await eventually(() => expect(ids(folder)).not.toContain("b2"));
  }, TIMEOUT);

  it("still sees edits to a file after it was replaced atomically", async () => {
    const folder = await watched();
    expect(folder.write("kb/a.md", node("a").replace("Nodo a", "Otro título"))).toMatchObject({ ok: true });
    await settle();
    writeFileSync(join(folder.root, "kb/a.md"), node("a3"));
    await eventually(() => expect(ids(folder)).toContain("a3"));
  }, TIMEOUT);

  it("reloads when a folder is removed or moved in", async () => {
    const folder = await watched();
    rmSync(join(folder.root, "kb"), { recursive: true });
    await eventually(() => expect(ids(folder)).toEqual(["api"]));
    const outside = tempDir({ "y.md": node("y") });
    renameSync(outside, join(folder.root, "nuevo"));
    await eventually(() => expect(ids(folder)).toContain("y"));
  }, TIMEOUT);

  it("watches a folder created after watch() started", async () => {
    const folder = await watched();
    renameSync(tempDir({ "y.md": node("y") }), join(folder.root, "nuevo"));
    await eventually(() => expect(ids(folder)).toContain("y"));
    await settle();
    writeFileSync(join(folder.root, "nuevo/y2.md"), node("y2"));
    await eventually(() => expect(ids(folder)).toContain("y2"));
  }, TIMEOUT);

  it("sees a folder deleted and recreated at the same path", async () => {
    const folder = await watched();
    rmSync(join(folder.root, "kb"), { recursive: true });
    mkdirSync(join(folder.root, "kb"));
    await eventually(() => expect(ids(folder)).toEqual(["api"]));
    await settle();
    writeFileSync(join(folder.root, "kb/w.md"), node("w"));
    await eventually(() => expect(ids(folder)).toContain("w"));
  }, TIMEOUT);

  it("ignores ignored folders", async () => {
    const folder = await watched();
    writeFileSync(join(folder.root, "node_modules/pkg/z.md"), node("z"));
    writeFileSync(join(folder.root, "kb/w.md"), node("w"));
    await eventually(() => expect(ids(folder)).toContain("w"));
    expect(ids(folder)).not.toContain("z");
  }, TIMEOUT);

  it("stops following changes after close()", async () => {
    const folder = loaded();
    const watcher = folder.watch();
    await settle();
    watcher.close();
    writeFileSync(join(folder.root, "kb/w.md"), node("w"));
    await settle();
    expect(ids(folder)).not.toContain("w");
  }, TIMEOUT);
});
```

(`fs.watch` no avisa cuándo está listo: los tests esperan 200 ms tras
`watch()` y tras un reemplazo atómico, y el timeout por test (15 s) queda
por encima del de `vi.waitFor` (5 s) para que el fallo diga qué no llegó.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/mcp test`
Expected: FAIL — `folder.watch is not a function`.

- [ ] **Step 3: Implement**

En `packages/mcp/src/folder.ts`, el import de `node:fs` queda:

```ts
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
```

Agregar el campo a la clase, después de `linked`:

```ts
  /** Un `fs.watch` no recursivo por directorio mientras se observa (decisión #36); null si no. */
  private watchers: Map<string, FSWatcher> | null = null;
```

En `load()`, después de `this.linked = null;`, resincronizar:

```ts
    this.syncWatchers(dirs);
```

y agregar a la clase:

```ts
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
      if (isIgnored(uri)) return;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/mcp test && pnpm --filter @flo/mcp typecheck`
Expected: PASS (28 tests). Correr la suite 5 veces seguidas
(`for i in 1 2 3 4 5; do pnpm --filter @flo/mcp test || break; done`):
los tests del watcher no deben ser intermitentes. Si uno lo es, investigar
la causa (evento perdido, orden) antes de subir timeouts.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/folder.ts packages/mcp/src/folder.test.ts
git commit -m "feat(mcp): un watcher por directorio relee lo que cambia en disco

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Herramientas MCP, binario `flo-mcp` y README

**Files:**
- Create: `packages/mcp/src/tools.ts`, `packages/mcp/src/main.ts`
- Test: `packages/mcp/src/tools.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `FloFolder` (`link()`, `diagnostics(uri?)`, `canonicalUri(path)`, `write(path, content): WriteResult`, `watch()`, `load()`); de `@flo/core`: `query(link, opts): QueryResult`, `tagCatalog(link): TagCatalog`, tipo `Where`; `link.xref.relationsFrom(id): Relation[]`, `link.xref.relationsTo(id): { from, relation }[]`.
- Produces: `createServer(folder: FloFolder): McpServer`; binario `flo-mcp <carpeta>`.

Salidas (decisión #35): cada herramienta devuelve un único contenido
`text` con `JSON.stringify(valor, null, 2)`; los fallos llevan
`isError: true` y un JSON con `error` (y `diagnostics` en `write_node`).
Los errores de validación de entrada los produce el SDK (texto
`MCP error -32602: Input validation error: ...`, `isError: true`).
`check` con ruta canoniza mayúsculas igual que `write_node`.

- [ ] **Step 1: Write the failing test**

`packages/mcp/src/tools.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FloFolder } from "./folder.js";
import { createServer } from "./tools.js";

const node = (id: string, extra: string[] = []): string =>
  ["---", `id: ${id}`, `title: Nodo ${id}`, "memory_type: long_term", ...extra, "---", "Cuerpo.", ""].join("\n");

const FILES: Record<string, string> = {
  "knowledge.schema.yaml": "type_tags: [decision]\nrelation_types: [affects]\n",
  "catalogo.flo": "entity api\n",
  "kb/a.md": node("a", ["type_tags: [decision]", 'use: ["../catalogo.flo"]', "relations:", "  - target: api", "    type: affects"]),
  "kb/c.md": node("c", ['use: ["./a.md"]', "relations:", "  - target: a", "    type: affects"]),
};

/** Los tests de mayúsculas solo tienen sentido en un FS case-insensitive (macOS/Windows). */
const CASE_INSENSITIVE_FS = ((): boolean => {
  const dir = mkdtempSync(join(tmpdir(), "flo-mcp-case-"));
  writeFileSync(join(dir, "case.txt"), "");
  const insensitive = existsSync(join(dir, "CASE.txt"));
  rmSync(dir, { recursive: true, force: true });
  return insensitive;
})();

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const undo of cleanup.splice(0)) undo();
});

async function connect(): Promise<{ folder: FloFolder; client: Client; call: (name: string, args?: Record<string, unknown>) => Promise<{ isError: boolean; value: any }> }> {
  const root = mkdtempSync(join(tmpdir(), "flo-mcp-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const folder = new FloFolder(root);
  folder.load();
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await createServer(folder).connect(serverSide);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientSide);
  cleanup.push(() => void client.close());
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = text;
    }
    return { isError: result.isError === true, value };
  };
  return { folder, client, call };
}

describe("flo-mcp tools", () => {
  it("lists the five tools", async () => {
    const { client } = await connect();
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(["query", "get_node", "list_tags", "check", "write_node"]);
  });

  it("query runs the core query", async () => {
    const { call } = await connect();
    const { isError, value } = await call("query", { where: { typeTag: "decision" }, depth: 1 });
    expect(isError).toBe(false);
    expect(value.nodes.map((n: { id: string }) => n.id)).toEqual(["a", "api", "c"]);
    expect(value.edges).toEqual([
      { from: "a", to: "api", type: "affects" },
      { from: "c", to: "a", type: "affects" },
    ]);
  });

  it("query rejects malformed options before reaching the core", async () => {
    const { call } = await connect();
    for (const args of [
      { where: { type_tag: "decision" } },
      { where: {} },
      { where: { and: { text: "x" } } },
      { where: { text: 3 } },
      { depth: -1 },
      { depth: 1.5 },
      { project: "todo" },
      { from: "a" },
      { bogus: 1 },
    ]) {
      const { isError, value } = await call("query", args);
      expect(isError, JSON.stringify(args)).toBe(true);
      expect(value).toMatch(/Input validation error/);
    }
  });

  it("get_node returns the node with its outgoing and incoming relations", async () => {
    const { call } = await connect();
    const a = await call("get_node", { id: "a", project: "full" });
    expect(a.value.node).toMatchObject({ id: "a", distance: 0, body: "Cuerpo.\n" });
    expect(a.value.outgoing).toEqual([{ type: "affects", target: "api", resolved: { kind: "entity", id: "api" } }]);
    expect(a.value.incoming).toEqual([{ from: "c", type: "affects", target: "a" }]);
    const missing = await call("get_node", { id: "nada" });
    expect(missing).toEqual({ isError: true, value: { error: "no existe la entidad 'nada'" } });
  });

  it("list_tags returns the tag catalog", async () => {
    const { call } = await connect();
    expect((await call("list_tags")).value).toEqual({ typeTags: ["decision"], contextTags: [], customTags: {} });
  });

  it("check returns the workspace or one file's diagnostics", async () => {
    const { call } = await connect();
    expect(await call("check")).toEqual({ isError: false, value: {} });
    expect(await call("check", { path: "kb/a.md" })).toEqual({ isError: false, value: { "kb/a.md": [] } });
    expect(await call("check", { path: "../fuera.md" })).toEqual({ isError: true, value: { error: "'../fuera.md' no es un documento del workspace" } });
  });

  it.runIf(CASE_INSENSITIVE_FS)("check canonizes a case-variant path like write_node", async () => {
    const { call } = await connect();
    expect(await call("check", { path: "KB/a.md" })).toEqual({ isError: false, value: { "kb/a.md": [] } });
  });

  it("write_node rejects invalid content and path escapes, and writes valid content", async () => {
    const { call } = await connect();
    const invalid = await call("write_node", { path: "kb/m.md", content: node("m").replace("long_term", "forever") });
    expect(invalid.isError).toBe(true);
    expect(invalid.value.diagnostics).toEqual([expect.objectContaining({ uri: "kb/m.md", code: "E064" })]);
    const outside = await call("write_node", { path: "../m.md", content: node("m") });
    expect(outside).toMatchObject({ isError: true, value: { ok: false, error: expect.stringMatching(/sale de la carpeta raíz/) } });
    expect(await call("write_node", { path: "kb/m.md", content: node("m") })).toEqual({ isError: false, value: { ok: true, uri: "kb/m.md" } });
    expect((await call("query", { from: ["m"] })).value.nodes).toHaveLength(1);
  });

  it("a change on disk shows up in the next query", async () => {
    const { folder, call } = await connect();
    const watcher = folder.watch();
    cleanup.push(() => watcher.close());
    // fs.watch no avisa cuándo está listo: lo escrito enseguida puede perderse mientras arranca.
    await new Promise((done) => setTimeout(done, 200));
    writeFileSync(join(folder.root, "kb/w.md"), node("w", ["type_tags: [decision]"]));
    await vi.waitFor(
      async () => expect((await call("query", { where: { typeTag: "decision" } })).value.nodes.map((n: { id: string }) => n.id)).toEqual(["a", "w"]),
      { timeout: 5000, interval: 50 }
    );
  }, 15000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @flo/mcp test`
Expected: FAIL — `Failed to resolve import "./tools.js"`.

- [ ] **Step 3: Implement `tools.ts`**

`packages/mcp/src/tools.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query, tagCatalog, type Where } from "@flo/core";
import type { FloFolder } from "./folder.js";

const memory = z.enum(["working", "short_term", "long_term"]);
const projection = z.enum(["meta", "full", "full+diagrams"]);

/**
 * `Where` del core validado estricto (pendiente de K2): una clave
 * desconocida o un tipo incorrecto se rechaza antes de llegar a `query`,
 * que confía en sus tipos.
 */
const where: z.ZodType<Where> = z.lazy(() =>
  z.union([
    z.strictObject({ and: z.array(where) }),
    z.strictObject({ or: z.array(where) }),
    z.strictObject({ not: where }),
    z.strictObject({ memory }),
    z.strictObject({ typeTag: z.string() }),
    z.strictObject({ contextTag: z.string() }),
    z.strictObject({ custom: z.string(), equals: z.union([z.string(), z.number(), z.boolean()]).optional() }),
    z.strictObject({ text: z.string() }),
  ])
);

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const failure = (value: unknown) => ({ ...json(value), isError: true });

/** Las cinco herramientas del spec de conocimiento §6 sobre una carpeta (decisión #35). */
export function createServer(folder: FloFolder): McpServer {
  const server = new McpServer({ name: "flo-mcp", version: "0.1.0" });

  server.registerTool(
    "query",
    {
      description:
        "Consulta el grafo de conocimiento. `where` filtra las semillas (and/or/not, memory, typeTag, contextTag, custom, text); `from` limita las semillas a esos ids; `depth` expande por relaciones y flujos; `project` elige meta, full (con body) o full+diagrams.",
      inputSchema: z.strictObject({
        where: where.optional(),
        from: z.array(z.string()).optional(),
        depth: z.number().int().min(0).optional(),
        project: projection.optional(),
      }),
    },
    async (opts) => json(query(folder.link(), opts))
  );

  server.registerTool(
    "get_node",
    {
      description: "Una entidad por id, con sus relaciones salientes y entrantes.",
      inputSchema: z.strictObject({ id: z.string(), project: projection.optional() }),
    },
    async ({ id, project }) => {
      const link = folder.link();
      const [node] = query(link, { from: [id], project }).nodes;
      if (!node) return failure({ error: `no existe la entidad '${id}'` });
      return json({
        node,
        outgoing: link.xref.relationsFrom(id).map(({ type, target, resolved }) => ({ type, target, resolved })),
        incoming: link.xref.relationsTo(id).map(({ from, relation }) => ({ from, type: relation.type, target: relation.target })),
      });
    }
  );

  server.registerTool(
    "list_tags",
    { description: "El vocabulario en uso: type_tags, context_tags y los valores de cada custom_tag." },
    async () => json(tagCatalog(folder.link()))
  );

  server.registerTool(
    "check",
    {
      description: "Diagnósticos del workspace (solo los archivos que tienen alguno), o de un archivo si se da `path`.",
      inputSchema: z.strictObject({ path: z.string().optional() }),
    },
    async ({ path }) => {
      if (path === undefined) return json(folder.diagnostics());
      const uri = folder.canonicalUri(path);
      const found = uri === null ? null : folder.diagnostics(uri);
      return found ? json(found) : failure({ error: `'${path}' no es un documento del workspace` });
    }
  );

  server.registerTool(
    "write_node",
    {
      description:
        "Crea o reemplaza un archivo .md o .flo (ruta relativa a la carpeta raíz). Solo escribe si el archivo no tiene errores y no aparecen errores nuevos en otros archivos; si no, devuelve los diagnósticos.",
      inputSchema: z.strictObject({ path: z.string(), content: z.string() }),
    },
    async ({ path, content }) => {
      const result = folder.write(path, content);
      return result.ok ? json(result) : failure(result);
    }
  );

  return server;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/mcp test && pnpm --filter @flo/mcp typecheck`
Expected: PASS (37 tests).

- [ ] **Step 5: Implement `main.ts` and smoke-test the binary**

`packages/mcp/src/main.ts`:

```ts
#!/usr/bin/env node
import { statSync } from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FloFolder } from "./folder.js";
import { createServer } from "./tools.js";

// stdout es el protocolo MCP: los avisos van a stderr.
const [root] = process.argv.slice(2);
if (!root || !statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
  console.error("uso: flo-mcp <carpeta>");
  process.exit(1);
}
const folder = new FloFolder(root);
folder.load();
folder.watch();
await createServer(folder).connect(new StdioServerTransport());
// El watcher mantiene vivo el proceso: sin esto, el servidor sobrevive al
// cliente que cerró stdin.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
```

Run: `pnpm --filter @flo/mcp build && node packages/mcp/dist/main.js; echo "exit $?"`
Expected: `uso: flo-mcp <carpeta>` y `exit 1`.

Run: `mkdir -p <tmp>/vacia && node packages/mcp/dist/main.js <tmp>/vacia < /dev/null; echo "exit $?"`
Expected: termina enseguida con `exit 0` (el servidor sale al cerrarse stdin).

Smoke por stdio (desde `packages/mcp`, para que resuelva el SDK), con una
carpeta temporal fuera del repo:

```bash
cd packages/mcp && mkdir -p <tmp>/flo-smoke && printf 'entity api\n' > <tmp>/flo-smoke/a.flo && node --input-type=module -e '
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const client = new Client({ name: "smoke", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/main.js", "<tmp>/flo-smoke"] }));
console.log((await client.callTool({ name: "query", arguments: {} })).content[0].text);
await client.close();
'; cd ../.. && rm -rf <tmp>/flo-smoke
```

Expected: un JSON con `"id": "api"` en `nodes`, y el proceso termina.

- [ ] **Step 6: README**

En `README.md`, en la sección `## Paquetes`, agregar después del último
paquete:

```markdown
- **`@flo/mcp`** (`packages/mcp`) — servidor MCP local (stdio) sobre una
  carpeta de documentos `.flo`, `.md` con frontmatter y
  `knowledge.schema.yaml`. Relee lo que cambia en disco.

  ```bash
  pnpm --filter @flo/mcp build
  node packages/mcp/dist/main.js <carpeta>
  ```

  Herramientas: `query`, `get_node`, `list_tags`, `check` y `write_node`
  (solo escribe `.md`/`.flo` dentro de la carpeta, y solo si el
  type-checker no encuentra errores nuevos).
```

- [ ] **Step 7: Full verification and commit**

Run: `pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: todo en verde; ningún `.snap` modificado (`git status` no
muestra `__snapshots__`).

```bash
git add packages/mcp/src/tools.ts packages/mcp/src/tools.test.ts packages/mcp/src/main.ts README.md
git commit -m "feat(mcp): herramientas query, get_node, list_tags, check y write_node

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
