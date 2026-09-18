# .flo — Persistencia y Exportación (Fase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar `@flo/web` con abrir/guardar de archivos `.flo` (File System
Access API + fallback de `<input type=file>`/descarga), autosave a
IndexedDB como red de seguridad, exportación a SVG/PNG, y un menú "Nuevo"
(flowchart/secuencia) — todo accesible desde una barra de herramientas en
el editor. Sin backend, sin cuentas, sin tipos de diagrama nuevos.

**Architecture:** Módulos nuevos en `@flo/web`, todos vanilla TS sin
dependencias de runtime nuevas: `storage.ts` (autosave a IndexedDB, API
nativa del navegador), `file-io.ts` (abrir/guardar con File System Access
API + fallback), `export.ts` (exportar SVG/PNG), `toolbar.ts` (la barra de
botones). `editor.ts` gana dos helpers (`getEditorSource`/
`setEditorSource`) y pasa el `source` actual a `onPreview`. `main.ts` los
conecta todos: carga el borrador autosaveado al iniciar, autosavea en cada
edición (mismo debounce que el preview), y cablea los botones de la
toolbar a `file-io.ts`/`export.ts`/`editor.ts`.

**Tech Stack:** TypeScript 5 (strict), APIs nativas del navegador (File
System Access API, IndexedDB, Canvas, Blob/URL.createObjectURL) — sin
librerías nuevas de runtime. `fake-indexeddb` como única dependencia
nueva, y solo de test (`devDependency`).

**Spec:** `docs/superpowers/specs/2026-09-17-flo-diagram-tool-design.md`
(§6 editor web — persistencia/exportación, §9 Fase 4)

## Global Constraints

- Cero dependencias de runtime nuevas en `@flo/web` (spec §6: "cero
  backend, cero cuentas"). La única dependencia nueva de esta ronda es
  `fake-indexeddb`, y es `devDependency` — no se embebe en el build.
- TypeScript (`node_modules/typescript` 5.6.x instalado en este repo) ya
  declara `FileSystemFileHandle`, `FileSystemHandle` y
  `FileSystemWritableFileStream` completos en `lib.dom.d.ts` (verificado
  antes de escribir este plan) — **no redeclarar esas interfaces**. Lo
  único que falta en `lib.dom.d.ts` es `Window.showOpenFilePicker` /
  `Window.showSaveFilePicker` y los tipos de opciones del picker
  (`FilePickerOptions`, `FilePickerAcceptType`); esos cuatro se agregan a
  mano en `packages/web/src/file-system-access.d.ts` (Task 2).
- jsdom (entorno de test, `environment: "jsdom"` en `vitest.config.ts`) no
  implementa `indexedDB`, `URL.createObjectURL`/`URL.revokeObjectURL` ni
  `HTMLCanvasElement.getContext`/`Image` — verificado corriendo jsdom real
  antes de escribir este plan:
  - `indexedDB` se resuelve importando `fake-indexeddb/auto` en el test
    (Task 1).
  - `URL.createObjectURL`/`URL.revokeObjectURL` se agregan como polyfill
    guardado en `test-setup.ts`, mismo patrón que el polyfill de `Range`
    ya existente ahí (Task 2).
  - El flujo de canvas (`exportPng`) queda sin test unitario — marcado
    `ponytail:`, verificado a mano en el navegador con
    `pnpm --filter @flo/web dev` (Task 3).
- Los imports relativos dentro de `packages/web/src/` siguen llevando
  sufijo `.js` explícito, igual que el código ya existente (convención del
  paquete, aunque `moduleResolution: "Bundler"` no lo exige).
- `@flo/core` no se toca en esta ronda — Fase 4 es enteramente `@flo/web`
  (spec §9 Fase 4).
- Sin tipos de diagrama nuevos, sin backend, sin cuentas, sin editor
  visual — fuera de alcance (spec §8).
- Commits pequeños, uno por task, mismo estilo del historial existente:
  `feat(web): ...` / `docs: ...`.

---

## Task 1: Autosave de borrador a IndexedDB

**Files:**
- Create: `packages/web/src/storage.ts`
- Test: `packages/web/src/storage.test.ts`
- Modify: `packages/web/package.json`

**Interfaces:**
- Consumes: nada nuevo (API nativa `indexedDB` del navegador).
- Produces: `DB_NAME` (constante), `saveDraft(source: string): Promise<void>`,
  `loadDraft(): Promise<string | null>` — consumidos por Task 6 (`main.ts`).

- [ ] **Step 1: Agregar `fake-indexeddb` como devDependency**

Editar `packages/web/package.json`, agregando a `devDependencies`:

```json
{
  "devDependencies": {
    "fake-indexeddb": "^6.2.5",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Instalar**

Run: `pnpm install`
Expected: termina sin error, `pnpm-lock.yaml` queda actualizado con
`fake-indexeddb`.

- [ ] **Step 3: Escribir los tests que fallan**

```typescript
// packages/web/src/storage.test.ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { saveDraft, loadDraft, DB_NAME } from "./storage.js";

async function resetDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

describe("draft autosave (IndexedDB)", () => {
  beforeEach(resetDb);

  it("returns null when nothing has been saved yet", async () => {
    expect(await loadDraft()).toBeNull();
  });

  it("round-trips a saved draft", async () => {
    await saveDraft("diagram flowchart\n\nstart[Inicio]\n");
    expect(await loadDraft()).toBe("diagram flowchart\n\nstart[Inicio]\n");
  });

  it("overwrites the previous draft on a second save", async () => {
    await saveDraft("diagram flowchart\n\na[A]\n");
    await saveDraft("diagram flowchart\n\nb[B]\n");
    expect(await loadDraft()).toBe("diagram flowchart\n\nb[B]\n");
  });
});
```

- [ ] **Step 4: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/web test`
Expected: FAIL — `./storage.js` no existe.

- [ ] **Step 5: Implementación**

```typescript
// packages/web/src/storage.ts
export const DB_NAME = "flo-editor";
const STORE_NAME = "drafts";
const DRAFT_KEY = "current";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraft(source: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(source, DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDraft(): Promise<string | null> {
  const db = await openDb();
  const result = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(DRAFT_KEY);
    request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}
```

- [ ] **Step 6: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/web test`
Expected: PASS (3 `it`)

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @flo/web typecheck`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add packages/web/package.json pnpm-lock.yaml packages/web/src/storage.ts packages/web/src/storage.test.ts
git commit -m "feat(web): autosave de borrador a IndexedDB"
```

## Task 2: Abrir/Guardar — File System Access API + fallback

**Files:**
- Create: `packages/web/src/file-system-access.d.ts`
- Create: `packages/web/src/file-io.ts`
- Test: `packages/web/src/file-io.test.ts`
- Modify: `packages/web/src/test-setup.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `hasFileSystemAccess(): boolean`, `OpenResult` (`{ source: string; handle: FileSystemFileHandle | null }`),
  `openFloFile(): Promise<OpenResult | null>`,
  `saveFloFile(source: string, handle: FileSystemFileHandle | null): Promise<FileSystemFileHandle | null>`,
  `downloadText(content: string, filename: string, mimeType: string): void`,
  `downloadBlob(blob: Blob, filename: string): void` — `downloadBlob` y
  `downloadText` consumidos también por Task 3 (`export.ts`);
  `openFloFile`/`saveFloFile`/`hasFileSystemAccess` consumidos por Task 6
  (`main.ts`).

- [ ] **Step 1: Ambient types del File System Access API**

`lib.dom.d.ts` (TypeScript 5.6, ya instalado) declara `FileSystemFileHandle`,
`FileSystemHandle` y `FileSystemWritableFileStream` completos — no hace
falta redeclararlos. Solo falta `Window.showOpenFilePicker`/
`showSaveFilePicker` y los tipos de opciones del picker:

```typescript
// packages/web/src/file-system-access.d.ts
export {};

declare global {
  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }

  interface FilePickerOptions {
    types?: FilePickerAcceptType[];
  }

  interface Window {
    showOpenFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle>;
  }
}
```

- [ ] **Step 2: Polyfill de `URL.createObjectURL`/`revokeObjectURL` en jsdom**

En `packages/web/src/test-setup.ts`, agregar al final (mismo patrón que el
guard de `Range` ya existente en el archivo):

```typescript
if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock";
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}
```

- [ ] **Step 3: Escribir los tests que fallan**

```typescript
// packages/web/src/file-io.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { hasFileSystemAccess, openFloFile, saveFloFile, downloadText } from "./file-io.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
});

describe("hasFileSystemAccess", () => {
  it("is false when the browser has no File System Access API", () => {
    expect(hasFileSystemAccess()).toBe(false);
  });

  it("is true when window.showOpenFilePicker exists", () => {
    window.showOpenFilePicker = vi.fn();
    expect(hasFileSystemAccess()).toBe(true);
  });
});

describe("openFloFile", () => {
  it("reads the picked file's content via the File System Access API", async () => {
    const file = new File(["diagram flowchart\n"], "diagrama.flo", { type: "text/plain" });
    const handle = { getFile: vi.fn().mockResolvedValue(file) } as unknown as FileSystemFileHandle;
    window.showOpenFilePicker = vi.fn().mockResolvedValue([handle]);

    const result = await openFloFile();

    expect(result).toEqual({ source: "diagram flowchart\n", handle });
  });

  it("falls back to an <input type=file> picker and reads its content", async () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(function (this: HTMLInputElement) {
        const file = new File(["diagram sequence\n"], "diagrama.flo", { type: "text/plain" });
        Object.defineProperty(this, "files", { value: [file], configurable: true });
        this.dispatchEvent(new Event("change"));
      });

    const result = await openFloFile();

    expect(result).toEqual({ source: "diagram sequence\n", handle: null });
    clickSpy.mockRestore();
  });
});

describe("saveFloFile", () => {
  it("writes through an existing handle without prompting again", async () => {
    window.showOpenFilePicker = vi.fn();
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
    const handle = { createWritable: vi.fn().mockResolvedValue(writable) } as unknown as FileSystemFileHandle;

    const result = await saveFloFile("diagram flowchart\n", handle);

    expect(writable.write).toHaveBeenCalledWith("diagram flowchart\n");
    expect(writable.close).toHaveBeenCalledTimes(1);
    expect(result).toBe(handle);
  });

  it("prompts for a new file when there is no handle yet", async () => {
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
    const handle = { createWritable: vi.fn().mockResolvedValue(writable) } as unknown as FileSystemFileHandle;
    window.showOpenFilePicker = vi.fn();
    window.showSaveFilePicker = vi.fn().mockResolvedValue(handle);

    const result = await saveFloFile("diagram sequence\n", null);

    expect(window.showSaveFilePicker).toHaveBeenCalledTimes(1);
    expect(result).toBe(handle);
  });

  it("downloads a .flo file when the browser has no File System Access API", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const result = await saveFloFile("diagram flowchart\n", null);

    expect(result).toBeNull();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

describe("downloadText", () => {
  it("triggers a download with the given filename and mime type", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");

    downloadText("hola", "a.flo", "text/plain");

    const blob = createUrlSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/plain");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/web test`
Expected: FAIL — `./file-io.js` no existe.

- [ ] **Step 5: Implementación**

```typescript
// packages/web/src/file-io.ts
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
```

- [ ] **Step 6: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/web test`
Expected: PASS (8 `it`)

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @flo/web typecheck`
Expected: sin errores — confirma que `file-system-access.d.ts` amplía
`Window` sin chocar con las interfaces `FileSystemFileHandle`/
`FileSystemWritableFileStream` ya provistas por `lib.dom.d.ts`.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/file-system-access.d.ts packages/web/src/file-io.ts packages/web/src/file-io.test.ts packages/web/src/test-setup.ts
git commit -m "feat(web): abrir/guardar .flo (File System Access API + fallback de descarga)"
```

## Task 3: Exportar a SVG y PNG

**Files:**
- Create: `packages/web/src/export.ts`
- Test: `packages/web/src/export.test.ts`

**Interfaces:**
- Consumes: `downloadBlob`, `downloadText` (`./file-io.js`, Task 2).
- Produces: `parseSvgSize(svg: string): { width: number; height: number }`,
  `svgDataUrl(svg: string): string`, `exportSvg(svg: string): void`,
  `exportPng(svg: string): Promise<void>` — consumidos por Task 6
  (`main.ts`).

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
// packages/web/src/export.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { parseSvgSize, svgDataUrl, exportSvg } from "./export.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseSvgSize", () => {
  it("reads width and height from the svg root element", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="272" height="340" viewBox="0 0 272 340"></svg>';
    expect(parseSvgSize(svg)).toEqual({ width: 272, height: 340 });
  });

  it("throws when the svg has no width/height attributes", () => {
    expect(() => parseSvgSize("<svg></svg>")).toThrow();
  });
});

describe("svgDataUrl", () => {
  it("encodes the svg as a base64 data URL", () => {
    expect(svgDataUrl("<svg>x</svg>")).toBe(`data:image/svg+xml;base64,${btoa("<svg>x</svg>")}`);
  });
});

describe("exportSvg", () => {
  it("downloads the svg as a diagrama.svg file", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");

    exportSvg("<svg>x</svg>");

    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    const blob = createUrlSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("image/svg+xml");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/web test`
Expected: FAIL — `./export.js` no existe.

- [ ] **Step 3: Implementación**

```typescript
// packages/web/src/export.ts
import { downloadBlob, downloadText } from "./file-io.js";

export function parseSvgSize(svg: string): { width: number; height: number } {
  const match = svg.match(/width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/);
  if (!match) {
    throw new Error("no se pudo leer el tamaño del SVG");
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function exportSvg(svg: string): void {
  downloadText(svg, "diagrama.svg", "image/svg+xml");
}

// ponytail: jsdom no implementa canvas (getContext/toBlob) ni la carga de
// Image vía data URL, así que este flujo no tiene test unitario — se
// verifica a mano en el navegador (pnpm --filter @flo/web dev, Task 6).
// Si hace falta cobertura automatizada, agregar Playwright (spec §7).
export function exportPng(svg: string): Promise<void> {
  const { width, height } = parseSvgSize(svg);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no se pudo crear el contexto 2d del canvas"));
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("no se pudo generar el PNG"));
          return;
        }
        downloadBlob(blob, "diagrama.png");
        resolve();
      }, "image/png");
    };
    image.onerror = () => reject(new Error("no se pudo cargar el SVG como imagen"));
    image.src = svgDataUrl(svg);
  });
}
```

- [ ] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/web test`
Expected: PASS (4 `it`)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/export.ts packages/web/src/export.test.ts
git commit -m "feat(web): exportar diagrama a SVG y PNG"
```

## Task 4: `editor.ts` — leer/reemplazar el documento, pasar `source` al preview

**Files:**
- Modify: `packages/web/src/editor.ts`
- Modify: `packages/web/src/editor.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `getEditorSource(view: EditorView): string`,
  `setEditorSource(view: EditorView, source: string): void`; cambia la
  firma de `onPreview` en `createEditor` a
  `(result: RenderResult, source: string) => void` — consumidos por Task 6
  (`main.ts`).

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `packages/web/src/editor.test.ts` (dentro del mismo
archivo, después del `describe("createEditor", ...)` existente — no borrar
nada de lo que ya hay):

```typescript
import { createEditor, getEditorSource, setEditorSource } from "./editor.js";

// ... (el describe("createEditor", ...) existente queda igual) ...

it("passes the current source alongside the render result", () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  const sources: string[] = [];
  const view = createEditor(container, "start[Inicio]\n", (_result, source) => {
    sources.push(source);
  });

  view.dispatch({ changes: { from: view.state.doc.length, insert: "check[Otro]\n" } });
  vi.advanceTimersByTime(200);

  expect(sources).toEqual(["start[Inicio]\n", "start[Inicio]\ncheck[Otro]\n"]);
  view.destroy();
  vi.useRealTimers();
});

describe("getEditorSource / setEditorSource", () => {
  it("reads and replaces the full document", () => {
    const container = document.createElement("div");
    const view = createEditor(container, "start[Inicio]\n", () => {});

    expect(getEditorSource(view)).toBe("start[Inicio]\n");

    setEditorSource(view, "diagram sequence\n");
    expect(getEditorSource(view)).toBe("diagram sequence\n");

    view.destroy();
  });
});
```

(El `import` de arriba reemplaza la línea `import { createEditor } from "./editor.js";`
ya existente al tope del archivo — agrega `getEditorSource, setEditorSource`
a la misma línea en vez de duplicar el import.)

- [ ] **Step 2: Correr los tests — deben fallar**

Run: `pnpm --filter @flo/web test`
Expected: FAIL — `getEditorSource`/`setEditorSource` no existen, y la
firma de `onPreview` (2 args) no rompe en runtime pero el test de
"passes the current source..." falla porque `source` llega `undefined`.

- [ ] **Step 3: Implementación**

En `packages/web/src/editor.ts`, cambiar la firma de `createEditor` y el
callback de `updateListener`, y agregar los dos helpers nuevos:

```typescript
// packages/web/src/editor.ts
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { linter, lintGutter } from "@codemirror/lint";
import { parse, render, type RenderResult } from "@flo/core";
import { floHighlightField } from "./flo-highlight-field.js";
import { toLintDiagnostics } from "./flo-lint.js";

const PREVIEW_DEBOUNCE_MS = 200;

export function createEditor(
  parent: HTMLElement,
  initialSource: string,
  onPreview: (result: RenderResult, source: string) => void
): EditorView {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const view = new EditorView({
    state: EditorState.create({
      doc: initialSource,
      extensions: [
        basicSetup,
        floHighlightField,
        lintGutter(),
        linter((v) => toLintDiagnostics(parse(v.state.doc.toString()).diagnostics, v.state.doc), {
          delay: PREVIEW_DEBOUNCE_MS,
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            const source = update.state.doc.toString();
            onPreview(render(source), source);
          }, PREVIEW_DEBOUNCE_MS);
        }),
      ],
    }),
    parent,
  });

  onPreview(render(initialSource), initialSource);

  return view;
}

export function getEditorSource(view: EditorView): string {
  return view.state.doc.toString();
}

export function setEditorSource(view: EditorView, source: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
}
```

- [ ] **Step 4: Correr los tests — deben pasar**

Run: `pnpm --filter @flo/web test`
Expected: PASS — todos los tests de `editor.test.ts` (los preexistentes
siguen en verde: reciben `source` como segundo argumento pero los
callbacks `(result) => {...}` ya escritos lo ignoran sin error).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/editor.ts packages/web/src/editor.test.ts
git commit -m "feat(web): getEditorSource/setEditorSource y source en onPreview"
```

## Task 5: Toolbar (Nuevo / Abrir / Guardar / Exportar)

**Files:**
- Create: `packages/web/src/toolbar.ts`
- Test: `packages/web/src/toolbar.test.ts`
- Modify: `packages/web/index.html`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `DiagramKind` (`"flowchart" | "sequence"`), `ToolbarActions`
  (`{ onNew(kind: DiagramKind): void; onOpen(): void; onSave(): void; onExportSvg(): void; onExportPng(): void }`),
  `createToolbar(container: HTMLElement, actions: ToolbarActions): void` —
  consumidos por Task 6 (`main.ts`). El `container` esperado es
  `document.querySelector("#toolbar")`, agregado a `index.html` en este
  mismo task.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// packages/web/src/toolbar.test.ts
import { describe, it, expect, vi } from "vitest";
import { createToolbar, type ToolbarActions } from "./toolbar.js";

function mockActions(): ToolbarActions {
  return {
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onExportSvg: vi.fn(),
    onExportPng: vi.fn(),
  };
}

describe("createToolbar", () => {
  it("wires each button to its action", () => {
    const container = document.createElement("div");
    const actions = mockActions();
    createToolbar(container, actions);

    container.querySelector<HTMLButtonElement>("#flo-new-flowchart")!.click();
    expect(actions.onNew).toHaveBeenCalledWith("flowchart");

    container.querySelector<HTMLButtonElement>("#flo-new-sequence")!.click();
    expect(actions.onNew).toHaveBeenCalledWith("sequence");

    container.querySelector<HTMLButtonElement>("#flo-open")!.click();
    expect(actions.onOpen).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-save")!.click();
    expect(actions.onSave).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-export-svg")!.click();
    expect(actions.onExportSvg).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>("#flo-export-png")!.click();
    expect(actions.onExportPng).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `pnpm --filter @flo/web test`
Expected: FAIL — `./toolbar.js` no existe.

- [ ] **Step 3: Implementación**

```typescript
// packages/web/src/toolbar.ts
export type DiagramKind = "flowchart" | "sequence";

export interface ToolbarActions {
  onNew(kind: DiagramKind): void;
  onOpen(): void;
  onSave(): void;
  onExportSvg(): void;
  onExportPng(): void;
}

export function createToolbar(container: HTMLElement, actions: ToolbarActions): void {
  container.innerHTML = `
    <button id="flo-new-flowchart" type="button">Nuevo flowchart</button>
    <button id="flo-new-sequence" type="button">Nueva secuencia</button>
    <button id="flo-open" type="button">Abrir</button>
    <button id="flo-save" type="button">Guardar</button>
    <button id="flo-export-svg" type="button">Exportar SVG</button>
    <button id="flo-export-png" type="button">Exportar PNG</button>
  `;

  function byId(id: string): HTMLElement {
    const element = container.querySelector<HTMLElement>(`#${id}`);
    if (!element) {
      throw new Error(`falta el botón #${id} en la toolbar`);
    }
    return element;
  }

  byId("flo-new-flowchart").addEventListener("click", () => actions.onNew("flowchart"));
  byId("flo-new-sequence").addEventListener("click", () => actions.onNew("sequence"));
  byId("flo-open").addEventListener("click", actions.onOpen);
  byId("flo-save").addEventListener("click", actions.onSave);
  byId("flo-export-svg").addEventListener("click", actions.onExportSvg);
  byId("flo-export-png").addEventListener("click", actions.onExportPng);
}
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `pnpm --filter @flo/web test`
Expected: PASS (1 `it`)

- [ ] **Step 5: Agregar el contenedor `#toolbar` y su estilo a `index.html`**

Reemplazar todo `packages/web/index.html` por:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>.flo editor</title>
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        font-family: system-ui, sans-serif;
      }
      body {
        display: flex;
        flex-direction: column;
      }
      #toolbar {
        display: flex;
        gap: 8px;
        padding: 8px 12px;
        border-bottom: 1px solid #d1d5db;
        flex: 0 0 auto;
      }
      #toolbar button {
        padding: 4px 10px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
        font-size: 13px;
      }
      #toolbar button:hover {
        background: #f3f4f6;
      }
      #app {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
      }
      #editor-pane,
      #preview-pane {
        flex: 1 1 50%;
        min-width: 0;
        overflow: auto;
      }
      #editor-pane {
        border-right: 1px solid #d1d5db;
      }
      #preview-pane {
        padding: 16px;
      }
      .cm-editor {
        height: 100%;
      }
      .flo-banner {
        background: #fef2f2;
        color: #991b1b;
        padding: 4px 8px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 13px;
      }
      .flo-empty {
        color: #6b7280;
      }
      .flo-tok-ident {
        color: #1d4ed8;
      }
      .flo-tok-text {
        color: #047857;
      }
      .flo-tok-arrow {
        color: #b91c1c;
        font-weight: bold;
      }
      .flo-tok-punct {
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <div id="toolbar"></div>
    <div id="app">
      <div id="editor-pane"></div>
      <div id="preview-pane"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/toolbar.ts packages/web/src/toolbar.test.ts packages/web/index.html
git commit -m "feat(web): toolbar (nuevo/abrir/guardar/exportar)"
```

## Task 6: Conectar todo en `main.ts` + verificación manual

**Files:**
- Modify: `packages/web/src/main.ts`

**Interfaces:**
- Consumes: `createEditor`, `getEditorSource`, `setEditorSource` (`./editor.js`,
  Task 4); `nextPreviewState`, `previewHtml`, `PreviewState` (`./preview.js`,
  ya existente); `createToolbar`, `type DiagramKind` (`./toolbar.js`, Task 5);
  `openFloFile`, `saveFloFile` (`./file-io.js`, Task 2); `exportSvg`,
  `exportPng` (`./export.js`, Task 3); `loadDraft`, `saveDraft`
  (`./storage.js`, Task 1).
- Produces: nada (punto de entrada de la app, sin exports).

- [ ] **Step 1: Reescribir `main.ts`**

```typescript
// packages/web/src/main.ts
import { createEditor, getEditorSource, setEditorSource } from "./editor.js";
import { nextPreviewState, previewHtml, type PreviewState } from "./preview.js";
import { createToolbar, type DiagramKind } from "./toolbar.js";
import { openFloFile, saveFloFile } from "./file-io.js";
import { exportSvg, exportPng } from "./export.js";
import { loadDraft, saveDraft } from "./storage.js";

const NEW_SOURCE: Record<DiagramKind, string> = {
  flowchart: ["diagram flowchart", "", ""].join("\n"),
  sequence: ["diagram sequence", "", ""].join("\n"),
};

async function main(): Promise<void> {
  const editorPane = document.querySelector<HTMLDivElement>("#editor-pane");
  const previewPane = document.querySelector<HTMLDivElement>("#preview-pane");
  const toolbarPane = document.querySelector<HTMLDivElement>("#toolbar");
  if (!editorPane || !previewPane || !toolbarPane) return;

  const draft = await loadDraft().catch(() => null);
  const initialSource = draft ?? NEW_SOURCE.flowchart;

  let previewState: PreviewState = { lastSvg: null };
  let fileHandle: FileSystemFileHandle | null = null;

  const view = createEditor(editorPane, initialSource, (result, source) => {
    previewState = nextPreviewState(previewState, result);
    previewPane.innerHTML = previewHtml(previewState, result);
    void saveDraft(source);
  });

  createToolbar(toolbarPane, {
    onNew(kind) {
      fileHandle = null;
      setEditorSource(view, NEW_SOURCE[kind]);
    },
    async onOpen() {
      const opened = await openFloFile();
      if (!opened) return;
      fileHandle = opened.handle;
      setEditorSource(view, opened.source);
    },
    async onSave() {
      fileHandle = await saveFloFile(getEditorSource(view), fileHandle);
    },
    onExportSvg() {
      if (previewState.lastSvg) exportSvg(previewState.lastSvg);
    },
    onExportPng() {
      if (previewState.lastSvg) void exportPng(previewState.lastSvg);
    },
  });
}

void main();
```

- [ ] **Step 2: Correr toda la suite del monorepo**

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: verde en `@flo/core` y `@flo/web`.

- [ ] **Step 3: Verificación manual en el navegador**

Run: `pnpm --filter @flo/web dev`

En el navegador (`http://localhost:5173` por defecto):
1. La toolbar aparece arriba del split-pane con los 6 botones.
2. "Nuevo flowchart" / "Nueva secuencia" reemplazan el contenido del
   editor por el header base correspondiente.
3. Escribir un diagrama, recargar la página → el borrador se restaura
   (autosave a IndexedDB funcionando).
4. "Guardar" sin File System Access API disponible (Firefox, o Chrome con
   el flag deshabilitado) descarga un `.flo`; en Chrome/Edge abre el
   selector nativo de guardado y escribe in-place en corridas
   siguientes de "Guardar" sin volver a preguntar.
5. "Abrir" carga un `.flo` existente y actualiza el editor + preview.
6. "Exportar SVG" descarga un `.svg` que abre correctamente en el
   navegador.
7. "Exportar PNG" descarga un `.png` con el diagrama renderizado
   (verifica visualmente que el tamaño coincide con el SVG).

Si algún paso falla, arreglar antes de continuar — no marcar el task como
completo sin esta verificación (spec §6: la persistencia es el
entregable central de esta fase).

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/main.ts
git commit -m "feat(web): conecta toolbar, autosave y apertura/guardado en main.ts"
```

## Task 7: Actualizar README (estado Fase 4 completa)

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nada.
- Produces: ninguna — solo documentación.

- [ ] **Step 1: Actualizar el estado**

En `README.md`, reemplazar el bloque de estado actual:

```markdown
> **Estado actual:** Fase 0 (monorepo + CI), Fase 1 (lenguaje: lexer,
> parser, AST, diagnostics), Fase 2 (layout con `dagre` + render a SVG) y
> Fase 3 (editor web: CodeMirror 6 + preview en vivo) completas para los
> tipos `flowchart` y `sequence`. Todavía no hay persistencia ni
> exportación — eso es la próxima fase (ver [Roadmap](#roadmap)).
```

por:

```markdown
> **Estado actual:** Fase 0 (monorepo + CI), Fase 1 (lenguaje: lexer,
> parser, AST, diagnostics), Fase 2 (layout con `dagre` + render a SVG),
> Fase 3 (editor web: CodeMirror 6 + preview en vivo) y Fase 4
> (persistencia: File System Access API + fallback de descarga, autosave
> a IndexedDB, exportación a SVG/PNG) completas para los tipos
> `flowchart` y `sequence`. Falta publicar `@flo/core` a npm y desplegar
> el editor — eso es la próxima fase (ver [Roadmap](#roadmap)).
```

Y en la sección `@flo/web`, reemplazar la última frase ("Sin persistencia
ni exportación todavía — eso es la Fase 4.") por:

```markdown
  Barra de herramientas con Nuevo (flowchart/secuencia), Abrir y Guardar
  (File System Access API en Chrome/Edge, con fallback de
  `<input type=file>` + descarga en otros navegadores), Exportar SVG y
  Exportar PNG. Autosave del borrador a IndexedDB en cada edición,
  independiente del archivo real en disco — se restaura al recargar la
  página.
```

Y en la sección `## Roadmap`, quitar la línea de la Fase 4 (ya cumplida)
dejando:

```markdown
## Roadmap

- **Fase 5** — publicación de `@flo/core` a npm, documentación de usuario final, deploy del editor.
```

- [ ] **Step 2: Verificar la suite completa una última vez**

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: verde — mismo resultado del Step 2 de Task 6, ahora con el
README actualizado en el mismo commit lógico de cierre de fase.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README refleja Fase 4 completa (persistencia y exportación)"
```

---

## Auto-revisión (self-review)

- **Cobertura del spec:** File System Access API + fallback (§6, §9 Fase
  4 — Task 2), autosave a IndexedDB (§6, §9 — Task 1), exportar SVG/PNG
  (§9 — Task 3), menú "Nuevo" con header base (§9 — Task 5/6) — todos
  cubiertos. Publicación a npm, deploy y documentación de usuario final
  (§9 Fase 5) quedan explícitamente fuera de esta ronda.
- **Placeholders:** ninguno — cada paso trae código completo. Los
  fragmentos de `file-io.ts`, `export.ts` y `storage.ts` se compilaron
  con `tsc --strict` contra la misma config de `lib`/`module` que usa
  `@flo/web` antes de escribir este plan, y `storage.ts` se corrió de
  verdad contra `fake-indexeddb` (no es código sin probar).
- **Consistencia de tipos:** `OpenResult` (Task 2) se usa idéntico en
  `main.ts` (Task 6); `ToolbarActions`/`DiagramKind` (Task 5) coinciden
  exactamente con el objeto pasado a `createToolbar` en Task 6;
  `downloadBlob`/`downloadText` (Task 2) se importan sin cambios de firma
  en Task 3; la nueva firma de `onPreview` con `source` (Task 4) es la
  que usa el callback de `main.ts` en Task 6.
- **Convención `.js` en imports:** todos los imports relativos nuevos
  llevan el sufijo `.js`, igual que el código ya existente en
  `packages/web/src/`.
- **Riesgo técnico principal (tipos del File System Access API + límites
  de jsdom):** verificado antes de escribir este plan — `tsc --noEmit`
  real contra `file-system-access.d.ts` + `file-io.ts` + `export.ts`
  (sin errores), y una prueba real de jsdom confirmando que
  `indexedDB`, `URL.createObjectURL`/`revokeObjectURL` y
  `HTMLCanvasElement.getContext` no están implementados ahí — de donde
  salen las decisiones de `fake-indexeddb`, el polyfill de `URL` en
  `test-setup.ts`, y dejar `exportPng` sin test unitario.
