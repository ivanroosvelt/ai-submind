# .flo — navegación en el editor (Fase F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-09-29 (`aa23b8c`..`b7ed239`, fixes de la revisión final `f094d80`..`89ef65f`). Las 12 tasks pasaron su revisión sin rondas de fixes. Revisión final: con una carpeta abierta, un archivo nuevo sin guardar se perdía sin confirmación al reemplazar el workspace (`hasUnsavedChanges` cuenta ahora los archivos nunca guardados de la carpeta, decisión #43); cambiar de documento perdía el historial de deshacer (`App` guarda un `EditorState` por uri y lo reusa si la fuente no cambió); `save()` fija el workspace antes de los `await`; `load()` limpia selección, resaltado, panel y mapa; Ctrl/Cmd+click solo con el botón principal. Verificado a mano en Safari (sin selector de carpetas). Suite: 235 core, 109 web, 37 mcp. Lo que quedó sin hacer está en §11, "Pendientes diferidos (Fase F)"; la task 13 (segunda vuelta) recoge de ahí lo que tiene arreglo en código. El código y los tests de este plan reflejan lo entregado (incluidos esos fixes).

**Goal:** El editor web pasa de un archivo suelto a un workspace de varios
documentos (abrir carpeta, guardar todo, borrador del workspace entero) y
suma la navegación del spec §8: explorador de catálogo y archivos con
filtros, panel de entidad con "aparece en N flujos" y salto al flujo con el
nodo resaltado, ir a definición (Ctrl/Cmd+click, F12), renombrar
cross-document (F2 o botón del panel) y la vista mapa agregada con click en
aristas.

**Architecture:** Tres piezas puras nuevas en `@flo/core`:
`entityAt`/`renameEntity` (`workspace/navigation.ts`) y `renderMap`
(`render/map.ts`); el editor solo las llama. En `@flo/web`,
`EditorWorkspace` (`workspace.ts`) envuelve un `Workspace` del core con el
mapa `uri → fuente`, lo guardado en disco y el documento activo, y enlaza
de forma perezosa (nadie guarda un `LinkResult` entre cambios). `App`
(`app.ts`) es el orquestador testeable que hoy es `main.ts`: toolbar,
editor (un `EditorState` por documento), preview del documento activo con
el catálogo alcanzable, explorador, panel y mapa; `main.ts` queda en
cargar el borrador y crear la `App`. El HTML del explorador y del panel
sale de funciones puras (`explorerHtml`, `entityPanelHtml`,
`edgePanelHtml`, `mapHtml`) y los clicks se resuelven por delegación con
atributos `data-flo-*`.

**Tech Stack:** TypeScript 5 (strict), CodeMirror 6, Vite, Vitest + jsdom +
fake-indexeddb, File System Access API (`showDirectoryPicker`) con fallback
`<input webkitdirectory>`.

**Spec:** `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
(§8 editor web, §10 Fase F). Decisiones vigentes en su §11: #1, #6, #11,
#21, #24, #25, #26, #27, #29, #30, #32, #33, y las nuevas **#37–#43** de
esta fase (#37–#42 escritas en §11 junto con este plan, #43 en la revisión
final). Pendientes de §11 que este
plan recoge (la tabla completa, con los descartados, está en §11 →
"Pendientes que resuelve la Fase F"):

| Pendiente | Dónde |
|---|---|
| C — bloque vacío con SVG de tamaño 0 | task 6 ("Bloque vacío") |
| C — borrador viejo: texto de estado vacío junto al banner | task 6 |
| C — resaltado de `STRING`, comas y `type:` | task 11 |
| C — `tags: x, y` da un `E042` confuso | task 3 |
| E — click en el header fijo de `sequence` | task 7 |
| E — `link()` reescribe `Ref.target` | task 4 (`EditorWorkspace.link()` perezoso; nadie guarda el resultado) |
| E — `E032` para una ruta que sale de la raíz | task 3 |
| E — `render(source)` sin uri en el editor | task 6 (`renderActive` usa la uri del documento) |
| K1 — renombrar un escalar YAML entre comillas | task 1 |
| K1 — `E032` para un `.md` sin frontmatter o el esquema | task 3 |

Orden de fases: D → E → K1 → K2 → K3 → **F** → K4.

## Global Constraints

- **Sin dependencias nuevas** en ningún paquete. `@codemirror/view` ya trae
  `keymap`, `runScopeHandlers` y `EditorView.domEventHandlers`.
- **`@flo/web` consume `@flo/core` por `dist/`**: cada task de core termina
  con `pnpm --filter @flo/core build`; antes de correr los tests de web,
  el `dist/` tiene que estar al día.
- **Imports relativos en `packages/core/src/` con sufijo `.js`**; en
  `packages/web/src/` también (así están hoy).
- **Snapshots de SVG**: ninguno cambia y no se regeneran (`vitest -u`
  prohibido). `renderMap` se testea por atributos, sin snapshot nuevo.
- **Sin códigos de diagnóstico nuevos**: la task 3 cambia mensajes de
  `E032` y `E042`, no códigos. Los errores de renombrar son mensajes
  (`{ error }`), no `Diagnostic`.
- **Textos de UI, mensajes y comentarios en español**; nombres de test en
  inglés.
- **Todo lo que viene del usuario y va a HTML pasa por `escapeXml`**
  (labels, ids, uris, títulos, tipos, tags), también en atributos.
- Un commit por task (`feat(core): ...`, `feat(web): ...`, `docs: ...`),
  con la línea final
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verificación final (desde la raíz): `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

## Review Focus

1. **Renombrar a un id que YAML leería como otro tipo** (`yes`, `null`,
   `true`) o desde un `id: "a"` entre comillas: el `.md` queda con un
   escalar válido que sigue siendo string (`id: "yes"`), y los `.flo` con
   el id sin comillas. Test en task 1.
2. **Renombrar con el archivo de la declaración cerrado y otros abiertos
   sin guardar**: todas las ediciones caen en su archivo, el activo por el
   editor (queda en su historial de deshacer) y los demás en el workspace,
   que los marca modificados. Tests en task 9.
3. **Abrir una carpeta real** (`node_modules`, `.git`, un
   `knowledge.schema.yaml` en una subcarpeta, imágenes, un `.md` sin
   frontmatter): solo entran `.flo`, `.md` y el esquema de la raíz, con
   uris POSIX relativas. Test en task 5.
4. **Guardar tras recargar la página** (el handle de carpeta viene del
   borrador y perdió el permiso): se pide permiso; si se niega, error
   visible y nada se marca guardado. Tests en tasks 5 y 6.
5. **Un borrador de antes de esta fase** (IndexedDB con un string): se
   abre como `diagrama.flo` en vez de perderse o romper la carga. Test en
   task 4.

---

## File Structure

`packages/core/src/`:
- Create `workspace/navigation.ts` — `entityAt`, `renameEntity`, `TextEdit`, `RenameResult`.
- Create `workspace/navigation.test.ts`.
- Create `render/map.ts` — `renderMap`, `RenderedMap`.
- Create `render/map.test.ts`.
- Modify `index.ts`, `index.test.ts` — exportar lo nuevo.
- Modify `workspace/resolver.ts`, `workspace/resolver.test.ts` — mensajes de `E032`.
- Modify `parser/entity.ts`, `parser/entity.test.ts` — pista de `E042` tras `tags`.

`packages/web/`:
- Create `src/workspace.ts` (+ test) — `EditorWorkspace`, `WorkspaceSnapshot`.
- Create `src/text-edits.ts` (+ test) — posiciones ↔ offsets, aplicar `TextEdit`.
- Create `src/folder-io.ts` (+ test) — abrir carpeta, escribir archivo, permiso.
- Create `src/app.ts` (+ test) — la aplicación (lo que hoy hace `main.ts`, y todo lo nuevo).
- Create `src/entity-panel.ts` (+ test) — HTML del panel de entidad y de arista.
- Create `src/explorer.ts` (+ test) — HTML y eventos del explorador.
- Create `src/map-view.ts` (+ test) — HTML del mapa y franjas de click.
- Modify `src/editor.ts` (+ test) — un `EditorState` por documento, lint desde el link, F12/F2/Ctrl+click.
- Modify `src/preview.ts` (+ test) — `renderActive`, `data-flo-block` por sección, bloque vacío.
- Modify `src/storage.ts` (+ test) — borrador = `WorkspaceSnapshot`, migración del string.
- Modify `src/toolbar.ts` (+ test) — "Abrir carpeta" y "Mapa".
- Modify `src/sequence-view.ts` (+ test) — `data-flo-*` en el header fijo.
- Modify `src/flo-highlight.ts` (+ test) — `STRING`, comas, `:` solo tras `->`.
- Modify `src/file-io.ts` — exportar `readFileAsText` e `isAbortError`; aceptar `.md` al abrir.
- Modify `src/file-system-access.d.ts`, `tsconfig.json` — tipos de `showDirectoryPicker`, permisos y `values()`.
- Modify `src/main.ts`, `index.html` — columna del explorador y del panel.
- Modify `README.md` (task 12).

---

### Task 1: `entityAt` y `renameEntity` en el core

**Files:**
- Create: `packages/core/src/workspace/navigation.ts`
- Test: `packages/core/src/workspace/navigation.test.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes (ya existen): `LinkResult` (`entities: Map<EntityId, EntityDecl>` con la declaración ganadora, `documents: Map<uri, { document, catalog }>`), `relationPath(target)` de `workspace/knowledge.ts` (null = forma id), `isIdentifier(value)` de `parser/yaml.ts`, tipos `ParsedDocument`, `Position`, `Range`, `EntityId`, `DocumentUri` de `ast.ts`.
- Produces (exportados en `index.ts`):
  - `interface TextEdit { range: Range; text: string }`
  - `type RenameResult = { edits: Map<DocumentUri, TextEdit[]> } | { error: string }`
  - `entityAt(document: ParsedDocument, position: Position): EntityId | null`
  - `renameEntity(link: LinkResult, id: EntityId, newId: string): RenameResult`

Semántica (decisión #39): `entityAt` mira, en este orden, el `nameRange`
de cada declaración del documento, el `range` de cada relación resuelta a
entidad y las `Ref` resueltas de los bloques; una posición en el borde
final del rango (cursor justo después del id) cuenta. `renameEntity` edita
la declaración ganadora, las relaciones en forma id de las declaraciones
ganadoras de `.md` y las `Ref` resueltas de todos los bloques (también los
de cercas ` ```flo ` en un `.md`): exactamente `definitionOf` +
`referencesTo` del índice (#30). En YAML (el id de un `.md` y los targets
de relación) el id nuevo va entre comillas dobles si YAML lo leería como
otro tipo; en `.flo`, nunca. Declaraciones perdedoras (`E031`) y
referencias sin resolver no se tocan. Ediciones de cada uri en orden de
posición.

- [x] **Step 1: Write the failing tests**

`packages/core/src/workspace/navigation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Workspace, type LinkResult } from "./workspace.js";
import { entityAt, renameEntity, type TextEdit } from "./navigation.js";

function link(files: Record<string, string>): LinkResult {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

const files = {
  "catalog.flo": "entity api [API]\nentity db\nentity db\n",
  "login.flo": 'use "./catalog.flo"\nflow login {\n  api -> db\n  api -> ghost\n}\n',
  "kb/nota.md": [
    "---",
    'id: "nota"',
    "title: Nota",
    "memory_type: long_term",
    'use: ["../catalog.flo"]',
    "relations:",
    "  - target: db",
    "    type: usa",
    "  - target: ../login.flo#login",
    "    type: usa",
    "---",
    "```flo",
    "flow embebido {",
    "  nota -> db",
    "}",
    "```",
    "",
  ].join("\n"),
};

const at = (line: number, column: number) => ({ line, column });

describe("entityAt", () => {
  const linked = link(files);
  const doc = (uri: string) => linked.documents.get(uri)!.document;

  it("finds a declaration by its name", () => {
    expect(entityAt(doc("catalog.flo"), at(1, 8))).toBe("api");
    expect(entityAt(doc("catalog.flo"), at(1, 11))).toBe("api"); // justo después del id
  });

  it("finds a resolved reference in a block", () => {
    expect(entityAt(doc("login.flo"), at(3, 3))).toBe("api");
    expect(entityAt(doc("login.flo"), at(3, 10))).toBe("db");
  });

  it("returns null for unresolved references and for other text", () => {
    expect(entityAt(doc("login.flo"), at(4, 10))).toBeNull(); // ghost
    expect(entityAt(doc("login.flo"), at(2, 1))).toBeNull(); // 'flow'
  });

  it("finds relation targets and embedded-block references in a .md", () => {
    expect(entityAt(doc("kb/nota.md"), at(7, 13))).toBe("db");
    expect(entityAt(doc("kb/nota.md"), at(2, 6))).toBe("nota");
    expect(entityAt(doc("kb/nota.md"), at(14, 12))).toBe("db");
  });
});

function edited(source: string, edits: TextEdit[]): string {
  const lines = source.split("\n");
  for (const edit of [...edits].reverse()) {
    const { start, end } = edit.range;
    expect(start.line).toBe(end.line); // un id nunca cruza líneas
    const line = lines[start.line - 1];
    lines[start.line - 1] = line.slice(0, start.column - 1) + edit.text + line.slice(end.column - 1);
  }
  return lines.join("\n");
}

function renamed(id: string, newId: string): Record<string, string> {
  const result = renameEntity(link(files), id, newId);
  if ("error" in result) throw new Error(result.error);
  const out: Record<string, string> = {};
  for (const [uri, edits] of result.edits) out[uri] = edited(files[uri as keyof typeof files], edits);
  return out;
}

describe("renameEntity", () => {
  it("renames the winning declaration and every resolved reference, in every document", () => {
    const out = renamed("db", "store");
    expect(out["catalog.flo"]).toBe("entity api [API]\nentity store\nentity db\n"); // la perdedora (E031) no cambia
    expect(out["login.flo"]).toContain("  api -> store\n  api -> ghost");
    expect(out["kb/nota.md"]).toContain("  - target: store\n");
    expect(out["kb/nota.md"]).toContain("  nota -> store\n");
  });

  it("does not touch path-form relation targets", () => {
    expect(renamed("db", "store")["kb/nota.md"]).toContain("  - target: ../login.flo#login\n");
  });

  it("replaces a quoted YAML id whole", () => {
    expect(renamed("nota", "memo")["kb/nota.md"]).toContain("\nid: memo\n");
  });

  it("quotes the new id in YAML when YAML would read it as another type, never in .flo", () => {
    const out = renamed("db", "yes");
    expect(out["kb/nota.md"]).toContain('  - target: "yes"\n');
    expect(out["kb/nota.md"]).toContain("  nota -> yes\n");
    expect(out["login.flo"]).toContain("  api -> yes\n");
    expect(renamed("nota", "Null")["kb/nota.md"]).toContain('\nid: "Null"\n');
  });

  it("orders the edits of each document by position", () => {
    const result = renameEntity(link(files), "db", "store");
    if ("error" in result) throw new Error(result.error);
    const lines = result.edits.get("kb/nota.md")!.map((edit) => edit.range.start.line);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
  });

  it("rejects unknown ids, invalid identifiers and existing ids", () => {
    const linked = link(files);
    expect(renameEntity(linked, "ghost", "x")).toEqual({ error: "no existe la entidad 'ghost'" });
    expect(renameEntity(linked, "db", "1db")).toEqual({
      error: "'1db' no es un identificador: letras, dígitos y '_', sin empezar con dígito",
    });
    expect(renameEntity(linked, "db", "api")).toEqual({ error: "ya existe una entidad 'api'" });
  });

  it("returns no edits when the id does not change", () => {
    expect(renameEntity(link(files), "db", "db")).toEqual({ edits: new Map() });
  });
});
```

Agregar en `packages/core/src/index.test.ts`, al import de `./index.js`,
`entityAt`, `renameEntity`, `type TextEdit`, `type RenameResult`, y este
caso dentro del `describe("index")`:

```ts
  it("exposes entityAt and renameEntity", () => {
    const workspace = new Workspace();
    workspace.setDocument("a.flo", "entity a\nflow f {\n  a -> a\n}\n");
    const linked = workspace.link();
    expect(entityAt(linked.documents.get("a.flo")!.document, { line: 3, column: 3 })).toBe("a");
    const result: RenameResult = renameEntity(linked, "a", "b");
    const edits: TextEdit[] = "edits" in result ? result.edits.get("a.flo")! : [];
    expect(edits.map((edit) => edit.text)).toEqual(["b", "b", "b"]);
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/navigation.test.ts src/index.test.ts`
Expected: FAIL — `Cannot find module './navigation.js'` / `entityAt` no exportado.

- [x] **Step 3: Implement**

`packages/core/src/workspace/navigation.ts`:

```ts
import type { DocumentUri, EntityId, ParsedDocument, Position, Range } from "../ast.js";
import { isIdentifier } from "../parser/yaml.js";
import { relationPath } from "./knowledge.js";
import type { LinkResult } from "./workspace.js";

export interface TextEdit {
  range: Range;
  text: string;
}

export type RenameResult = { edits: Map<DocumentUri, TextEdit[]> } | { error: string };

// Escalares que YAML (1.1 o 1.2) leería como null o booleano: en un .md el
// id nuevo va entre comillas para seguir siendo string (pendiente K1 → F).
const YAML_NON_STRING = /^(null|true|false|yes|no|on|off|y|n)$/i;

function before(a: Position, b: Position): boolean {
  return a.line < b.line || (a.line === b.line && a.column < b.column);
}

// El fin es exclusivo, pero el cursor justo después del id también lo nombra.
function touches(range: Range, position: Position): boolean {
  return !before(position, range.start) && !before(range.end, position);
}

/**
 * La entidad nombrada en `position` (decisión #39): una declaración, el
 * target de una relación resuelta a entidad o una referencia resuelta de un
 * bloque. Null en una referencia sin resolver o fuera de un nombre. Usa los
 * `Ref.target` del último `link()`.
 */
export function entityAt(document: ParsedDocument, position: Position): EntityId | null {
  for (const entity of document.entities) {
    if (touches(entity.nameRange, position)) return entity.id;
    for (const relation of entity.knowledge?.relations ?? []) {
      if (relation.resolved?.kind === "entity" && touches(relation.range, position)) return relation.resolved.id;
    }
  }
  for (const block of document.blocks) {
    for (const edge of block.edges) {
      for (const ref of [edge.from, edge.to]) {
        if (ref.target !== null && touches(ref.range, position)) return ref.target;
      }
    }
  }
  return null;
}

/**
 * Ediciones para renombrar `id` en todo el workspace (decisión #39): la
 * declaración ganadora, las relaciones en forma id de los `.md` ganadores y
 * las referencias resueltas de los bloques — lo mismo que `definitionOf` y
 * `referencesTo`. Una ruta a `.md` en `relations` no escribe el id y no se
 * toca (#30).
 */
export function renameEntity(link: LinkResult, id: EntityId, newId: string): RenameResult {
  const declaration = link.entities.get(id);
  if (!declaration) return { error: `no existe la entidad '${id}'` };
  if (!isIdentifier(newId)) {
    return { error: `'${newId}' no es un identificador: letras, dígitos y '_', sin empezar con dígito` };
  }
  const edits = new Map<DocumentUri, TextEdit[]>();
  if (newId === id) return { edits };
  if (link.entities.has(newId)) return { error: `ya existe una entidad '${newId}'` };

  const yaml = YAML_NON_STRING.test(newId) ? `"${newId}"` : newId;
  const add = (uri: DocumentUri, range: Range, text: string): void => {
    const list = edits.get(uri);
    if (list) list.push({ range, text });
    else edits.set(uri, [{ range, text }]);
  };

  add(declaration.uri, declaration.nameRange, declaration.knowledge ? yaml : newId);
  for (const { document } of link.documents.values()) {
    for (const entity of document.entities) {
      if (!entity.knowledge || link.entities.get(entity.id) !== entity) continue;
      for (const relation of entity.knowledge.relations) {
        const named = relation.resolved?.kind === "entity" && relation.resolved.id === id;
        if (named && relationPath(relation.target) === null) add(document.uri, relation.range, yaml);
      }
    }
    for (const block of document.blocks) {
      for (const edge of block.edges) {
        for (const ref of [edge.from, edge.to]) {
          if (ref.target === id) add(document.uri, ref.range, newId);
        }
      }
    }
  }

  for (const list of edits.values()) list.sort((a, b) => (before(a.range.start, b.range.start) ? -1 : 1));
  return { edits };
}
```

En `packages/core/src/index.ts`, después de la línea de `query`/`tagCatalog`:

```ts
export { entityAt, renameEntity } from "./workspace/navigation.js";
export type { TextEdit, RenameResult } from "./workspace/navigation.js";
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/core test && pnpm --filter @flo/core typecheck && pnpm --filter @flo/core build`
Expected: PASS; ningún snapshot cambia.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/workspace/navigation.ts packages/core/src/workspace/navigation.test.ts packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): entityAt y renameEntity para navegar y renombrar"
```

---

### Task 2: `renderMap` — mapa agregado del sistema

**Files:**
- Create: `packages/core/src/render/map.ts`
- Test: `packages/core/src/render/map.test.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes: `query(link)` (`workspace/query.ts`; sus `edges` de tipo `"flow"` son una por par dirigido con `blocks` en orden de aparición, #32), `renderBlock(block, catalog, uri)` (`render/index.ts`), `LinkResult`.
- Produces (exportados): `interface RenderedMap { svg: string; edges: QueryEdge[] }`, `renderMap(link: LinkResult): RenderedMap`.

Semántica (decisión #40): un bloque `flow` sintético llamado `mapa` con
una arista por cada arista de flujo de `query`, sin label, renderizado
contra `link.entities` (orden del catálogo global, #1/#24) con uri `""`:
los nodos llevan `data-flo-entity`, las aristas `data-flo-from`/`to`,
`data-flo-block="#mapa"` y `data-flo-line="1"` (no hay fuente). Solo
entran entidades con alguna arista; las relaciones de `.md` no (son de
K4). `edges` = las aristas de flujo, para que la web liste los bloques de
cada una.

- [x] **Step 1: Write the failing tests**

`packages/core/src/render/map.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Workspace } from "../workspace/workspace.js";
import { renderMap } from "./map.js";

function mapOf(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return renderMap(workspace.link());
}

const files = {
  "catalog.flo": "entity api [API Gateway]\nentity db\nentity cache\nentity solo\n",
  "login.flo": 'use "./catalog.flo"\nflow login {\n  api -> db\n  db -> api\n}\nsequence detalle {\n  api -> cache : get\n  api -> ghost : x\n}\n',
  "admin.flo": 'use "./catalog.flo"\nflow admin {\n  api -> db\n}\n',
};

const count = (text: string, part: string) => text.split(part).length - 1;

describe("renderMap", () => {
  const map = mapOf(files);

  it("lists one flow edge per directed pair, with the blocks that contain it", () => {
    expect(map.edges).toEqual([
      { from: "api", to: "db", type: "flow", blocks: ["admin.flo#admin", "login.flo#login"] },
      { from: "db", to: "api", type: "flow", blocks: ["login.flo#login"] },
      { from: "api", to: "cache", type: "flow", blocks: ["login.flo#detalle"] },
    ]);
  });

  it("draws each pair once, with the entity labels and the #mapa block", () => {
    expect(count(map.svg, 'data-flo-from="api" data-flo-to="db"')).toBe(1);
    expect(count(map.svg, 'data-flo-from="db" data-flo-to="api"')).toBe(1);
    expect(map.svg).toContain(">API Gateway<");
    expect(map.svg).toContain('data-flo-block="#mapa"');
  });

  it("leaves out entities without edges and unresolved references", () => {
    expect(map.svg).not.toContain('data-flo-entity="solo"');
    expect(map.svg).not.toContain("ghost");
  });

  it("gives an empty map for a workspace without flow edges", () => {
    const empty = mapOf({ "a.flo": "entity a\n" });
    expect(empty.edges).toEqual([]);
    expect(empty.svg).toContain('width="0"');
  });
});
```

En `packages/core/src/index.test.ts`, sumar `renderMap` y
`type RenderedMap` al import y:

```ts
  it("exposes renderMap", () => {
    const workspace = new Workspace();
    workspace.setDocument("a.flo", "entity a\nentity b\nflow f {\n  a -> b\n}\n");
    const map: RenderedMap = renderMap(workspace.link());
    expect(map.edges).toHaveLength(1);
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/core exec vitest run src/render/map.test.ts src/index.test.ts`
Expected: FAIL — `Cannot find module './map.js'`.

- [x] **Step 3: Implement**

`packages/core/src/render/map.ts`:

```ts
import type { DiagramBlock, EntityId, Range, Ref } from "../ast.js";
import { query, type QueryEdge } from "../workspace/query.js";
import type { LinkResult } from "../workspace/workspace.js";
import { renderBlock } from "./index.js";

export interface RenderedMap {
  svg: string;
  /** Las aristas de flujo del workspace, con los bloques que contienen cada una. */
  edges: QueryEdge[];
}

// El bloque sintético no tiene fuente: todos sus rangos apuntan a 1:1.
const NO_RANGE: Range = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

/**
 * Mapa agregado del sistema (spec §8, decisión #40): las aristas de flujo
 * de todo el workspace, una por par dirigido, dibujadas como un `flow` sobre
 * el catálogo global. Las relaciones de `.md` no entran (vista de grafo, K4).
 */
export function renderMap(link: LinkResult): RenderedMap {
  const edges = query(link).edges.filter((edge) => edge.type === "flow");
  const ref = (id: EntityId): Ref => ({ name: id, range: NO_RANGE, target: id });
  const block: DiagramBlock = {
    kind: "flow",
    name: "mapa",
    title: null,
    edges: edges.map((edge) => ({ from: ref(edge.from), to: ref(edge.to), label: null, range: NO_RANGE })),
    range: NO_RANGE,
    nameRange: NO_RANGE,
  };
  return { svg: renderBlock(block, link.entities, "").svg, edges };
}
```

En `packages/core/src/index.ts`, después de la línea de `render, renderBlock`:

```ts
export { renderMap } from "./render/map.js";
export type { RenderedMap } from "./render/map.js";
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/core test && pnpm --filter @flo/core typecheck && pnpm --filter @flo/core build`
Expected: PASS; ningún snapshot cambia.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/render/map.ts packages/core/src/render/map.test.ts packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): renderMap, el mapa agregado de las aristas de flujo"
```

---

### Task 3: Mensajes de `E032` y `E042`

**Files:**
- Modify: `packages/core/src/workspace/resolver.ts:60-66`
- Modify: `packages/core/src/parser/entity.ts` (`parseProps`)
- Test: `packages/core/src/workspace/resolver.test.ts`, `packages/core/src/parser/entity.test.ts`

**Interfaces:**
- Consumes: `resolveUse(from, path)` (null = sale de la raíz o no nombra nada), `SCHEMA_URI` de `workspace/schema.ts`.
- Produces: solo mensajes. Los códigos no cambian.

Mensajes nuevos de `E032` (pendientes E y K1), según la uri a la que
resuelve la ruta:
- `null` → `la ruta '<path>' sale de la raíz del workspace o no nombra un documento`
- `knowledge.schema.yaml` → `'<path>' es el esquema de conocimiento, no un documento del workspace`
- termina en `.md` → `el documento '<path>' no existe en el workspace o no es un documento (un .md necesita frontmatter con '---')`
- otro → `el documento '<path>' no existe en el workspace` (sin cambios)

`E042` tras una propiedad `tags` (pendiente C):
`se esperaba ':' después de '<key>'; los tags se separan con espacios, no con comas`.

- [x] **Step 1: Write the failing tests**

En `packages/core/src/workspace/resolver.test.ts`, junto al test que hoy
verifica `"el documento './nope.flo' no existe en el workspace"` (línea
~104), agregar (usa el helper `link(files)` del archivo):

```ts
  it("explains why a use path is not a document", () => {
    const messages = (path: string) =>
      link({ "dir/a.flo": `use "${path}"\n` }).diagnostics.get("dir/a.flo")!.map((d) => d.message);
    expect(messages("../../x.flo")).toEqual([
      "la ruta '../../x.flo' sale de la raíz del workspace o no nombra un documento",
    ]);
    expect(messages("../knowledge.schema.yaml")).toEqual([
      "'../knowledge.schema.yaml' es el esquema de conocimiento, no un documento del workspace",
    ]);
    expect(messages("./notas.md")).toEqual([
      "el documento './notas.md' no existe en el workspace o no es un documento (un .md necesita frontmatter con '---')",
    ]);
  });
```

En `packages/core/src/parser/entity.test.ts`:

```ts
  it("hints that tags are separated by spaces when a comma follows them", () => {
    const { diagnostics } = parseEntitySource("entity a tags: x, y\n");
    expect(diagnostics.map((d) => [d.code, d.message])).toEqual([
      ["E042", "se esperaba ':' después de 'y'; los tags se separan con espacios, no con comas"],
    ]);
  });

  it("keeps the plain E042 message after other properties", () => {
    const { diagnostics } = parseEntitySource("entity a type: x, y\n");
    expect(diagnostics.map((d) => d.message)).toEqual(["se esperaba ':' después de 'y'"]);
  });
```

(`parseEntitySource` es el helper que ya tiene `entity.test.ts`.)

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/resolver.test.ts src/parser/entity.test.ts`
Expected: FAIL — los mensajes nuevos no coinciden.

- [x] **Step 3: Implement**

En `packages/core/src/workspace/resolver.ts`, importar
`import { SCHEMA_URI } from "./schema.js";`, agregar la función:

```ts
/** Por qué la ruta de un `use` no llega a un documento (E032). */
function missingUseMessage(path: string, target: DocumentUri | null): string {
  if (target === null) return `la ruta '${path}' sale de la raíz del workspace o no nombra un documento`;
  if (target === SCHEMA_URI) return `'${path}' es el esquema de conocimiento, no un documento del workspace`;
  if (target.endsWith(".md")) {
    return `el documento '${path}' no existe en el workspace o no es un documento (un .md necesita frontmatter con '---')`;
  }
  return `el documento '${path}' no existe en el workspace`;
}
```

y en el loop de `uses` reemplazar el mensaje literal:

```ts
        diagnostics
          .get(document.uri)!
          .push(diagnosticAt("E032", missingUseMessage(use.path, target), use.pathRange));
```

En `packages/core/src/parser/entity.ts`, `parseProps`: declarar
`let previous: string | null = null;` antes del `for (;;)`, cambiar el
`E042`:

```ts
    if (cursor.current().kind !== "COLON") {
      const hint = previous === "tags" ? "; los tags se separan con espacios, no con comas" : "";
      diagnostics.push(
        diagnosticAt("E042", `se esperaba ':' después de '${key.value}'${hint}`, cursor.current().range)
      );
      cursor.skipToNextLine();
      return false;
    }
```

y asignar `previous = key.value;` al final del cuerpo del loop, justo
antes del `if (cursor.current().kind !== "COMMA") return true;` (solo se
lee en la vuelta siguiente, así que da lo mismo antes o después).

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/core test && pnpm --filter @flo/core typecheck && pnpm --filter @flo/core build`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/workspace/resolver.ts packages/core/src/workspace/resolver.test.ts packages/core/src/parser/entity.ts packages/core/src/parser/entity.test.ts
git commit -m "fix(core): E032 dice por qué la ruta no es documento y E042 sugiere tags con espacios"
```

---

### Task 4: `EditorWorkspace`, ediciones de texto y borrador del workspace

**Files:**
- Create: `packages/web/src/workspace.ts`, `packages/web/src/workspace.test.ts`
- Create: `packages/web/src/text-edits.ts`, `packages/web/src/text-edits.test.ts`
- Modify: `packages/web/src/storage.ts`, `packages/web/src/storage.test.ts`

**Interfaces:**
- Consumes (de `@flo/core`): `Workspace`, `LinkResult`, `DocumentUri`, `Position`, `TextEdit` (task 1).
- Produces:
  - `interface WorkspaceSnapshot { files: Record<DocumentUri, string>; saved: Record<DocumentUri, string>; active: DocumentUri; dir: FileSystemDirectoryHandle | null }`
  - `class EditorWorkspace { active: DocumentUri; readonly dir: FileSystemDirectoryHandle | null; constructor(snapshot: WorkspaceSnapshot); uris(): DocumentUri[]; source(uri): string; setSource(uri, source): void; isDirty(uri): boolean; hasUnsavedChanges(): boolean; markSaved(uri): void; link(): LinkResult; snapshot(): WorkspaceSnapshot }`
  - `offsetAt(source: string, position: Position): number`, `positionAt(source: string, offset: number): Position`, `interface Change { from: number; to: number; insert: string }`, `toChanges(source, edits: TextEdit[]): Change[]` (orden ascendente), `applyTextEdits(source, edits): string`
  - `saveDraft(snapshot: WorkspaceSnapshot): Promise<void>`, `loadDraft(): Promise<WorkspaceSnapshot | null>`, `LEGACY_DRAFT_URI = "diagrama.flo"`

Semántica (decisiones #37, #38): `saved[uri]` es lo que hay en disco; un
archivo sin entrada nunca se guardó. `isDirty` = fuente ≠ guardado (un
archivo nunca guardado está sucio). `hasUnsavedChanges` cuenta los
archivos que están en disco y cambiaron y, con carpeta abierta, también
los nunca guardados (decisión #43: un `nuevo.flo` de la carpeta pide
confirmación; sin carpeta, un ejemplo o un "nuevo" no). `link()` es perezoso y se invalida en cada
`setSource`. `active` se corrige al primer uri si el del snapshot no
existe. El borrador en IndexedDB es el snapshot entero bajo la clave de
siempre; un string (borrador de antes de F) se lee como
`{ files: { "diagrama.flo": s }, saved: {}, active: "diagrama.flo", dir: null }`,
y un snapshot sin archivos se lee como `null`.

- [x] **Step 1: Write the failing tests**

`packages/web/src/text-edits.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyTextEdits, offsetAt, positionAt, toChanges } from "./text-edits.js";

const source = "entity a\nflow f {\n  a -> a\n}\n";
const range = (l1: number, c1: number, l2: number, c2: number) => ({
  start: { line: l1, column: c1 },
  end: { line: l2, column: c2 },
});

describe("text edits", () => {
  it("converts positions and offsets both ways", () => {
    expect(offsetAt(source, { line: 1, column: 1 })).toBe(0);
    expect(offsetAt(source, { line: 3, column: 3 })).toBe(20);
    expect(positionAt(source, 20)).toEqual({ line: 3, column: 3 });
    expect(positionAt(source, 0)).toEqual({ line: 1, column: 1 });
  });

  it("clamps positions past the end", () => {
    expect(offsetAt(source, { line: 99, column: 1 })).toBe(source.length);
  });

  it("applies non-overlapping edits given in any order", () => {
    const edits = [
      { range: range(3, 8, 3, 9), text: "bb" },
      { range: range(1, 8, 1, 9), text: "bb" },
      { range: range(3, 3, 3, 4), text: "bb" },
    ];
    expect(applyTextEdits(source, edits)).toBe("entity bb\nflow f {\n  bb -> bb\n}\n");
    expect(toChanges(source, edits).map((change) => change.from)).toEqual([7, 20, 25]);
  });
});
```

`packages/web/src/workspace.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { EditorWorkspace, type WorkspaceSnapshot } from "./workspace.js";

const snapshot = (): WorkspaceSnapshot => ({
  files: { "b.flo": 'use "./a.flo"\nflow f {\n  x -> y\n}\n', "a.flo": "entity x\nentity y\n" },
  saved: { "a.flo": "entity x\nentity y\n" },
  active: "b.flo",
  dir: null,
});

describe("EditorWorkspace", () => {
  it("lists uris in order and links across documents", () => {
    const ws = new EditorWorkspace(snapshot());
    expect(ws.uris()).toEqual(["a.flo", "b.flo"]);
    expect(ws.link().diagnostics.get("b.flo")).toEqual([]);
  });

  it("relinks lazily after a change and never returns a stale result", () => {
    const ws = new EditorWorkspace(snapshot());
    const first = ws.link();
    expect(ws.link()).toBe(first);
    ws.setSource("a.flo", "entity x\n");
    const second = ws.link();
    expect(second).not.toBe(first);
    expect(second.diagnostics.get("b.flo")!.map((d) => d.code)).toEqual(["E030"]);
  });

  it("tracks dirty files against what is on disk", () => {
    const ws = new EditorWorkspace(snapshot());
    expect(ws.isDirty("a.flo")).toBe(false);
    expect(ws.isDirty("b.flo")).toBe(true); // nunca guardado
    expect(ws.hasUnsavedChanges()).toBe(false); // b.flo no está en disco
    ws.setSource("a.flo", "entity x\nentity y\nentity z\n");
    expect(ws.hasUnsavedChanges()).toBe(true);
    ws.markSaved("a.flo");
    expect(ws.isDirty("a.flo")).toBe(false);
    expect(ws.hasUnsavedChanges()).toBe(false);
  });

  it("counts never-saved files of an open folder as unsaved changes", () => {
    const ws = new EditorWorkspace({ ...snapshot(), dir: {} as FileSystemDirectoryHandle });
    expect(ws.hasUnsavedChanges()).toBe(true); // b.flo vive en la carpeta pero nunca se guardó
    ws.markSaved("b.flo");
    expect(ws.hasUnsavedChanges()).toBe(false);
  });

  it("falls back to the first uri when the active one does not exist", () => {
    expect(new EditorWorkspace({ ...snapshot(), active: "zzz.flo" }).active).toBe("a.flo");
  });

  it("round-trips through a snapshot", () => {
    const ws = new EditorWorkspace(snapshot());
    ws.setSource("c.flo", "entity c\n");
    ws.active = "c.flo";
    const copy = new EditorWorkspace(ws.snapshot());
    expect(copy.uris()).toEqual(["a.flo", "b.flo", "c.flo"]);
    expect(copy.active).toBe("c.flo");
    expect(copy.isDirty("a.flo")).toBe(false);
  });
});
```

Reescribir `packages/web/src/storage.test.ts` (conservar su `resetDb` y el
`beforeEach` que la llama):

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { saveDraft, loadDraft, DB_NAME, LEGACY_DRAFT_URI } from "./storage.js";
import type { WorkspaceSnapshot } from "./workspace.js";

async function resetDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function putRaw(value: unknown): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put(value, "current");
    tx.oncomplete = () => resolve();
  });
  db.close();
}

describe("drafts", () => {
  beforeEach(resetDb);

  it("returns null when nothing was saved", async () => {
    expect(await loadDraft()).toBeNull();
  });

  it("round-trips a workspace snapshot", async () => {
    const snapshot: WorkspaceSnapshot = {
      files: { "a.flo": "entity a\n", "kb/n.md": "---\n" },
      saved: { "a.flo": "entity a\n" },
      active: "kb/n.md",
      dir: null,
    };
    await saveDraft(snapshot);
    expect(await loadDraft()).toEqual(snapshot);
  });

  it("opens a draft from before workspaces as diagrama.flo", async () => {
    await putRaw("flow viejo {\n}\n");
    expect(await loadDraft()).toEqual({
      files: { [LEGACY_DRAFT_URI]: "flow viejo {\n}\n" },
      saved: {},
      active: LEGACY_DRAFT_URI,
      dir: null,
    });
  });

  it("ignores a snapshot without files", async () => {
    await putRaw({ files: {}, saved: {}, active: "", dir: null });
    expect(await loadDraft()).toBeNull();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/core build && pnpm --filter @flo/web exec vitest run src/text-edits.test.ts src/workspace.test.ts src/storage.test.ts`
Expected: FAIL — módulos inexistentes / `LEGACY_DRAFT_URI` no exportado.

- [x] **Step 3: Implement**

`packages/web/src/text-edits.ts`:

```ts
import type { Position, TextEdit } from "@flo/core";

/** Offset de una posición del core (línea y columna desde 1, en unidades UTF-16 como el lexer). */
export function offsetAt(source: string, position: Position): number {
  let offset = 0;
  for (let line = 1; line < position.line; line++) {
    const next = source.indexOf("\n", offset);
    if (next === -1) return source.length;
    offset = next + 1;
  }
  return Math.min(offset + position.column - 1, source.length);
}

export function positionAt(source: string, offset: number): Position {
  const before = source.slice(0, offset);
  const lineStart = before.lastIndexOf("\n") + 1;
  return { line: before.split("\n").length, column: offset - lineStart + 1 };
}

export interface Change {
  from: number;
  to: number;
  insert: string;
}

/** En orden ascendente, como los espera `EditorView.dispatch`. */
export function toChanges(source: string, edits: TextEdit[]): Change[] {
  return edits
    .map((edit) => ({ from: offsetAt(source, edit.range.start), to: offsetAt(source, edit.range.end), insert: edit.text }))
    .sort((a, b) => a.from - b.from);
}

/** Aplica ediciones que no se solapan, dadas en cualquier orden. */
export function applyTextEdits(source: string, edits: TextEdit[]): string {
  return toChanges(source, edits).reduceRight(
    (text, change) => text.slice(0, change.from) + change.insert + text.slice(change.to),
    source
  );
}
```

`packages/web/src/workspace.ts`:

```ts
import { Workspace, type DocumentUri, type LinkResult } from "@flo/core";

/** Lo que abre una carpeta o un archivo y lo que se guarda como borrador (decisiones #37, #38). */
export interface WorkspaceSnapshot {
  files: Record<DocumentUri, string>;
  /** Contenido en disco de cada archivo; sin entrada = nunca guardado. */
  saved: Record<DocumentUri, string>;
  active: DocumentUri;
  dir: FileSystemDirectoryHandle | null;
}

/**
 * Los archivos abiertos en el editor sobre un `Workspace` del core. `link()`
 * es perezoso y se invalida con cada cambio: nadie guarda un `LinkResult`
 * entre cambios, porque el siguiente `link()` reescribe los `Ref.target`
 * del anterior (pendiente de la Fase E).
 */
export class EditorWorkspace {
  private readonly files = new Map<DocumentUri, string>();
  private readonly saved = new Map<DocumentUri, string>();
  private readonly core = new Workspace();
  private linked: LinkResult | null = null;
  active: DocumentUri;
  readonly dir: FileSystemDirectoryHandle | null;

  constructor(snapshot: WorkspaceSnapshot) {
    for (const [uri, source] of Object.entries(snapshot.files)) this.setSource(uri, source);
    for (const [uri, source] of Object.entries(snapshot.saved)) this.saved.set(uri, source);
    this.active = this.files.has(snapshot.active) ? snapshot.active : (this.uris()[0] ?? "");
    this.dir = snapshot.dir;
  }

  /** En orden de uri, como `LinkResult.documents`. */
  uris(): DocumentUri[] {
    return [...this.files.keys()].sort();
  }

  source(uri: DocumentUri): string {
    return this.files.get(uri) ?? "";
  }

  setSource(uri: DocumentUri, source: string): void {
    this.files.set(uri, source);
    this.core.setDocument(uri, source);
    this.linked = null;
  }

  isDirty(uri: DocumentUri): boolean {
    return this.saved.get(uri) !== this.files.get(uri);
  }

  /** Cambios que se perderían: archivos que difieren de disco; con carpeta, también los nunca guardados (#43). */
  hasUnsavedChanges(): boolean {
    return this.uris().some((uri) => this.isDirty(uri) && (this.saved.has(uri) || this.dir !== null));
  }

  markSaved(uri: DocumentUri): void {
    this.saved.set(uri, this.source(uri));
  }

  link(): LinkResult {
    return (this.linked ??= this.core.link());
  }

  snapshot(): WorkspaceSnapshot {
    return {
      files: Object.fromEntries(this.files),
      saved: Object.fromEntries(this.saved),
      active: this.active,
      dir: this.dir,
    };
  }
}
```

`packages/web/src/storage.ts`: conservar `DB_NAME`, `STORE_NAME`,
`DRAFT_KEY` y `openDb`; reemplazar `saveDraft`/`loadDraft`:

```ts
import type { WorkspaceSnapshot } from "./workspace.js";

/** Uri con la que se abre un borrador de antes de la Fase F (un string). */
export const LEGACY_DRAFT_URI = "diagrama.flo";

export async function saveDraft(snapshot: WorkspaceSnapshot): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(snapshot, DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDraft(): Promise<WorkspaceSnapshot | null> {
  const db = await openDb();
  const stored = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(DRAFT_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (typeof stored === "string") {
    return { files: { [LEGACY_DRAFT_URI]: stored }, saved: {}, active: LEGACY_DRAFT_URI, dir: null };
  }
  const snapshot = stored as WorkspaceSnapshot | undefined;
  return snapshot && Object.keys(snapshot.files ?? {}).length > 0 ? snapshot : null;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web exec vitest run src/text-edits.test.ts src/workspace.test.ts src/storage.test.ts`
Expected: PASS. (`main.ts` todavía llama a `saveDraft(source)`: el
typecheck de web se arregla en la task 6; no correrlo ahora.)

- [x] **Step 5: Commit**

```bash
git add packages/web/src/workspace.ts packages/web/src/workspace.test.ts packages/web/src/text-edits.ts packages/web/src/text-edits.test.ts packages/web/src/storage.ts packages/web/src/storage.test.ts
git commit -m "feat(web): EditorWorkspace, ediciones de texto y borrador del workspace entero"
```

---

### Task 5: Abrir una carpeta y escribir en ella

**Files:**
- Create: `packages/web/src/folder-io.ts`, `packages/web/src/folder-io.test.ts`
- Modify: `packages/web/src/file-io.ts` (exportar `readFileAsText` e `isAbortError`; `.md` en el picker)
- Modify: `packages/web/src/file-system-access.d.ts`, `packages/web/tsconfig.json`

**Interfaces:**
- Consumes: `SCHEMA_URI` de `@flo/core`, `WorkspaceSnapshot` (task 4), `readFileAsText(file: File): Promise<string>` e `isAbortError(error: unknown): boolean` de `file-io.ts`.
- Produces:
  - `isWorkspaceFile(uri: string): boolean`
  - `hasDirectoryAccess(): boolean`
  - `openFolder(): Promise<WorkspaceSnapshot | null>` (null = cancelado)
  - `writeWorkspaceFile(dir: FileSystemDirectoryHandle, uri: string, source: string): Promise<void>`
  - `ensureWritable(dir: FileSystemDirectoryHandle): Promise<boolean>`

Semántica (decisión #37, que aplica #33 al navegador): entran los `.flo`,
los `.md` (los sin frontmatter también: se pueden abrir y editar, el core
los ignora, #21) y `knowledge.schema.yaml` solo en la raíz; nunca nada bajo
`node_modules` o `.git`. La uri es la ruta POSIX relativa a la carpeta
elegida. `saved` = `files` (lo leído es lo que hay en disco). `active` =
el primer uri que no es el esquema. Con File System Access se usa
`showDirectoryPicker({ mode: "readwrite" })` y el snapshot lleva el
handle; sin ella, `<input type=file webkitdirectory>` y `dir: null` (solo
lectura: guardar descarga el archivo activo). `ensureWritable` consulta y,
si hace falta, pide el permiso de escritura (un handle restaurado del
borrador lo pierde al recargar); si el navegador no tiene esos métodos,
devuelve `true`.

- [x] **Step 1: Write the failing tests**

`packages/web/src/folder-io.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { ensureWritable, isWorkspaceFile, openFolder, writeWorkspaceFile } from "./folder-io.js";

type Tree = { [name: string]: string | Tree };

function fakeDir(name: string, tree: Tree): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *values() {
      for (const [child, value] of Object.entries(tree)) {
        yield typeof value === "string"
          ? { kind: "file", name: child, getFile: async () => new File([value], child) }
          : fakeDir(child, value);
      }
    },
  } as unknown as FileSystemDirectoryHandle;
}

/** Un directorio que registra lo que se escribe, por ruta. */
function recordingDir(written: Record<string, string>, prefix = ""): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    getDirectoryHandle: vi.fn(async (name: string) => recordingDir(written, `${prefix}${name}/`)),
    getFileHandle: vi.fn(async (name: string) => ({
      createWritable: async () => ({
        write: async (data: string) => {
          written[`${prefix}${name}`] = data;
        },
        close: async () => {},
      }),
    })),
  } as unknown as FileSystemDirectoryHandle;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
});

describe("isWorkspaceFile", () => {
  it("accepts .flo, .md and the root schema only", () => {
    expect(isWorkspaceFile("a.flo")).toBe(true);
    expect(isWorkspaceFile("kb/n.md")).toBe(true);
    expect(isWorkspaceFile("knowledge.schema.yaml")).toBe(true);
    expect(isWorkspaceFile("sub/knowledge.schema.yaml")).toBe(false);
    expect(isWorkspaceFile("logo.png")).toBe(false);
    expect(isWorkspaceFile("node_modules/x/a.flo")).toBe(false);
    expect(isWorkspaceFile(".git/a.md")).toBe(false);
  });
});

describe("openFolder", () => {
  it("reads a real-looking folder with the File System Access API", async () => {
    const dir = fakeDir("proyecto", {
      "knowledge.schema.yaml": "type_tags: []\nrelation_types: []\n",
      "catalog.flo": "entity a\n",
      "logo.png": "binario",
      "README.md": "# sin frontmatter\n",
      flujos: { "login.flo": "flow f {\n}\n", "knowledge.schema.yaml": "no" },
      node_modules: { pkg: { "x.flo": "entity x\n" } },
      ".git": { "HEAD.md": "---\n" },
    });
    window.showDirectoryPicker = vi.fn().mockResolvedValue(dir);

    const snapshot = await openFolder();

    expect(window.showDirectoryPicker).toHaveBeenCalledWith({ mode: "readwrite" });
    expect(Object.keys(snapshot!.files).sort()).toEqual([
      "README.md",
      "catalog.flo",
      "flujos/login.flo",
      "knowledge.schema.yaml",
    ]);
    expect(snapshot!.saved).toEqual(snapshot!.files);
    expect(snapshot!.active).toBe("README.md");
    expect(snapshot!.dir).toBe(dir);
  });

  it("returns null when the picker is cancelled", async () => {
    window.showDirectoryPicker = vi.fn().mockRejectedValue(new DOMException("x", "AbortError"));
    expect(await openFolder()).toBeNull();
  });

  it("falls back to <input webkitdirectory>, read-only", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      const file = (path: string, content: string) => {
        const f = new File([content], path.split("/").pop()!);
        Object.defineProperty(f, "webkitRelativePath", { value: path });
        return f;
      };
      const files = [file("proyecto/a.flo", "entity a\n"), file("proyecto/node_modules/b.flo", "x"), file("proyecto/img.png", "x")];
      Object.defineProperty(this, "files", { value: files, configurable: true });
      this.dispatchEvent(new Event("change"));
    });

    const snapshot = await openFolder();

    expect(snapshot).toEqual({ files: { "a.flo": "entity a\n" }, saved: { "a.flo": "entity a\n" }, active: "a.flo", dir: null });
  });
});

describe("writeWorkspaceFile", () => {
  it("writes into nested folders, creating them", async () => {
    const written: Record<string, string> = {};
    const dir = recordingDir(written);
    await writeWorkspaceFile(dir, "kb/notas/a.md", "---\n");
    expect(written).toEqual({ "kb/notas/a.md": "---\n" });
    expect(dir.getDirectoryHandle).toHaveBeenCalledWith("kb", { create: true });
  });
});

describe("ensureWritable", () => {
  it("asks for permission only when it is not granted yet", async () => {
    const granted = { queryPermission: vi.fn().mockResolvedValue("granted"), requestPermission: vi.fn() };
    expect(await ensureWritable(granted as unknown as FileSystemDirectoryHandle)).toBe(true);
    expect(granted.requestPermission).not.toHaveBeenCalled();

    const denied = { queryPermission: vi.fn().mockResolvedValue("prompt"), requestPermission: vi.fn().mockResolvedValue("denied") };
    expect(await ensureWritable(denied as unknown as FileSystemDirectoryHandle)).toBe(false);
    expect(denied.requestPermission).toHaveBeenCalledWith({ mode: "readwrite" });
  });

  it("assumes permission when the browser has no permission methods", async () => {
    expect(await ensureWritable({} as FileSystemDirectoryHandle)).toBe(true);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/folder-io.test.ts`
Expected: FAIL — `Cannot find module './folder-io.js'`.

- [x] **Step 3: Implement**

`packages/web/tsconfig.json`: `"lib": ["ES2022", "DOM", "DOM.Iterable", "DOM.AsyncIterable"]`
(`FileSystemDirectoryHandle.values()` vive en `DOM.AsyncIterable`).

`packages/web/src/file-system-access.d.ts`, dentro de `declare global`:

```ts
  interface FileSystemHandlePermissionDescriptor {
    mode?: "read" | "readwrite";
  }

  // Chrome los tiene; lib.dom todavía no.
  interface FileSystemHandle {
    queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface DirectoryPickerOptions {
    mode?: "read" | "readwrite";
  }
```

y en `interface Window`:
`showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;`

`packages/web/src/file-io.ts`: poner `export` a `readFileAsText` e
`isAbortError`, y aceptar `.md` al abrir:

```ts
const FLO_PICKER_OPTIONS: FilePickerOptions = {
  types: [{ description: "Documento .flo o .md", accept: { "text/plain": [".flo", ".md"] } }],
};
```

(y en el fallback `input.accept = ".flo,.md,text/plain";`).

`packages/web/src/folder-io.ts`:

```ts
import { SCHEMA_URI } from "@flo/core";
import { isAbortError, readFileAsText } from "./file-io.js";
import type { WorkspaceSnapshot } from "./workspace.js";

const IGNORED = new Set(["node_modules", ".git"]);

/** Decisión #37 (la regla de carga de #33 en el navegador): .flo, .md y el esquema solo en la raíz. */
export function isWorkspaceFile(uri: string): boolean {
  if (uri.split("/").some((segment) => IGNORED.has(segment))) return false;
  return uri === SCHEMA_URI || uri.endsWith(".flo") || uri.endsWith(".md");
}

export function hasDirectoryAccess(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function snapshotOf(files: Record<string, string>, dir: FileSystemDirectoryHandle | null): WorkspaceSnapshot {
  const uris = Object.keys(files).sort();
  return { files, saved: { ...files }, active: uris.find((uri) => uri !== SCHEMA_URI) ?? uris[0] ?? "", dir };
}

async function readDirectory(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  files: Record<string, string>
): Promise<void> {
  for await (const handle of dir.values()) {
    const uri = `${prefix}${handle.name}`;
    if (handle.kind === "directory") {
      if (!IGNORED.has(handle.name)) await readDirectory(handle as FileSystemDirectoryHandle, `${uri}/`, files);
    } else if (isWorkspaceFile(uri)) {
      files[uri] = await readFileAsText(await (handle as FileSystemFileHandle).getFile());
    }
  }
}

function openFolderFallback(): Promise<WorkspaceSnapshot | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.addEventListener("change", () => {
      // webkitRelativePath = "<carpeta elegida>/<ruta>": la uri es la ruta sin la carpeta.
      const entries = Array.from(input.files ?? [])
        .map((file) => [file.webkitRelativePath.split("/").slice(1).join("/"), file] as const)
        .filter(([uri]) => isWorkspaceFile(uri));
      Promise.all(entries.map(async ([uri, file]) => [uri, await readFileAsText(file)] as const)).then(
        (read) => resolve(snapshotOf(Object.fromEntries(read), null)),
        reject
      );
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Abre una carpeta como workspace; null si se cancela. */
export async function openFolder(): Promise<WorkspaceSnapshot | null> {
  if (!hasDirectoryAccess()) return openFolderFallback();
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await window.showDirectoryPicker!({ mode: "readwrite" });
  } catch (error) {
    if (isAbortError(error)) return null;
    throw error;
  }
  const files: Record<string, string> = {};
  await readDirectory(dir, "", files);
  return snapshotOf(files, dir);
}

/** Escribe `uri` dentro de la carpeta, creando las subcarpetas que falten. */
export async function writeWorkspaceFile(dir: FileSystemDirectoryHandle, uri: string, source: string): Promise<void> {
  const parts = uri.split("/");
  let current = dir;
  for (const part of parts.slice(0, -1)) current = await current.getDirectoryHandle(part, { create: true });
  const file = await current.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await file.createWritable();
  await writable.write(source);
  await writable.close();
}

/** Un handle restaurado del borrador pierde el permiso al recargar la página: se vuelve a pedir. */
export async function ensureWritable(dir: FileSystemDirectoryHandle): Promise<boolean> {
  if (!dir.queryPermission || !dir.requestPermission) return true;
  const descriptor = { mode: "readwrite" } as const;
  if ((await dir.queryPermission(descriptor)) === "granted") return true;
  return (await dir.requestPermission(descriptor)) === "granted";
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web exec vitest run src/folder-io.test.ts src/file-io.test.ts`
Expected: PASS. (Si un test de `file-io.test.ts` verifica el texto de
`accept` o `description`, actualizar solo esa expectativa al valor nuevo.)

- [x] **Step 5: Commit**

```bash
git add packages/web/src/folder-io.ts packages/web/src/folder-io.test.ts packages/web/src/file-io.ts packages/web/src/file-io.test.ts packages/web/src/file-system-access.d.ts packages/web/tsconfig.json
git commit -m "feat(web): abrir una carpeta como workspace y escribir en ella"
```

---

### Task 6: `App` — editor por documento, preview enlazado y guardado

**Files:**
- Create: `packages/web/src/app.ts`, `packages/web/src/app.test.ts`
- Modify: `packages/web/src/editor.ts`, `packages/web/src/editor.test.ts`
- Modify: `packages/web/src/preview.ts`, `packages/web/src/preview.test.ts`
- Modify: `packages/web/src/toolbar.ts`, `packages/web/src/toolbar.test.ts`
- Modify: `packages/web/src/main.ts`, `packages/web/index.html`

**Interfaces:**
- Consumes: `EditorWorkspace`, `WorkspaceSnapshot` (task 4); `openFolder`, `writeWorkspaceFile`, `ensureWritable` (task 5); `openFloFile`, `saveFloFile` (`file-io.ts`); `renderBlock`, `blockId`, `escapeXml`, `LinkResult`, `RenderResult`, `DocumentUri` (`@flo/core`); `parseSvgSize` (`export.ts`); `saveDraft` (task 4).
- Produces:
  - `editor.ts`: `interface EditorHost { workspace(): EditorWorkspace; onChange(): void }`, `createEditor(parent: HTMLElement): EditorView`, `showDocument(view: EditorView, host: EditorHost, uri: DocumentUri, previous?: EditorState): void`. Se borran `getEditorSource`/`setEditorSource`.
  - `preview.ts`: `renderActive(link: LinkResult, uri: DocumentUri): RenderResult`; `previewHtml(state, result, uri: DocumentUri): string` (cada `<section class="flo-block">` lleva `data-flo-block="<uri>#<nombre>"`). `PreviewState` y `nextPreviewState` no cambian.
  - `toolbar.ts`: `ToolbarActions` suma `onOpenFolder(): void` (botón `#flo-open-folder`, "Abrir carpeta").
  - `app.ts`: `newWorkspace(kind?: DiagramKind): WorkspaceSnapshot`, `interface AppElements { toolbar; explorer; editor; preview; panel: HTMLElement }`, `class App { ws: EditorWorkspace; readonly view: EditorView; constructor(el: AppElements, snapshot: WorkspaceSnapshot); load(snapshot, fileHandle?): void; openDocument(uri): void; refresh(): void; newDocument(kind): void; openFile(): Promise<void>; openFolder(): Promise<void>; save(): Promise<void>; loadExample(id: string): void }`. Campos privados que las tasks 7–10 extienden: `el`, `host`, `previewState`, `fileHandle`, `states` (`Map<DocumentUri, EditorState>`), `shown`, y el método `exportable(): string | undefined`.

Semántica: cada documento tiene su `EditorState` (su historial de
deshacer); cambiar de documento es `view.setState`. `App` guarda el estado
que deja el editor por uri y lo reusa al volver, salvo que la fuente haya
cambiado por fuera del editor (renombrar), y los olvida al reemplazar el
workspace (#43). Un cambio en el
editor llega al workspace en el acto (`setSource`), así el lint (que lee
`ws.link().diagnostics` del uri) nunca ve una fuente vieja; el preview se
recalcula 200 ms después del último cambio. El resaltado `.flo` solo se
aplica a uris `.flo`. El preview muestra los bloques del documento activo
contra **su** catálogo alcanzable (también las cercas de un `.md`); el
esquema y un `.md` sin frontmatter no tienen preview. Bloque vacío (SVG
de ancho 0) → "Bloque vacío"; sin bloques y con errores → solo el banner
(pendientes C). "Nuevo" con carpeta abierta agrega `nuevo.flo`
(`nuevo-2.flo`, ...) al workspace; sin carpeta lo reemplaza. Guardar
(decisión #38): con carpeta, pide permiso y escribe todos los archivos
modificados, sin validar; sin carpeta, el activo con el picker o la
descarga de siempre. `save()` fija el workspace al empezar: si se
reemplaza durante un `await`, no escribe el nuevo en la carpeta vieja.
Reemplazar un workspace con cambios sin guardar pide confirmación (#43). Cada `refresh()` guarda el borrador (sus errores se
ignoran: sin IndexedDB el editor sigue funcionando).

- [x] **Step 1: Write the failing tests**

Reescribir `packages/web/src/editor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEditor, showDocument, type EditorHost } from "./editor.js";
import { floHighlightField } from "./flo-highlight-field.js";
import { EditorWorkspace } from "./workspace.js";

describe("editor", () => {
  let ws: EditorWorkspace;
  let host: EditorHost & { onChange: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    ws = new EditorWorkspace({
      files: { "a.flo": "entity a\nflow f {\n  a -> a\n}\n", "n.md": "---\nid: n\n---\n" },
      saved: {},
      active: "a.flo",
      dir: null,
    });
    host = { workspace: () => ws, onChange: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a document and pushes each change to the workspace at once", () => {
    const view = createEditor(document.createElement("div"));
    showDocument(view, host, "a.flo");
    expect(view.state.doc.toString()).toBe(ws.source("a.flo"));

    view.dispatch({ changes: { from: 0, insert: "// hola\n" } });
    expect(ws.source("a.flo")).toBe("// hola\nentity a\nflow f {\n  a -> a\n}\n");
    view.destroy();
  });

  it("calls onChange 200ms after the last edit, not for selection changes", () => {
    const view = createEditor(document.createElement("div"));
    showDocument(view, host, "a.flo");
    view.dispatch({ selection: { anchor: 1 } });
    view.dispatch({ changes: { from: 0, insert: "x" } });
    vi.advanceTimersByTime(199);
    expect(host.onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(host.onChange).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  it("gives each document its own state and highlights only .flo", () => {
    const view = createEditor(document.createElement("div"));
    showDocument(view, host, "a.flo");
    expect(view.state.field(floHighlightField, false)).toBeDefined();
    showDocument(view, host, "n.md");
    expect(view.state.doc.toString()).toBe("---\nid: n\n---\n");
    expect(view.state.field(floHighlightField, false)).toBeUndefined();
    view.destroy();
  });
});
```

En `packages/web/src/preview.test.ts`: las llamadas existentes a
`previewHtml(state, result)` pasan a `previewHtml(state, result, "")` (las
secciones esperadas suman `data-flo-block="#<nombre>"`), los SVG de prueba
llevan tamaño (`<svg width="1" height="1">…</svg>`: `parseSvgSize` lanza
con un SVG sin `width`/`height`, y el render siempre los emite), el test
que espera el texto vacío junto a un banner pasa a esperar solo el
banner, y se agregan:

```ts
import { Workspace } from "@flo/core";
import { renderActive } from "./preview.js";

function linked(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

describe("renderActive", () => {
  it("renders the active document's blocks against its reachable catalog", () => {
    const link = linked({ "a.flo": "entity x [Equis]\nentity y\n", "b.flo": 'use "./a.flo"\nflow f {\n  x -> y\n}\n' });
    const result = renderActive(link, "b.flo");
    expect(result.diagnostics).toEqual([]);
    expect(result.diagrams[0].svg).toContain(">Equis<");
    expect(result.diagrams[0].svg).toContain('data-flo-uri="b.flo"');
  });

  it("renders the flo fences of a .md and nothing for the schema", () => {
    const link = linked({
      "n.md": "---\nid: n\ntitle: N\nmemory_type: working\n---\n```flo\nentity a\nflow f {\n  a -> a\n}\n```\n",
      "knowledge.schema.yaml": "type_tags: []\nrelation_types: []\n",
    });
    expect(renderActive(link, "n.md").diagrams).toHaveLength(1);
    expect(renderActive(link, "knowledge.schema.yaml").diagrams).toEqual([]);
  });
});

describe("previewHtml (workspace)", () => {
  it("tags each section with its block id", () => {
    const html = previewHtml({ lastDiagrams: [] }, { diagrams: [diagram("f", '<svg width="10" height="10"></svg>')], diagnostics: [] }, "dir/a.flo");
    expect(html).toContain('<section class="flo-block" data-flo-block="dir/a.flo#f">');
  });

  it("says 'Bloque vacío' instead of a zero-size svg", () => {
    const html = previewHtml({ lastDiagrams: [] }, { diagrams: [diagram("f", '<svg width="0" height="0"></svg>')], diagnostics: [] }, "a.flo");
    expect(html).toContain("Bloque vacío");
    expect(html).not.toContain("<svg");
  });

  it("shows only the banner when there are errors and nothing to draw", () => {
    const html = previewHtml({ lastDiagrams: [] }, { diagrams: [], diagnostics: [ERROR] }, "a.flo");
    expect(html).toBe('<div class="flo-banner">1 error</div>');
  });
});
```

En `packages/web/src/toolbar.test.ts`: `mockActions()` suma
`onOpenFolder: vi.fn()` y el test de botones suma:

```ts
    container.querySelector<HTMLButtonElement>("#flo-open-folder")!.click();
    expect(actions.onOpenFolder).toHaveBeenCalledTimes(1);
```

`packages/web/src/app.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runScopeHandlers } from "@codemirror/view";
import { App, newWorkspace, type AppElements } from "./app.js";
import type { WorkspaceSnapshot } from "./workspace.js";

export function elements(): AppElements {
  const el = () => document.body.appendChild(document.createElement("div"));
  return { toolbar: el(), explorer: el(), editor: el(), preview: el(), panel: el() };
}

export const FILES: WorkspaceSnapshot = {
  files: {
    "catalog.flo": "entity api [API Gateway]\nentity db [Base]\n",
    "login.flo": 'use "./catalog.flo"\nflow login "Inicio" {\n  api -> db\n}\nflow vacio {}\n',
  },
  saved: {
    "catalog.flo": "entity api [API Gateway]\nentity db [Base]\n",
    "login.flo": 'use "./catalog.flo"\nflow login "Inicio" {\n  api -> db\n}\nflow vacio {}\n',
  },
  active: "login.flo",
  dir: null,
};

describe("App", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("previews the active document with entities from other documents", () => {
    const el = elements();
    const app = new App(el, FILES);
    expect(app.view.state.doc.toString()).toBe(FILES.files["login.flo"]);
    expect(el.preview.innerHTML).toContain(">API Gateway<");
    expect(el.preview.innerHTML).toContain('data-flo-block="login.flo#login"');
    expect(el.preview.innerHTML).toContain("Bloque vacío");
  });

  it("relinks every document after an edit in another one", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.openDocument("catalog.flo");
    app.view.dispatch({ changes: { from: 0, to: "entity api [API Gateway]".length, insert: "entity api [Puerta]" } });
    app.openDocument("login.flo");
    expect(el.preview.innerHTML).toContain(">Puerta<");
  });

  it("switches documents in the editor", () => {
    const app = new App(elements(), FILES);
    app.openDocument("catalog.flo");
    expect(app.ws.active).toBe("catalog.flo");
    expect(app.view.state.doc.toString()).toBe(FILES.files["catalog.flo"]);
  });

  it("adds a new file to an open folder instead of replacing the workspace", () => {
    const dir = {} as FileSystemDirectoryHandle;
    const app = new App(elements(), { ...FILES, dir });
    app.newDocument("flowchart");
    app.newDocument("sequence");
    expect(app.ws.uris()).toEqual(["catalog.flo", "login.flo", "nuevo-2.flo", "nuevo.flo"]);
    expect(app.ws.active).toBe("nuevo-2.flo");
  });

  it("replaces the workspace for a new document without a folder, asking before discarding changes", () => {
    const app = new App(elements(), FILES);
    app.ws.setSource("catalog.flo", "entity api\n");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    app.newDocument("flowchart");
    expect(confirm).toHaveBeenCalledWith("Hay cambios sin guardar. ¿Descartarlos?");
    expect(app.ws.uris()).toEqual(["catalog.flo", "login.flo"]);
    confirm.mockReturnValue(true);
    app.newDocument("flowchart");
    expect(app.ws.uris()).toEqual(["nuevo.flo"]);
  });

  it("asks before replacing an open folder whose new file was never saved", () => {
    const app = new App(elements(), { ...FILES, dir: {} as FileSystemDirectoryHandle });
    app.newDocument("flowchart");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    app.loadExample("flowchart");
    expect(confirm).toHaveBeenCalledWith("Hay cambios sin guardar. ¿Descartarlos?");
    expect(app.ws.uris()).toContain("nuevo.flo");
  });

  it("keeps each document's undo history across switches", () => {
    const app = new App(elements(), FILES);
    app.openDocument("catalog.flo");
    app.view.dispatch({ changes: { from: 0, insert: "entity x\n" } });
    app.openDocument("login.flo");
    app.openDocument("catalog.flo");
    // jsdom no es mac: Mod-z es Ctrl-z.
    runScopeHandlers(app.view, new KeyboardEvent("keydown", { key: "z", ctrlKey: true }), "editor");
    expect(app.view.state.doc.toString()).toBe(FILES.files["catalog.flo"]);
    expect(app.ws.source("catalog.flo")).toBe(FILES.files["catalog.flo"]);
  });

  it("saves every modified file into the folder", async () => {
    const written: Record<string, string> = {};
    const dir = {
      queryPermission: vi.fn().mockResolvedValue("granted"),
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn(async (name: string) => ({
        createWritable: async () => ({ write: async (data: string) => void (written[name] = data), close: async () => {} }),
      })),
      requestPermission: vi.fn(),
    } as unknown as FileSystemDirectoryHandle;
    const app = new App(elements(), { ...FILES, dir });
    app.ws.setSource("catalog.flo", "entity api\nentity db\n");

    await app.save();

    expect(written).toEqual({ "catalog.flo": "entity api\nentity db\n" });
    expect(app.ws.isDirty("catalog.flo")).toBe(false);
  });

  it("does not mark anything saved when write permission is denied", async () => {
    const dir = {
      queryPermission: vi.fn().mockResolvedValue("prompt"),
      requestPermission: vi.fn().mockResolvedValue("denied"),
    } as unknown as FileSystemDirectoryHandle;
    const app = new App(elements(), { ...FILES, dir });
    app.ws.setSource("catalog.flo", "entity api\n");
    await expect(app.save()).rejects.toThrow("sin permiso de escritura en la carpeta");
    expect(app.ws.isDirty("catalog.flo")).toBe(true);
  });

  it("starts from a new flowchart", () => {
    expect(newWorkspace()).toEqual({ files: { "nuevo.flo": "flow nuevo {\n\n}\n" }, saved: {}, active: "nuevo.flo", dir: null });
  });
});
```

(Los helpers `elements` y `FILES` se exportan para que los tests de las
tasks 7–10, que viven en este mismo archivo, los reusen.)

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/editor.test.ts src/preview.test.ts src/toolbar.test.ts src/app.test.ts`
Expected: FAIL — `showDocument`, `renderActive`, `./app.js` no existen.

- [x] **Step 3: Implement**

`packages/web/src/editor.ts` (reemplazo completo):

```ts
import { basicSetup } from "codemirror";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { linter, lintGutter } from "@codemirror/lint";
import type { DocumentUri } from "@flo/core";
import { floHighlightField } from "./flo-highlight-field.js";
import { toLintDiagnostics } from "./flo-lint.js";
import type { EditorWorkspace } from "./workspace.js";

const PREVIEW_DEBOUNCE_MS = 200;

export interface EditorHost {
  /** El workspace vigente: la app lo reemplaza al abrir otra carpeta. */
  workspace(): EditorWorkspace;
  /** 200 ms después del último cambio del documento. */
  onChange(): void;
}

export function createEditor(parent: HTMLElement): EditorView {
  return new EditorView({ parent });
}

function documentExtensions(host: EditorHost, uri: DocumentUri): Extension[] {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return [
    basicSetup,
    uri.endsWith(".flo") ? floHighlightField : [],
    lintGutter(),
    linter((v) => toLintDiagnostics(host.workspace().link().diagnostics.get(uri) ?? [], v.state.doc), {
      delay: PREVIEW_DEBOUNCE_MS,
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      // En el acto: el lint lee el workspace y no puede ver una fuente vieja.
      host.workspace().setSource(uri, update.state.doc.toString());
      clearTimeout(timer);
      timer = setTimeout(() => host.onChange(), PREVIEW_DEBOUNCE_MS);
    }),
  ];
}

/**
 * Muestra `uri` con su estado anterior (y su historial de deshacer) si su fuente
 * no cambió por fuera del editor; si no, con uno nuevo (#43).
 */
export function showDocument(view: EditorView, host: EditorHost, uri: DocumentUri, previous?: EditorState): void {
  const doc = host.workspace().source(uri);
  view.setState(
    previous?.doc.toString() === doc ? previous : EditorState.create({ doc, extensions: documentExtensions(host, uri) })
  );
}
```

`packages/web/src/preview.ts` (reemplazo completo):

```ts
import { blockId, escapeXml, renderBlock, type DocumentUri, type LinkResult, type RenderResult, type RenderedDiagram } from "@flo/core";
import { parseSvgSize } from "./export.js";

export interface PreviewState {
  lastDiagrams: RenderedDiagram[];
}

/** Los bloques del documento contra su catálogo alcanzable; el esquema y un `.md` sin frontmatter no tienen. */
export function renderActive(link: LinkResult, uri: DocumentUri): RenderResult {
  const diagnostics = link.diagnostics.get(uri) ?? [];
  const linked = link.documents.get(uri);
  if (!linked) return { diagrams: [], diagnostics };
  return { diagrams: linked.document.blocks.map((block) => renderBlock(block, linked.catalog, uri)), diagnostics };
}

// Sin bloques y con errores = el documento no se pudo usar (p. ej. mientras
// se escribe un header); se mantiene el último preview válido. Un documento
// válido sin bloques (solo catálogo) sí vacía el preview.
export function nextPreviewState(state: PreviewState, result: RenderResult): PreviewState {
  if (result.diagrams.length === 0 && result.diagnostics.length > 0) return state;
  return { lastDiagrams: result.diagrams };
}

function sectionHtml(diagram: RenderedDiagram, uri: DocumentUri): string {
  // Un bloque sin aristas da un SVG de ancho 0: se dice en vez de dibujar nada.
  const body = parseSvgSize(diagram.svg).width === 0 ? '<p class="flo-empty">Bloque vacío</p>' : diagram.svg;
  const id = escapeXml(blockId(uri, diagram.name));
  return `<section class="flo-block" data-flo-block="${id}"><h2 class="flo-block-title">${escapeXml(diagram.title ?? diagram.name)}</h2>${body}</section>`;
}

export function previewHtml(state: PreviewState, result: RenderResult, uri: DocumentUri): string {
  const diagrams = nextPreviewState(state, result).lastDiagrams;
  const count = result.diagnostics.length;
  const banner = count > 0 ? `<div class="flo-banner">${count} error${count === 1 ? "" : "es"}</div>` : "";
  if (diagrams.length > 0) return banner + diagrams.map((diagram) => sectionHtml(diagram, uri)).join("");
  return banner || '<div class="flo-empty">Escribí un diagrama .flo para ver el preview</div>';
}
```

`packages/web/src/toolbar.ts`: sumar `onOpenFolder(): void` a
`ToolbarActions`, el botón
`<button id="flo-open-folder" type="button">Abrir carpeta</button>` justo
después de `#flo-open`, y
`byId("flo-open-folder").addEventListener("click", actions.onOpenFolder);`.

`packages/web/src/app.ts`:

```ts
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { DocumentUri } from "@flo/core";
import { createEditor, showDocument, type EditorHost } from "./editor.js";
import { nextPreviewState, previewHtml, renderActive, type PreviewState } from "./preview.js";
import { createToolbar, type DiagramKind } from "./toolbar.js";
import { openFloFile, saveFloFile } from "./file-io.js";
import { ensureWritable, openFolder, writeWorkspaceFile } from "./folder-io.js";
import { exportSvg, exportPng } from "./export.js";
import { saveDraft } from "./storage.js";
import { EXAMPLES } from "./examples.js";
import { enhanceSequencePreview } from "./sequence-view.js";
import { EditorWorkspace, type WorkspaceSnapshot } from "./workspace.js";

const NEW_SOURCE: Record<DiagramKind, string> = {
  flowchart: ["flow nuevo {", "", "}", ""].join("\n"),
  sequence: ["sequence nuevo {", "", "}", ""].join("\n"),
};

export function newWorkspace(kind: DiagramKind = "flowchart"): WorkspaceSnapshot {
  return { files: { "nuevo.flo": NEW_SOURCE[kind] }, saved: {}, active: "nuevo.flo", dir: null };
}

export interface AppElements {
  toolbar: HTMLElement;
  explorer: HTMLElement;
  editor: HTMLElement;
  preview: HTMLElement;
  panel: HTMLElement;
}

function reportActionError(action: string, error: unknown): void {
  console.error(`flo: ${action} falló`, error);
  window.alert(`No se pudo completar: ${action}. Revisá la consola para más detalle.`);
}

/** El editor web: un workspace de documentos, el documento activo en el editor y su preview. */
export class App {
  ws: EditorWorkspace;
  readonly view: EditorView;
  private previewState: PreviewState = { lastDiagrams: [] };
  private fileHandle: FileSystemFileHandle | null = null;
  /** El estado de cada documento que dejó el editor, hasta que se reemplace el workspace (#43). */
  private readonly states = new Map<DocumentUri, EditorState>();
  private shown: DocumentUri | null = null;
  private readonly host: EditorHost = {
    workspace: () => this.ws,
    onChange: () => this.refresh(),
  };

  constructor(
    private readonly el: AppElements,
    snapshot: WorkspaceSnapshot
  ) {
    this.ws = new EditorWorkspace(snapshot);
    this.view = createEditor(el.editor);
    createToolbar(
      el.toolbar,
      {
        onNew: (kind) => this.newDocument(kind),
        onOpen: () => void this.run("Abrir", () => this.openFile()),
        onOpenFolder: () => void this.run("Abrir carpeta", () => this.openFolder()),
        onSave: () => void this.run("Guardar", () => this.save()),
        onExportSvg: () =>
          void this.run("Exportar SVG", async () => {
            const svg = this.exportable();
            if (svg) exportSvg(svg);
          }),
        onExportPng: () =>
          void this.run("Exportar PNG", async () => {
            const svg = this.exportable();
            if (svg) await exportPng(svg);
          }),
        onLoadExample: (id) => this.loadExample(id),
        onToggleExpand: () => void document.body.classList.toggle("flo-expanded"),
      },
      EXAMPLES
    );
    this.openDocument(this.ws.active);
  }

  private async run(action: string, task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      reportActionError(action, error);
    }
  }

  /** Reemplaza el workspace entero (abrir carpeta o archivo, nuevo sin carpeta, ejemplo). */
  load(snapshot: WorkspaceSnapshot, fileHandle: FileSystemFileHandle | null = null): void {
    this.ws = new EditorWorkspace(snapshot);
    this.fileHandle = fileHandle;
    this.states.clear();
    this.shown = null;
    this.openDocument(this.ws.active);
  }

  openDocument(uri: DocumentUri): void {
    this.ws.active = uri;
    this.previewState = { lastDiagrams: [] };
    if (this.shown !== null) this.states.set(this.shown, this.view.state);
    this.shown = uri;
    showDocument(this.view, this.host, uri, this.states.get(uri));
    this.refresh();
  }

  /** Todo lo que depende del link, desde un link nuevo; y el borrador. */
  refresh(): void {
    const uri = this.ws.active;
    const result = renderActive(this.ws.link(), uri);
    this.previewState = nextPreviewState(this.previewState, result);
    this.el.preview.innerHTML = previewHtml(this.previewState, result, uri);
    enhanceSequencePreview(this.el.preview);
    // ponytail: sin IndexedDB (modo privado) el editor sigue, solo sin borrador.
    saveDraft(this.ws.snapshot()).catch(() => {});
  }

  private confirmDiscard(): boolean {
    return !this.ws.hasUnsavedChanges() || window.confirm("Hay cambios sin guardar. ¿Descartarlos?");
  }

  /** Con carpeta abierta agrega un archivo al workspace; sin carpeta lo reemplaza. */
  newDocument(kind: DiagramKind): void {
    if (!this.ws.dir) {
      if (this.confirmDiscard()) this.load(newWorkspace(kind));
      return;
    }
    let uri = "nuevo.flo";
    for (let n = 2; this.ws.uris().includes(uri); n++) uri = `nuevo-${n}.flo`;
    this.ws.setSource(uri, NEW_SOURCE[kind]);
    this.openDocument(uri);
  }

  async openFile(): Promise<void> {
    const opened = await openFloFile();
    if (!opened || !this.confirmDiscard()) return;
    const { name, source, handle } = opened;
    this.load({ files: { [name]: source }, saved: { [name]: source }, active: name, dir: null }, handle);
  }

  async openFolder(): Promise<void> {
    const snapshot = await openFolder();
    if (!snapshot) return;
    if (Object.keys(snapshot.files).length === 0) {
      window.alert("La carpeta no tiene archivos .flo ni .md.");
      return;
    }
    if (this.confirmDiscard()) this.load(snapshot);
  }

  /** Decisión #38: con carpeta, todos los modificados y sin validar; sin carpeta, el activo. */
  async save(): Promise<void> {
    // El workspace puede reemplazarse durante los await: se guarda el que había al empezar.
    const ws = this.ws;
    const { dir } = ws;
    if (dir) {
      if (!(await ensureWritable(dir))) throw new Error("sin permiso de escritura en la carpeta");
      for (const uri of ws.uris()) {
        if (!ws.isDirty(uri)) continue;
        await writeWorkspaceFile(dir, uri, ws.source(uri));
        ws.markSaved(uri);
      }
    } else {
      const uri = ws.active;
      const handle = await saveFloFile(ws.source(uri), this.fileHandle, uri);
      if (handle) {
        if (this.ws === ws) this.fileHandle = handle;
        ws.markSaved(uri);
      }
    }
    this.refresh();
  }

  loadExample(id: string): void {
    const example = EXAMPLES.find((candidate) => candidate.id === id);
    if (!example || !this.confirmDiscard()) return;
    const uri = `${id}.flo`;
    this.load({ files: { [uri]: example.source }, saved: {}, active: uri, dir: null });
  }

  /** El SVG que exportan los botones: el primer bloque del preview. */
  private exportable(): string | undefined {
    return this.previewState.lastDiagrams[0]?.svg;
  }
}
```

`packages/web/src/main.ts` (reemplazo completo):

```ts
import { App, newWorkspace, type AppElements } from "./app.js";
import { loadDraft } from "./storage.js";

async function main(): Promise<void> {
  const find = (selector: string) => document.querySelector<HTMLElement>(selector);
  const el = {
    toolbar: find("#toolbar"),
    explorer: find("#explorer"),
    editor: find("#editor-pane"),
    preview: find("#preview-pane"),
    panel: find("#panel"),
  };
  if (Object.values(el).some((element) => element === null)) return;
  const draft = await loadDraft().catch(() => null);
  new App(el as AppElements, draft ?? newWorkspace());
}

void main();
```

`packages/web/index.html`: dentro de `#app`, antes de `#editor-pane`,
agregar

```html
      <aside id="side-pane">
        <nav id="explorer"></nav>
        <div id="panel"></div>
      </aside>
```

y en el `<style>`:

```css
      #side-pane {
        flex: 0 0 240px;
        overflow: auto;
        border-right: 1px solid #d1d5db;
        font-size: 13px;
      }
      #panel:not(:empty) {
        border-top: 1px solid #d1d5db;
        padding: 8px 12px;
      }
      body.flo-expanded #side-pane {
        display: none;
      }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck && pnpm --filter @flo/web build`
Expected: PASS.

- [x] **Step 5: Verificar en el navegador**

Run: `pnpm --filter @flo/web dev`. Con Chrome: "Abrir carpeta" sobre
`examples/` (o una carpeta con dos `.flo` donde uno usa al otro), editar
el catálogo, volver al otro archivo y ver el label nuevo en el preview;
"Guardar" escribe en disco. Recargar la página: el workspace vuelve del
borrador y "Guardar" pide permiso. Anotar en el reporte de la task si
algo de esto no funciona.

- [x] **Step 6: Commit**

```bash
git add packages/web/src/app.ts packages/web/src/app.test.ts packages/web/src/editor.ts packages/web/src/editor.test.ts packages/web/src/preview.ts packages/web/src/preview.test.ts packages/web/src/toolbar.ts packages/web/src/toolbar.test.ts packages/web/src/main.ts packages/web/index.html
git commit -m "feat(web): el editor trabaja sobre un workspace de varios documentos"
```

---

### Task 7: Panel de entidad, clicks del preview y bloque seleccionado

**Files:**
- Create: `packages/web/src/entity-panel.ts`, `packages/web/src/entity-panel.test.ts`
- Modify: `packages/web/src/app.ts`, `packages/web/src/app.test.ts`
- Modify: `packages/web/src/sequence-view.ts`, `packages/web/src/sequence-view.test.ts`
- Modify: `packages/web/index.html` (estilos)

**Interfaces:**
- Consumes: `App` (task 6), `LinkResult`, `Location`, `BlockId`, `EntityId`, `blockId`, `escapeXml` (`@flo/core`), `offsetAt` (task 4).
- Produces:
  - `entity-panel.ts`: `blockLabel(link: LinkResult, id: BlockId): string`, `flowListHtml(link: LinkResult, blocks: BlockId[]): string`, `entityPanelHtml(link: LinkResult, id: EntityId): string`.
  - `App`: `selectedBlock: BlockId | null`; `selectEntity(id: EntityId): void`; `selectBlock(id: BlockId, entity?: EntityId | null): void`; `reveal(location: Location): void`; privados `panel: PanelState` (`type PanelState = { kind: "entity"; id: EntityId } | null`), `highlight: EntityId | null`, `renderPanel()`, `markSelection()`. `exportable()` pasa a devolver el bloque seleccionado si está en el preview.
  - Función local de `app.ts`: `byData(root: ParentNode, selector: string, attribute: string, value: string): Element[]`.

Semántica (decisiones #41, #42): click en un nodo o participante del
preview (también en el header fijo de una `sequence`) abre el panel de esa
entidad si resolvió; un placeholder `flo-unresolved`, una arista o su
etiqueta no hacen nada. Click en el título de un bloque lo selecciona. El
panel muestra label, id, `type` y tags, el lugar de la declaración
(botón que la abre en el editor con el id seleccionado) y "Aparece en N
flujos" con un botón por bloque (`flowsUsing`, título o nombre + uri).
Click en un flujo: abre su documento, selecciona el bloque (queda
marcado y es el que exportan SVG/PNG, cierra #11) y resalta el nodo de la
entidad. El panel se redibuja en cada `refresh()` desde el link nuevo; si
la entidad dejó de existir, se cierra.

- [x] **Step 1: Write the failing tests**

`packages/web/src/entity-panel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Workspace } from "@flo/core";
import { blockLabel, entityPanelHtml } from "./entity-panel.js";

function linked(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

const link = linked({
  "catalog.flo": "entity api [API <Gateway>] type: service, tags: http publico\nentity db\n",
  "login.flo": 'use "./catalog.flo"\nflow login "Inicio" {\n  api -> db\n}\nsequence detalle {\n  api -> db : q\n}\n',
});

describe("entity panel", () => {
  it("shows label, id, type, tags, definition and the flows that use the entity", () => {
    const html = entityPanelHtml(link, "api");
    expect(html).toContain("API &lt;Gateway&gt;");
    expect(html).toContain("<code>api</code> · service #http #publico");
    expect(html).toContain("catalog.flo:1");
    expect(html).toContain("Aparece en 2 flujos");
    expect(html).toContain('data-flo-block="login.flo#login"');
    expect(html).toContain('data-flo-block="login.flo#detalle"');
  });

  it("uses the singular for one flow and labels blocks by title or name", () => {
    const one = linked({ "a.flo": "entity a\nflow f {\n  a -> a\n}\n" });
    expect(entityPanelHtml(one, "a")).toContain("Aparece en 1 flujo<");
    expect(blockLabel(link, "login.flo#login")).toBe("Inicio · login.flo");
    expect(blockLabel(link, "login.flo#detalle")).toBe("detalle · login.flo");
  });
});
```

En `packages/web/src/sequence-view.test.ts`:

```ts
  it("copies the participant's data-flo-* attributes onto the sticky clone", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<svg width="320" height="170">' +
      '<g class="flo-unresolved" data-flo-entity="api" data-flo-block="a.flo#s"><g class="flo-seq-header-box"><rect width="140" height="50" /></g><line /></g>' +
      "</svg>";
    enhanceSequencePreview(container);
    const clone = container.querySelector(".flo-seq-sticky .flo-seq-header-box")!;
    expect(clone.getAttribute("data-flo-entity")).toBe("api");
    expect(clone.getAttribute("data-flo-block")).toBe("a.flo#s");
    expect(clone.classList.contains("flo-unresolved")).toBe(true);
  });
```

En `packages/web/src/app.test.ts`, un `describe` nuevo:

```ts
function click(element: Element): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("App navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens the entity panel from a node in the preview", () => {
    const el = elements();
    new App(el, FILES);
    click(el.preview.querySelector('[data-flo-entity="api"] text')!);
    expect(el.panel.innerHTML).toContain("API Gateway");
    expect(el.panel.innerHTML).toContain("Aparece en 1 flujo");
  });

  it("ignores unresolved placeholders", () => {
    const el = elements();
    new App(el, { ...FILES, files: { ...FILES.files, "login.flo": "flow f {\n  x -> y\n}\n" } });
    click(el.preview.querySelector('[data-flo-entity="x"]')!);
    expect(el.panel.innerHTML).toBe("");
  });

  it("jumps from a flow in the panel to its block, selecting it and highlighting the node", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.openDocument("catalog.flo");
    app.selectEntity("db");
    click(el.panel.querySelector('[data-flo-block="login.flo#login"]')!);
    expect(app.ws.active).toBe("login.flo");
    expect(app.selectedBlock).toBe("login.flo#login");
    const section = el.preview.querySelector('section[data-flo-block="login.flo#login"]')!;
    expect(section.classList.contains("flo-block-selected")).toBe(true);
    expect(section.querySelector('[data-flo-entity="db"]')!.classList.contains("flo-selected")).toBe(true);
  });

  it("selects a block by its title", () => {
    const el = elements();
    const app = new App(el, FILES);
    click(el.preview.querySelector('section[data-flo-block="login.flo#vacio"] .flo-block-title')!);
    expect(app.selectedBlock).toBe("login.flo#vacio");
  });

  it("reveals the definition in the editor", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.selectEntity("db");
    click(el.panel.querySelector("[data-flo-definition]")!);
    expect(app.ws.active).toBe("catalog.flo");
    const { from, to } = app.view.state.selection.main;
    expect(app.view.state.sliceDoc(from, to)).toBe("db");
  });

  it("closes the panel when the entity disappears", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.selectEntity("db");
    app.ws.setSource("catalog.flo", "entity api\n");
    app.refresh();
    expect(el.panel.innerHTML).toBe("");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/entity-panel.test.ts src/sequence-view.test.ts src/app.test.ts`
Expected: FAIL — `./entity-panel.js` no existe; `selectEntity` no existe; el clon no lleva atributos.

- [x] **Step 3: Implement**

`packages/web/src/entity-panel.ts`:

```ts
import { escapeXml, type BlockId, type EntityId, type LinkResult } from "@flo/core";

/** "<título o nombre> · <uri>" de un bloque del workspace. */
export function blockLabel(link: LinkResult, id: BlockId): string {
  const hash = id.lastIndexOf("#");
  const uri = id.slice(0, hash);
  const name = id.slice(hash + 1);
  const block = link.documents.get(uri)?.document.blocks.find((candidate) => candidate.name === name);
  return `${block?.title ?? name} · ${uri}`;
}

export function flowListHtml(link: LinkResult, blocks: BlockId[]): string {
  const items = blocks.map(
    (id) =>
      `<li><button type="button" class="flo-tree-item" data-flo-block="${escapeXml(id)}">${escapeXml(blockLabel(link, id))}</button></li>`
  );
  return `<ul class="flo-tree">${items.join("")}</ul>`;
}

const flows = (n: number) => `${n} ${n === 1 ? "flujo" : "flujos"}`;

/** Panel de una entidad que existe en `link.entities` (spec §8). */
export function entityPanelHtml(link: LinkResult, id: EntityId): string {
  const entity = link.entities.get(id)!;
  const blocks = link.xref.flowsUsing(id);
  const meta = [entity.type, ...entity.tags.map((tag) => `#${tag}`)].filter(Boolean).join(" ");
  return [
    `<h3 class="flo-panel-title">${escapeXml(entity.label)}</h3>`,
    `<p class="flo-panel-meta"><code>${escapeXml(entity.id)}</code>${meta ? ` · ${escapeXml(meta)}` : ""}</p>`,
    `<p class="flo-panel-actions"><button type="button" data-flo-definition>${escapeXml(entity.uri)}:${entity.nameRange.start.line}</button></p>`,
    `<h4>Aparece en ${flows(blocks.length)}</h4>`,
    flowListHtml(link, blocks),
  ].join("");
}
```

`packages/web/src/sequence-view.ts`, en `enhanceOne`, reemplazar la línea
`headerBoxes.forEach((box) => headerSvg.appendChild(box.cloneNode(true)));`
por:

```ts
  // Los data-flo-* están en el <g> del participante, no en la caja: el clon
  // los copia para que un click en el header fijo encuentre su entidad.
  headerBoxes.forEach((box) => {
    const clone = box.cloneNode(true) as Element;
    const participant = box.parentElement;
    for (const attribute of Array.from(participant?.attributes ?? [])) {
      if (attribute.name.startsWith("data-flo-")) clone.setAttribute(attribute.name, attribute.value);
    }
    if (participant?.classList.contains("flo-unresolved")) clone.classList.add("flo-unresolved");
    headerSvg.appendChild(clone);
  });
```

`packages/web/src/app.ts`:

1. Imports: sumar `blockId`, `type BlockId`, `type EntityId`,
   `type Location` a `@flo/core`; `import { entityPanelHtml } from "./entity-panel.js";`
   e `import { offsetAt } from "./text-edits.js";`.
2. Arriba de la clase:

```ts
type PanelState = { kind: "entity"; id: EntityId } | null;

function byData(root: ParentNode, selector: string, attribute: string, value: string): Element[] {
  return Array.from(root.querySelectorAll(selector)).filter((element) => element.getAttribute(attribute) === value);
}
```

3. Campos: `selectedBlock: BlockId | null = null;`,
   `private panel: PanelState = null;`, `private highlight: EntityId | null = null;`,
   y `load()` los limpia junto con `states`/`shown` (un workspace nuevo
   empieza sin selección ni panel):

```ts
    this.selectedBlock = null;
    this.highlight = null;
    this.panel = null;
```
4. Al final del constructor, antes de `this.openDocument(this.ws.active);`:

```ts
    el.preview.addEventListener("click", (event) => this.onPreviewClick(event.target as Element));
    el.panel.addEventListener("click", (event) => this.onPanelClick(event.target as Element));
```

5. `refresh()`: después de `enhanceSequencePreview(this.el.preview);`
   agregar `this.markSelection();` y `this.renderPanel();`.
6. Métodos nuevos:

```ts
  private onPreviewClick(target: Element): void {
    const section = target.closest("section[data-flo-block]");
    if (section && target.closest(".flo-block-title")) {
      this.selectBlock(section.getAttribute("data-flo-block")!);
      return;
    }
    const node = target.closest("[data-flo-entity]");
    if (node && !node.classList.contains("flo-unresolved")) this.selectEntity(node.getAttribute("data-flo-entity")!);
  }

  private onPanelClick(target: Element): void {
    const button = target.closest("button");
    const panel = this.panel;
    if (!button || !panel) return;
    const block = button.getAttribute("data-flo-block");
    if (block !== null) {
      this.selectBlock(block, panel.kind === "entity" ? panel.id : null);
    } else if (panel.kind === "entity" && button.hasAttribute("data-flo-definition")) {
      const location = this.ws.link().xref.definitionOf(panel.id);
      if (location) this.reveal(location);
    }
  }

  selectEntity(id: EntityId): void {
    this.panel = { kind: "entity", id };
    this.renderPanel();
  }

  private renderPanel(): void {
    const link = this.ws.link();
    if (this.panel?.kind === "entity" && !link.entities.has(this.panel.id)) this.panel = null;
    this.el.panel.innerHTML = this.panel ? entityPanelHtml(link, this.panel.id) : "";
  }

  /** Abre el documento del bloque y lo selecciona (es el que se exporta); con `entity`, resalta su nodo. */
  selectBlock(id: BlockId, entity: EntityId | null = null): void {
    this.selectedBlock = id;
    this.highlight = entity;
    const uri = id.slice(0, id.lastIndexOf("#"));
    if (uri === this.ws.active) this.refresh();
    else this.openDocument(uri);
    byData(this.el.preview, "section[data-flo-block]", "data-flo-block", id)[0]?.scrollIntoView?.({ block: "nearest" });
  }

  private markSelection(): void {
    if (!this.selectedBlock) return;
    const section = byData(this.el.preview, "section[data-flo-block]", "data-flo-block", this.selectedBlock)[0];
    if (!section) return;
    section.classList.add("flo-block-selected");
    if (this.highlight) {
      for (const node of byData(section, "[data-flo-entity]", "data-flo-entity", this.highlight)) node.classList.add("flo-selected");
    }
  }

  /** Abre el documento y selecciona el rango en el editor. */
  reveal(location: Location): void {
    if (location.uri !== this.ws.active) this.openDocument(location.uri);
    const source = this.ws.source(location.uri);
    this.view.dispatch({
      selection: { anchor: offsetAt(source, location.range.start), head: offsetAt(source, location.range.end) },
      scrollIntoView: true,
    });
    this.view.focus();
  }
```

7. `exportable()` (reemplazo):

```ts
  /** El SVG que exportan los botones: el bloque seleccionado si está en el preview; si no, el primero (#41). */
  private exportable(): string | undefined {
    const diagrams = this.previewState.lastDiagrams;
    const selected = diagrams.find((diagram) => blockId(this.ws.active, diagram.name) === this.selectedBlock);
    return (selected ?? diagrams[0])?.svg;
  }
```

`packages/web/index.html`, estilos:

```css
      #preview-pane [data-flo-entity]:not(.flo-unresolved),
      .flo-block-title {
        cursor: pointer;
      }
      .flo-block-selected > .flo-block-title {
        color: #1d4ed8;
      }
      g.flo-selected > rect,
      g.flo-selected > polygon,
      g.flo-selected > .flo-seq-header-box > rect,
      .flo-seq-header-box.flo-selected > rect {
        stroke: #2563eb;
        stroke-width: 4px;
      }
      .flo-tree {
        list-style: none;
        margin: 0;
        padding: 0 0 0 8px;
      }
      .flo-tree-item {
        border: 0;
        background: none;
        padding: 2px 4px;
        cursor: pointer;
        font: inherit;
        text-align: left;
      }
      .flo-tree-item:hover,
      .flo-tree-item.flo-active,
      .flo-tree-item.flo-selected {
        background: #eff6ff;
      }
      .flo-panel-title {
        margin: 0 0 4px;
        font-size: 14px;
      }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/entity-panel.ts packages/web/src/entity-panel.test.ts packages/web/src/app.ts packages/web/src/app.test.ts packages/web/src/sequence-view.ts packages/web/src/sequence-view.test.ts packages/web/index.html
git commit -m "feat(web): panel de entidad, clicks del preview y bloque seleccionado"
```

---

### Task 8: Explorador de catálogo y archivos

**Files:**
- Create: `packages/web/src/explorer.ts`, `packages/web/src/explorer.test.ts`
- Modify: `packages/web/src/app.ts`, `packages/web/src/app.test.ts`

**Interfaces:**
- Consumes: `EditorWorkspace` (task 4), `App.openDocument`, `App.selectBlock`, `App.selectEntity`, `App.selectedBlock` (tasks 6–7), `blockId`, `escapeXml`.
- Produces:
  - `interface ExplorerFilter { type: string | null; tag: string | null }`
  - `interface ExplorerActions { onOpenDocument(uri: DocumentUri): void; onSelectBlock(id: BlockId): void; onSelectEntity(id: EntityId): void; onFilter(filter: ExplorerFilter): void }`
  - `explorerHtml(ws: EditorWorkspace, filter: ExplorerFilter, selectedBlock: BlockId | null): string`
  - `bindExplorer(container: HTMLElement, actions: ExplorerActions): void`
  - `App`: privado `filter: ExplorerFilter`, `renderExplorer()`.

Semántica (spec §8, decisiones #6, #41): dos árboles. **Catálogo**: las
entidades de `link.entities` en orden del catálogo global (#24), label e
id, filtrables con dos `<select>`: un `type` y un tag, con los valores
presentes (en orden de primera aparición); un filtro cuyo valor ya no
existe se ignora. Los `type_tags` de `.md` no entran (K4). **Archivos**:
cada uri del workspace en orden, el activo marcado, `●` si está
modificado, y debajo sus bloques (título o nombre), el seleccionado
marcado. Click en un archivo lo abre; en un bloque, `selectBlock`; en
una entidad, el panel.

- [x] **Step 1: Write the failing tests**

`packages/web/src/explorer.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { bindExplorer, explorerHtml, type ExplorerActions } from "./explorer.js";
import { EditorWorkspace } from "./workspace.js";

const ws = () =>
  new EditorWorkspace({
    files: {
      "catalog.flo": "entity api [API] type: service, tags: http\nentity db type: store\nentity web tags: http ui\n",
      "login.flo": 'use "./catalog.flo"\nflow login "Inicio <1>" {\n  api -> db\n}\nsequence s {\n  web -> api : x\n}\n',
    },
    saved: { "catalog.flo": "entity api\n" },
    active: "login.flo",
    dir: null,
  });

const container = (html: string) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
};

const entities = (html: string) =>
  Array.from(container(html).querySelectorAll("[data-flo-entity]")).map((e) => e.getAttribute("data-flo-entity"));

describe("explorerHtml", () => {
  it("lists the catalog in order and every file with its blocks", () => {
    const html = explorerHtml(ws(), { type: null, tag: null }, "login.flo#s");
    expect(entities(html)).toEqual(["api", "db", "web"]);
    const div = container(html);
    expect(Array.from(div.querySelectorAll("[data-flo-open]")).map((e) => e.getAttribute("data-flo-open"))).toEqual([
      "catalog.flo",
      "login.flo",
    ]);
    expect(html).toContain("Inicio &lt;1&gt;");
    expect(div.querySelector('[data-flo-open="login.flo"]')!.classList.contains("flo-active")).toBe(true);
    expect(div.querySelector('[data-flo-block="login.flo#s"]')!.classList.contains("flo-selected")).toBe(true);
    expect(div.querySelector('[data-flo-open="catalog.flo"] .flo-dirty')).not.toBeNull();
  });

  it("filters the catalog by type and by tag", () => {
    expect(entities(explorerHtml(ws(), { type: "service", tag: null }, null))).toEqual(["api"]);
    expect(entities(explorerHtml(ws(), { type: null, tag: "http" }, null))).toEqual(["api", "web"]);
    expect(entities(explorerHtml(ws(), { type: "store", tag: "http" }, null))).toEqual([]);
  });

  it("offers the types and tags present, and ignores a filter value that no longer exists", () => {
    const div = container(explorerHtml(ws(), { type: "borrado", tag: null }, null));
    const values = (name: string) =>
      Array.from(div.querySelectorAll(`select[data-flo-filter="${name}"] option`)).map((o) => (o as HTMLOptionElement).value);
    expect(values("type")).toEqual(["", "service", "store"]);
    expect(values("tag")).toEqual(["", "http", "ui"]);
    expect(entities(div.innerHTML)).toEqual(["api", "db", "web"]);
  });
});

describe("bindExplorer", () => {
  it("routes clicks and filter changes to the actions", () => {
    const div = container(explorerHtml(ws(), { type: null, tag: null }, null));
    const actions: ExplorerActions = {
      onOpenDocument: vi.fn(),
      onSelectBlock: vi.fn(),
      onSelectEntity: vi.fn(),
      onFilter: vi.fn(),
    };
    bindExplorer(div, actions);
    (div.querySelector('[data-flo-open="catalog.flo"] .flo-dirty') as HTMLElement).click();
    (div.querySelector('[data-flo-block="login.flo#login"]') as HTMLElement).click();
    (div.querySelector('[data-flo-entity="db"]') as HTMLElement).click();
    const type = div.querySelector<HTMLSelectElement>('select[data-flo-filter="type"]')!;
    type.value = "store";
    type.dispatchEvent(new Event("change", { bubbles: true }));
    expect(actions.onOpenDocument).toHaveBeenCalledWith("catalog.flo");
    expect(actions.onSelectBlock).toHaveBeenCalledWith("login.flo#login");
    expect(actions.onSelectEntity).toHaveBeenCalledWith("db");
    expect(actions.onFilter).toHaveBeenCalledWith({ type: "store", tag: null });
  });
});
```

En `packages/web/src/app.test.ts`, dentro de `describe("App navigation")`:

```ts
  it("keeps the explorer in sync with the workspace", () => {
    const el = elements();
    const app = new App(el, FILES);
    expect(el.explorer.querySelector('[data-flo-open="login.flo"]')!.classList.contains("flo-active")).toBe(true);
    click(el.explorer.querySelector('[data-flo-open="catalog.flo"]')!);
    expect(app.ws.active).toBe("catalog.flo");
    app.view.dispatch({ changes: { from: 0, insert: "entity nuevo\n" } });
    vi.advanceTimersByTime(200);
    expect(el.explorer.querySelector('[data-flo-entity="nuevo"]')).not.toBeNull();
    expect(el.explorer.querySelector('[data-flo-open="catalog.flo"] .flo-dirty')).not.toBeNull();
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/explorer.test.ts src/app.test.ts`
Expected: FAIL — `./explorer.js` no existe.

- [x] **Step 3: Implement**

`packages/web/src/explorer.ts`:

```ts
import { blockId, escapeXml, type BlockId, type DocumentUri, type EntityId } from "@flo/core";
import type { EditorWorkspace } from "./workspace.js";

export interface ExplorerFilter {
  type: string | null;
  tag: string | null;
}

export interface ExplorerActions {
  onOpenDocument(uri: DocumentUri): void;
  onSelectBlock(id: BlockId): void;
  onSelectEntity(id: EntityId): void;
  onFilter(filter: ExplorerFilter): void;
}

function selectHtml(name: string, values: string[], selected: string | null, all: string): string {
  const options = values.map(
    (value) => `<option value="${escapeXml(value)}"${value === selected ? " selected" : ""}>${escapeXml(value)}</option>`
  );
  return `<select data-flo-filter="${name}"><option value="">${all}</option>${options.join("")}</select>`;
}

const item = (attribute: string, value: string, label: string, extraClass = "") =>
  `<button type="button" class="flo-tree-item${extraClass}" ${attribute}="${escapeXml(value)}">${label}</button>`;

/** Catálogo filtrable por type y tag (#6) y archivos con sus bloques (spec §8). */
export function explorerHtml(ws: EditorWorkspace, filter: ExplorerFilter, selectedBlock: BlockId | null): string {
  const link = ws.link();
  const entities = [...link.entities.values()];
  const types = [...new Set(entities.flatMap((entity) => (entity.type ? [entity.type] : [])))];
  const tags = [...new Set(entities.flatMap((entity) => entity.tags))];
  // Un filtro cuyo valor ya no existe (se borró al editar) no filtra.
  const type = filter.type !== null && types.includes(filter.type) ? filter.type : null;
  const tag = filter.tag !== null && tags.includes(filter.tag) ? filter.tag : null;

  const catalog = entities
    .filter((entity) => (type === null || entity.type === type) && (tag === null || entity.tags.includes(tag)))
    .map((entity) => `<li>${item("data-flo-entity", entity.id, `${escapeXml(entity.label)} <small>${escapeXml(entity.id)}</small>`)}</li>`)
    .join("");

  const files = ws
    .uris()
    .map((uri) => {
      const blocks = (link.documents.get(uri)?.document.blocks ?? []).map((block) => {
        const id = blockId(uri, block.name);
        return `<li>${item("data-flo-block", id, escapeXml(block.title ?? block.name), id === selectedBlock ? " flo-selected" : "")}</li>`;
      });
      const dirty = ws.isDirty(uri) ? ' <span class="flo-dirty" title="Sin guardar">●</span>' : "";
      const file = item("data-flo-open", uri, `${escapeXml(uri)}${dirty}`, uri === ws.active ? " flo-active" : "");
      return `<li>${file}${blocks.length > 0 ? `<ul class="flo-tree">${blocks.join("")}</ul>` : ""}</li>`;
    })
    .join("");

  return [
    '<section class="flo-explorer-section"><h3>Catálogo</h3>',
    `<div class="flo-filters">${selectHtml("type", types, type, "Todos los tipos")}${selectHtml("tag", tags, tag, "Todos los tags")}</div>`,
    `<ul class="flo-tree">${catalog || '<li class="flo-empty">Sin entidades</li>'}</ul></section>`,
    `<section class="flo-explorer-section"><h3>Archivos</h3><ul class="flo-tree">${files}</ul></section>`,
  ].join("");
}

/** Delegación: el HTML se reemplaza en cada refresh, los listeners quedan en el contenedor. */
export function bindExplorer(container: HTMLElement, actions: ExplorerActions): void {
  container.addEventListener("click", (event) => {
    const button = (event.target as Element).closest("button");
    if (!button) return;
    const open = button.getAttribute("data-flo-open");
    const block = button.getAttribute("data-flo-block");
    const entity = button.getAttribute("data-flo-entity");
    if (open !== null) actions.onOpenDocument(open);
    else if (block !== null) actions.onSelectBlock(block);
    else if (entity !== null) actions.onSelectEntity(entity);
  });
  container.addEventListener("change", () => {
    const value = (name: string) =>
      container.querySelector<HTMLSelectElement>(`select[data-flo-filter="${name}"]`)?.value || null;
    actions.onFilter({ type: value("type"), tag: value("tag") });
  });
}
```

`packages/web/src/app.ts`:

1. `import { bindExplorer, explorerHtml, type ExplorerFilter } from "./explorer.js";`
2. Campo `private filter: ExplorerFilter = { type: null, tag: null };`
3. En el constructor, junto a los listeners de la task 7:

```ts
    bindExplorer(el.explorer, {
      onOpenDocument: (uri) => this.openDocument(uri),
      onSelectBlock: (id) => this.selectBlock(id),
      onSelectEntity: (id) => this.selectEntity(id),
      onFilter: (filter) => {
        this.filter = filter;
        this.renderExplorer();
      },
    });
```

4. `refresh()`: agregar `this.renderExplorer();` después de `this.renderPanel();`.
5. Método:

```ts
  private renderExplorer(): void {
    this.el.explorer.innerHTML = explorerHtml(this.ws, this.filter, this.selectedBlock);
  }
```

`packages/web/index.html`, estilos:

```css
      .flo-explorer-section {
        padding: 8px 12px;
      }
      .flo-explorer-section h3 {
        margin: 0 0 6px;
        font-size: 12px;
        text-transform: uppercase;
        color: #6b7280;
      }
      .flo-filters {
        display: flex;
        gap: 4px;
        margin-bottom: 6px;
      }
      .flo-filters select {
        flex: 1 1 0;
        min-width: 0;
      }
      .flo-dirty {
        color: #b45309;
      }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/explorer.ts packages/web/src/explorer.test.ts packages/web/src/app.ts packages/web/src/app.test.ts packages/web/index.html
git commit -m "feat(web): explorador de catálogo filtrable y de archivos con sus bloques"
```

---

### Task 9: Ir a definición y renombrar

**Files:**
- Modify: `packages/web/src/editor.ts`, `packages/web/src/editor.test.ts`
- Modify: `packages/web/src/app.ts`, `packages/web/src/app.test.ts`
- Modify: `packages/web/src/entity-panel.ts`, `packages/web/src/entity-panel.test.ts`

**Interfaces:**
- Consumes: `entityAt`, `renameEntity` (task 1); `positionAt`, `toChanges`, `applyTextEdits` (task 4); `App.reveal`, `App.panel` (task 7).
- Produces:
  - `EditorHost` suma `onGoToDefinition(position: Position): void` y `onRename(position: Position): void`.
  - `App`: `goToDefinition(position: Position): void`, `renameAt(position: Position): void`, `rename(id: EntityId): void`.
  - El panel de entidad suma `<button type="button" data-flo-rename>Renombrar</button>`.

Semántica (spec §8, decisión #39): **F12** o **Ctrl/Cmd+click** sobre un
nombre del editor (declaración, referencia resuelta, target de relación)
abre la declaración ganadora con el id seleccionado, en el archivo que
sea; sobre otra cosa no hace nada. **F2** en el editor o "Renombrar" en el
panel piden el id nuevo (`window.prompt`, con el actual de valor); un
error de `renameEntity` se muestra con `window.alert` y no cambia nada.
Las ediciones del documento activo van por el editor en un solo
`dispatch` (quedan en su historial de deshacer); las de los demás van al
workspace, que los marca modificados. Si el panel mostraba la entidad,
pasa a mostrar el id nuevo.

- [x] **Step 1: Write the failing tests**

En `packages/web/src/editor.test.ts`, `host` suma
`onGoToDefinition: vi.fn()` y `onRename: vi.fn()` (y su tipo), y:

```ts
import { runScopeHandlers } from "@codemirror/view";

  it("binds F12 to go to definition and F2 to rename at the cursor", () => {
    const view = createEditor(document.createElement("div"));
    showDocument(view, host, "a.flo");
    view.dispatch({ selection: { anchor: 20 } }); // línea 3, columna 3: la primera 'a' de 'a -> a'
    runScopeHandlers(view, new KeyboardEvent("keydown", { key: "F12" }), "editor");
    runScopeHandlers(view, new KeyboardEvent("keydown", { key: "F2" }), "editor");
    expect(host.onGoToDefinition).toHaveBeenCalledWith({ line: 3, column: 3 });
    expect(host.onRename).toHaveBeenCalledWith({ line: 3, column: 3 });
    view.destroy();
  });
```

En `packages/web/src/entity-panel.test.ts`, en el primer test:
`expect(html).toContain("data-flo-rename");`.

En `packages/web/src/app.test.ts`, dentro de `describe("App navigation")`:

```ts
  it("goes to the definition in another file", () => {
    const app = new App(elements(), FILES);
    app.goToDefinition({ line: 3, column: 10 }); // 'db' en 'api -> db'
    expect(app.ws.active).toBe("catalog.flo");
    const { from, to } = app.view.state.selection.main;
    expect(app.view.state.sliceDoc(from, to)).toBe("db");
  });

  it("does nothing on text that names no entity", () => {
    const app = new App(elements(), FILES);
    app.goToDefinition({ line: 2, column: 1 });
    expect(app.ws.active).toBe("login.flo");
  });

  it("renames across documents: the active one through the editor, the rest in the workspace", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.selectEntity("api");
    vi.spyOn(window, "prompt").mockReturnValue("gateway");
    click(el.panel.querySelector("[data-flo-rename]")!);
    expect(app.view.state.doc.toString()).toContain("  gateway -> db");
    expect(app.ws.source("login.flo")).toContain("  gateway -> db");
    expect(app.ws.source("catalog.flo")).toBe("entity gateway [API Gateway]\nentity db [Base]\n");
    expect(app.ws.isDirty("catalog.flo")).toBe(true);
    expect(el.panel.innerHTML).toContain("<code>gateway</code>");
  });

  it("shows the rename error and changes nothing", () => {
    const app = new App(elements(), FILES);
    vi.spyOn(window, "prompt").mockReturnValue("db");
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    app.rename("api");
    expect(alert).toHaveBeenCalledWith("ya existe una entidad 'db'");
    expect(app.ws.hasUnsavedChanges()).toBe(false);
  });

  it("renames the entity under the cursor", () => {
    const app = new App(elements(), FILES);
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    app.renameAt({ line: 3, column: 4 });
    expect(prompt).toHaveBeenCalledWith("Nuevo id para 'api':", "api");
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/editor.test.ts src/entity-panel.test.ts src/app.test.ts`
Expected: FAIL — `goToDefinition`, `rename` no existen; F12/F2 no están ligados.

- [x] **Step 3: Implement**

`packages/web/src/editor.ts`:

1. Imports: `import { EditorView, keymap } from "@codemirror/view";`,
   `import type { DocumentUri, Position } from "@flo/core";`,
   `import { positionAt } from "./text-edits.js";`.
2. `EditorHost` suma:

```ts
  /** F12 o Ctrl/Cmd+click. */
  onGoToDefinition(position: Position): void;
  /** F2. */
  onRename(position: Position): void;
```

3. Función y extensiones (agregar al array de `documentExtensions`, al
   principio):

```ts
function cursor(view: EditorView): Position {
  return positionAt(view.state.doc.toString(), view.state.selection.main.head);
}
```

```ts
    keymap.of([
      { key: "F12", run: (view) => (host.onGoToDefinition(cursor(view)), true) },
      { key: "F2", run: (view) => (host.onRename(cursor(view)), true) },
    ]),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        // Solo el botón principal: en macOS Ctrl+click es el menú contextual.
        if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return false;
        const offset = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (offset === null) return false;
        event.preventDefault();
        host.onGoToDefinition(positionAt(view.state.doc.toString(), offset));
        return true;
      },
    }),
```

`packages/web/src/entity-panel.ts`: en `entityPanelHtml`, la línea de
`flo-panel-actions` pasa a:

```ts
    `<p class="flo-panel-actions"><button type="button" data-flo-definition>${escapeXml(entity.uri)}:${entity.nameRange.start.line}</button> <button type="button" data-flo-rename>Renombrar</button></p>`,
```

`packages/web/src/app.ts`:

1. Imports: sumar `entityAt`, `renameEntity`, `type Position` a
   `@flo/core`; `applyTextEdits` y `toChanges` a `./text-edits.js`.
2. `host` suma:

```ts
    onGoToDefinition: (position) => this.goToDefinition(position),
    onRename: (position) => this.renameAt(position),
```

3. `onPanelClick`: después de la rama de `data-flo-definition`:

```ts
    } else if (panel.kind === "entity" && button.hasAttribute("data-flo-rename")) {
      this.rename(panel.id);
    }
```

4. Métodos:

```ts
  private entityAtCursor(position: Position): EntityId | null {
    const document = this.ws.link().documents.get(this.ws.active)?.document;
    return document ? entityAt(document, position) : null;
  }

  goToDefinition(position: Position): void {
    const id = this.entityAtCursor(position);
    const location = id === null ? null : this.ws.link().xref.definitionOf(id);
    if (location) this.reveal(location);
  }

  renameAt(position: Position): void {
    const id = this.entityAtCursor(position);
    if (id !== null) this.rename(id);
  }

  /** Decisión #39: el activo por el editor (queda en su historial), los demás en el workspace. */
  rename(id: EntityId): void {
    const answer = window.prompt(`Nuevo id para '${id}':`, id);
    if (answer === null) return;
    const newId = answer.trim();
    const result = renameEntity(this.ws.link(), id, newId);
    if ("error" in result) {
      window.alert(result.error);
      return;
    }
    for (const [uri, edits] of result.edits) {
      if (uri === this.ws.active) this.view.dispatch({ changes: toChanges(this.view.state.doc.toString(), edits) });
      else this.ws.setSource(uri, applyTextEdits(this.ws.source(uri), edits));
    }
    if (this.panel?.kind === "entity" && this.panel.id === id) this.panel = { kind: "entity", id: newId };
    this.refresh();
  }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck`
Expected: PASS.

- [x] **Step 5: Verificar en el navegador**

`pnpm --filter @flo/web dev`: Cmd/Ctrl+click sobre una referencia salta a
la declaración en otro archivo; F2 renombra y Cmd/Ctrl+Z en el archivo
activo deshace su parte. Anotar en el reporte si no funciona.

- [x] **Step 6: Commit**

```bash
git add packages/web/src/editor.ts packages/web/src/editor.test.ts packages/web/src/app.ts packages/web/src/app.test.ts packages/web/src/entity-panel.ts packages/web/src/entity-panel.test.ts
git commit -m "feat(web): ir a definición y renombrar entre documentos"
```

---

### Task 10: Vista mapa

**Files:**
- Create: `packages/web/src/map-view.ts`, `packages/web/src/map-view.test.ts`
- Modify: `packages/web/src/entity-panel.ts`, `packages/web/src/entity-panel.test.ts`
- Modify: `packages/web/src/toolbar.ts`, `packages/web/src/toolbar.test.ts`
- Modify: `packages/web/src/app.ts`, `packages/web/src/app.test.ts`
- Modify: `packages/web/index.html` (estilos)

**Interfaces:**
- Consumes: `renderMap`, `RenderedMap`, `query`, `QueryEdge` (tasks 2, K2); `flowListHtml` (task 7); `App.selectBlock`, `App.selectEntity`, `App.panel` (task 7).
- Produces:
  - `map-view.ts`: `mapHtml(map: RenderedMap): string`, `addEdgeHitAreas(container: ParentNode): void`.
  - `entity-panel.ts`: `edgePanelHtml(link: LinkResult, edge: QueryEdge): string`.
  - `toolbar.ts`: `ToolbarActions.onToggleMap(): void`, botón `#flo-toggle-map` ("Mapa").
  - `App`: `toggleMap(): void`; privado `mapMode: boolean`; `PanelState` suma `{ kind: "edge"; from: EntityId; to: EntityId }`.

Semántica (spec §8, decisión #40): "Mapa" alterna el preview entre el
documento activo y el mapa agregado (`renderMap` del workspace entero).
Sobre cada arista del mapa va una franja invisible de 12 px para poder
clickearla. Click en una arista: panel con "origen → destino" y "En N
flujos" (los `blocks` de la arista); click en uno sale del mapa y abre ese
bloque seleccionado. Click en un nodo del mapa: panel
de la entidad, como en el preview. Sin aristas de flujo: "Ningún flujo
conecta entidades todavía". Con el mapa visible, Exportar SVG/PNG exporta
el mapa.

- [x] **Step 1: Write the failing tests**

`packages/web/src/map-view.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Workspace, renderMap } from "@flo/core";
import { addEdgeHitAreas, mapHtml } from "./map-view.js";

function mapOf(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return renderMap(workspace.link());
}

describe("map view", () => {
  it("wraps the map svg in a titled section", () => {
    const html = mapHtml(mapOf({ "a.flo": "entity a\nentity b\nflow f {\n  a -> b\n}\n" }));
    expect(html).toContain("Mapa del sistema");
    expect(html).toContain('data-flo-from="a"');
  });

  it("says so when no flow connects entities", () => {
    const html = mapHtml(mapOf({ "a.flo": "entity a\n" }));
    expect(html).toContain("Ningún flujo conecta entidades todavía");
    expect(html).not.toContain("<svg");
  });

  it("adds a wide transparent hit area over each edge", () => {
    const div = document.createElement("div");
    div.innerHTML = mapHtml(mapOf({ "a.flo": "entity a\nentity b\nflow f {\n  a -> b\n}\n" }));
    addEdgeHitAreas(div);
    const hit = div.querySelector("polyline.flo-map-hit")!;
    expect(hit.getAttribute("data-flo-from")).toBe("a");
    expect(hit.getAttribute("stroke")).toBe("transparent");
    expect(hit.getAttribute("stroke-width")).toBe("12");
    expect(hit.hasAttribute("marker-end")).toBe(false);
  });
});
```

En `packages/web/src/entity-panel.test.ts`:

```ts
import { edgePanelHtml } from "./entity-panel.js";

  it("lists the flows of a map edge", () => {
    const html = edgePanelHtml(link, { from: "api", to: "db", type: "flow", blocks: ["login.flo#login", "login.flo#detalle"] });
    expect(html).toContain("API &lt;Gateway&gt; → db");
    expect(html).toContain("En 2 flujos");
    expect(html).toContain('data-flo-block="login.flo#detalle"');
  });
```

En `packages/web/src/toolbar.test.ts`: `mockActions()` suma
`onToggleMap: vi.fn()` y

```ts
    container.querySelector<HTMLButtonElement>("#flo-toggle-map")!.click();
    expect(actions.onToggleMap).toHaveBeenCalledTimes(1);
```

En `packages/web/src/app.test.ts`, dentro de `describe("App navigation")`:

```ts
  it("shows the aggregated map and lists the flows of a clicked edge", () => {
    const el = elements();
    const app = new App(el, FILES);
    click(el.toolbar.querySelector("#flo-toggle-map")!);
    expect(el.preview.innerHTML).toContain("Mapa del sistema");
    click(el.preview.querySelector('polyline.flo-map-hit[data-flo-from="api"]')!);
    expect(el.panel.innerHTML).toContain("En 1 flujo");
    click(el.panel.querySelector('[data-flo-block="login.flo#login"]')!);
    expect(el.preview.innerHTML).not.toContain("Mapa del sistema");
    expect(app.selectedBlock).toBe("login.flo#login");
  });

  it("opens the entity panel from a map node", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.toggleMap();
    click(el.preview.querySelector('[data-flo-entity="db"]')!);
    expect(el.panel.innerHTML).toContain("<code>db</code>");
  });

  it("starts a replaced workspace without selection, panel or map mode", () => {
    const el = elements();
    const app = new App(el, FILES);
    app.selectBlock("login.flo#login", "api");
    app.selectEntity("api");
    app.toggleMap();
    app.loadExample("flowchart");
    expect(app.selectedBlock).toBeNull();
    expect(el.panel.innerHTML).toBe("");
    expect(el.preview.innerHTML).not.toContain("Mapa del sistema");
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/map-view.test.ts src/entity-panel.test.ts src/toolbar.test.ts src/app.test.ts`
Expected: FAIL — `./map-view.js` no existe; `#flo-toggle-map` no existe.

- [x] **Step 3: Implement**

`packages/web/src/map-view.ts`:

```ts
import type { RenderedMap } from "@flo/core";

export function mapHtml(map: RenderedMap): string {
  const body =
    map.edges.length === 0 ? '<p class="flo-empty">Ningún flujo conecta entidades todavía</p>' : map.svg;
  return `<section class="flo-block flo-map"><h2 class="flo-block-title">Mapa del sistema</h2>${body}</section>`;
}

/** Una franja invisible de 12 px sobre cada arista: la línea de 2 px sola casi no se puede clickear. */
export function addEdgeHitAreas(container: ParentNode): void {
  container.querySelectorAll("polyline[data-flo-from]").forEach((line) => {
    const hit = line.cloneNode() as Element;
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", "12");
    hit.removeAttribute("marker-end");
    hit.classList.add("flo-map-hit");
    line.after(hit);
  });
}
```

`packages/web/src/entity-panel.ts`: sumar `type QueryEdge` al import y

```ts
/** Panel de una arista del mapa: los flujos que la contienen. */
export function edgePanelHtml(link: LinkResult, edge: QueryEdge): string {
  const label = (id: EntityId) => escapeXml(link.entities.get(id)?.label ?? id);
  const blocks = edge.blocks ?? [];
  return [
    `<h3 class="flo-panel-title">${label(edge.from)} → ${label(edge.to)}</h3>`,
    `<h4>En ${flows(blocks.length)}</h4>`,
    flowListHtml(link, blocks),
  ].join("");
}
```

`packages/web/src/toolbar.ts`: `onToggleMap(): void` en `ToolbarActions`,
el botón `<button id="flo-toggle-map" type="button">Mapa</button>` antes
de `#flo-toggle-expand`, y
`byId("flo-toggle-map").addEventListener("click", actions.onToggleMap);`.

`packages/web/src/app.ts`:

1. Imports: `query`, `renderMap` de `@flo/core`; `edgePanelHtml` de
   `./entity-panel.js`; `import { addEdgeHitAreas, mapHtml } from "./map-view.js";`.
2. `type PanelState = { kind: "entity"; id: EntityId } | { kind: "edge"; from: EntityId; to: EntityId } | null;`
3. Campo `private mapMode = false;` (que `load()` también limpia:
   `this.mapMode = false;`) y en las acciones de la toolbar
   `onToggleMap: () => this.toggleMap(),`.
4. `refresh()` (reemplazo completo):

```ts
  refresh(): void {
    const link = this.ws.link();
    if (this.mapMode) {
      this.el.preview.innerHTML = mapHtml(renderMap(link));
      addEdgeHitAreas(this.el.preview);
    } else {
      const uri = this.ws.active;
      const result = renderActive(link, uri);
      this.previewState = nextPreviewState(this.previewState, result);
      this.el.preview.innerHTML = previewHtml(this.previewState, result, uri);
      enhanceSequencePreview(this.el.preview);
      this.markSelection();
    }
    this.renderPanel();
    this.renderExplorer();
    // ponytail: sin IndexedDB (modo privado) el editor sigue, solo sin borrador.
    saveDraft(this.ws.snapshot()).catch(() => {});
  }
```

5. `toggleMap()`:

```ts
  toggleMap(): void {
    this.mapMode = !this.mapMode;
    this.refresh();
  }
```

6. `selectBlock`: primera línea `this.mapMode = false;`, y cambiar la
   condición a `if (uri === this.ws.active) this.refresh(); else this.openDocument(uri);`
   (ya es así; con `mapMode = false` el refresh vuelve al preview).
7. `onPreviewClick`: al principio

```ts
    const edge = target.closest("[data-flo-from]");
    if (this.mapMode && edge) {
      this.panel = { kind: "edge", from: edge.getAttribute("data-flo-from")!, to: edge.getAttribute("data-flo-to")! };
      this.renderPanel();
      return;
    }
```

8. `renderPanel()` (reemplazo completo):

```ts
  private renderPanel(): void {
    const link = this.ws.link();
    const panel = this.panel;
    let html = "";
    if (panel?.kind === "entity" && link.entities.has(panel.id)) {
      html = entityPanelHtml(link, panel.id);
    } else if (panel?.kind === "edge") {
      const edge = query(link).edges.find((e) => e.type === "flow" && e.from === panel.from && e.to === panel.to);
      if (edge) html = edgePanelHtml(link, edge);
    }
    if (html === "") this.panel = null;
    this.el.panel.innerHTML = html;
  }
```

9. `exportable()`: primera línea
   `if (this.mapMode) return renderMap(this.ws.link()).svg;`.

`packages/web/index.html`:

```css
      .flo-map polyline[data-flo-from] {
        cursor: pointer;
      }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/map-view.ts packages/web/src/map-view.test.ts packages/web/src/entity-panel.ts packages/web/src/entity-panel.test.ts packages/web/src/toolbar.ts packages/web/src/toolbar.test.ts packages/web/src/app.ts packages/web/src/app.test.ts packages/web/index.html
git commit -m "feat(web): vista mapa agregada con los flujos de cada arista"
```

---

### Task 11: Resaltado — títulos, comas y `:` de propiedades

**Files:**
- Modify: `packages/web/src/flo-highlight.ts`, `packages/web/src/flo-highlight.test.ts`
- Modify: `packages/web/index.html` (estilo de `STRING`)

**Interfaces:**
- Consumes: `Lexer`, `Token` de `@flo/core`.
- Produces: `buildHighlightRanges(doc)` (misma firma) con clases nuevas `flo-tok-string` (`STRING`) y `flo-tok-punct` también para `COMMA`.

Semántica (pendiente C): los títulos de bloque (`STRING`) se colorean y
las comas son puntuación. Tras `:` solo se lee texto libre si en la línea
ya hubo un `->` (la etiqueta de una arista o un mensaje); en
`type: x, tags: a b` el resto sigue lexándose como identificadores.

- [x] **Step 1: Write the failing tests**

En `packages/web/src/flo-highlight.test.ts` (usa el helper que ya tenga
para armar un `Text` de CodeMirror; si no hay, `Text.of(source.split("\n"))`
de `@codemirror/state`):

```ts
  it("colors block titles and commas", () => {
    const source = 'flow f "Inicio" {\n}\nentity a type: x, tags: y\n';
    const ranges = buildHighlightRanges(Text.of(source.split("\n")));
    const classOf = (text: string) => ranges.find((r) => source.slice(r.from, r.to) === text)?.className;
    expect(classOf('"Inicio"')).toBe("flo-tok-string");
    expect(classOf(",")).toBe("flo-tok-punct");
  });

  it("keeps entity properties as identifiers after ':'", () => {
    const source = "entity a type: service, tags: http\n";
    const ranges = buildHighlightRanges(Text.of(source.split("\n")));
    const texts = ranges.map((r) => [source.slice(r.from, r.to), r.className]);
    expect(texts).toContainEqual(["service", "flo-tok-ident"]);
    expect(texts).toContainEqual(["http", "flo-tok-ident"]);
  });

  it("still reads an edge label after '->' and ':' as text", () => {
    const source = "flow f {\n  a -> b : sí, claro\n}\n";
    const ranges = buildHighlightRanges(Text.of(source.split("\n")));
    expect(ranges.map((r) => [source.slice(r.from, r.to), r.className])).toContainEqual([" sí, claro", "flo-tok-text"]);
  });
```

> Nota: si el lexer devuelve el texto de la etiqueta sin el espacio
> inicial, ajustar solo ese string esperado (`"sí, claro"`); lo que se
> verifica es que la etiqueta entera es un único rango `flo-tok-text`.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/flo-highlight.test.ts`
Expected: FAIL — `STRING` y `COMMA` sin clase; `service` coloreado como texto.

- [x] **Step 3: Implement**

En `packages/web/src/flo-highlight.ts`:

1. `CLASS_BY_KIND` suma `STRING: "flo-tok-string",` y `COMMA: "flo-tok-punct",`.
2. Reemplazar el comentario `ponytail:` sobre `type:` por:

```ts
// Tras ':' solo hay texto libre si la línea ya tuvo un '->' (etiqueta de
// arista o mensaje); en las propiedades de entity ('type: x') se siguen
// lexando identificadores.
```

3. El loop de `buildHighlightRanges`:

```ts
  let arrowInLine = false;
  let token = lexer.next();
  while (token.kind !== "EOF") {
    pushToken(token);
    if (token.kind === "NEWLINE") arrowInLine = false;
    if (token.kind === "ARROW") arrowInLine = true;

    const closer = TEXT_CLOSER_BY_OPEN[token.kind];
    if (closer) {
      pushToken(lexer.readTextUntil(closer));
    } else if (token.kind === "COLON" && arrowInLine) {
      pushToken(lexer.readTextUntil("\n"));
    }

    token = lexer.next();
  }
```

`packages/web/index.html`:

```css
      .flo-tok-string {
        color: #7c3aed;
      }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flo/web test && pnpm --filter @flo/web typecheck`
Expected: PASS. Si un test existente esperaba el texto tras `type:`,
actualizar esa expectativa: es el comportamiento que el pendiente pidió
cambiar.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/flo-highlight.ts packages/web/src/flo-highlight.test.ts packages/web/index.html
git commit -m "fix(web): el resaltado colorea títulos y comas y no trata propiedades como texto"
```

---

### Task 12: Documentación del editor

**Files:**
- Modify: `README.md`
- Modify: `packages/core/GRAMMAR.md` (solo si alguna línea cita el mensaje viejo de `E032`/`E042`)

**Interfaces:** ninguna.

- [x] **Step 1: README**

En `README.md`, en la sección que describe el editor web (la que habla
de persistencia local, autosave e IndexedDB), agregar una subsección
"Workspace y navegación" con, en prosa corta:

- "Abrir carpeta" carga los `.flo`, `.md` y el `knowledge.schema.yaml` de
  la raíz (sin `node_modules` ni `.git`); en navegadores sin File System
  Access es de solo lectura y "Guardar" descarga el archivo activo.
- "Guardar" escribe todos los archivos modificados (marcados con `●`), sin
  validar; el borrador en IndexedDB guarda el workspace entero.
- Explorador (catálogo filtrable por `type` y tag, archivos con sus
  bloques), panel de entidad ("aparece en N flujos"), Ctrl/Cmd+click o F12
  para ir a definición, F2 o "Renombrar" para renombrar en todos los
  archivos, "Mapa" para el grafo agregado de todos los flujos.
- Exportar SVG/PNG toma el bloque seleccionado (click en su título o en
  el explorador), o el mapa si está visible.

Actualizar el párrafo "Estado actual" (F completa; pendientes K4 y Fase
6) y el Roadmap (quitar F). Sumar el plan de F a la lista "Planes de la
v2".

- [x] **Step 2: GRAMMAR**

Run: `grep -n "no existe en el workspace\|después de la propiedad" packages/core/GRAMMAR.md`
Si alguna línea cita el texto literal de un mensaje que cambió en la
task 3, actualizarla; la tabla de códigos no cambia (los significados son
los mismos).

- [x] **Step 3: Verificación completa**

Run: `pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: PASS en los tres paquetes; `git status` no muestra `.snap`
modificados.

- [x] **Step 4: Commit**

```bash
git add README.md packages/core/GRAMMAR.md
git commit -m "docs: workspace y navegación del editor web (Fase F)"
```

---

### Task 13: Pendientes de la revisión final (segunda vuelta)

Recoge de §11 "Pendientes diferidos (Fase F)" lo que tiene arreglo en
código. Queda fuera: el smoke test en Chromium (manual), el `setTimeout`
suelto del debounce y los `EditorState` sin podar (inofensivos: un refresh
de más y unos pocos estados hasta el siguiente `load()`), y el test del
guard de botón del Ctrl/Cmd+click (jsdom no da posición al click).

**Files:**
- Modify: `packages/web/src/app.ts`, `packages/web/src/app.test.ts`
- Modify: `packages/web/src/toolbar.ts`
- Modify: `packages/web/index.html` (estilo)
- Modify: `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` (§11)

**Interfaces:**
- Consumes: `App.refresh()`, `App.selectBlock()`, `App.panel` (tasks 7–10); `exportSvg` de `./export.js`.
- Produces: el botón `#flo-toggle-map` lleva `aria-pressed="true|false"` según el modo; ninguna firma cambia.

Semántica: el botón "Mapa" muestra si el mapa está visible
(`aria-pressed`, actualizado en cada `refresh()`, así también lo apagan
`selectBlock` y `load()`). Salir del mapa por un flujo del panel de una
arista cierra ese panel (la arista ya no está a la vista); el panel de
una entidad se conserva. Exportar SVG toma el bloque seleccionado, o el
mapa si está visible (#41), ahora con test.

- [ ] **Step 1: Write the failing tests**

En `packages/web/src/app.test.ts`, después de los imports:

```ts
// jsdom no descarga archivos: se observa qué SVG recibe la exportación.
vi.mock("./export.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./export.js")>()),
  exportSvg: vi.fn(),
}));
import { exportSvg } from "./export.js";
```

y dentro de `describe("App navigation")`:

```ts
  it("exports the selected block, or the map when it is visible", () => {
    const el = elements();
    const app = new App(el, FILES);
    vi.mocked(exportSvg).mockClear();
    app.selectBlock("login.flo#vacio");
    click(el.toolbar.querySelector("#flo-export-svg")!);
    expect(vi.mocked(exportSvg).mock.calls[0][0]).not.toContain("API Gateway"); // no el primero
    app.toggleMap();
    click(el.toolbar.querySelector("#flo-export-svg")!);
    expect(vi.mocked(exportSvg).mock.calls[1][0]).toContain('data-flo-block="#mapa"');
  });

  it("marks the map button as pressed while the map is visible", () => {
    const el = elements();
    const app = new App(el, FILES);
    const button = el.toolbar.querySelector("#flo-toggle-map")!;
    expect(button.getAttribute("aria-pressed")).toBe("false");
    app.toggleMap();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    app.selectBlock("login.flo#login");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("closes an edge panel when leaving the map through one of its flows", () => {
    const el = elements();
    new App(el, FILES);
    click(el.toolbar.querySelector("#flo-toggle-map")!);
    click(el.preview.querySelector('polyline.flo-map-hit[data-flo-from="api"]')!);
    click(el.panel.querySelector('[data-flo-block="login.flo#login"]')!);
    expect(el.panel.innerHTML).toBe("");
  });
```

(El test del panel de entidad que salta a un flujo — "jumps from a flow in
the panel…" — ya verifica que ese panel se conserva.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/app.test.ts`
Expected: FAIL — `aria-pressed` es null y el panel de arista sigue visible.
(El de exportar puede pasar ya: es el test que faltaba, no un bug.)

- [ ] **Step 3: Implement**

`packages/web/src/toolbar.ts`: el botón pasa a
`<button id="flo-toggle-map" type="button" aria-pressed="false">Mapa</button>`.

`packages/web/src/app.ts`:

1. En `refresh()`, antes de `this.renderPanel();`:

```ts
    this.el.toolbar.querySelector("#flo-toggle-map")?.setAttribute("aria-pressed", String(this.mapMode));
```

2. En `selectBlock`, después de `this.mapMode = false;`:

```ts
    // La arista del panel ya no está a la vista; el panel de una entidad sí sigue valiendo.
    if (this.panel?.kind === "edge") this.panel = null;
```

`packages/web/index.html`, estilos:

```css
      #toolbar button[aria-pressed="true"] {
        background: #dbeafe;
        border-color: #93c5fd;
      }
```

`docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`: en
"Pendientes diferidos (Fase F)", reemplazar el ítem **K4 — mapa** y el
ítem **Cualquiera — tests** por:

```markdown
- **Cualquiera — tests:** sin test del guard de botón del Ctrl/Cmd+click
  (jsdom no da posición al click). (El `aria-pressed` del botón "Mapa",
  el panel de arista al salir del mapa y el test de exportar el bloque
  seleccionado se resolvieron en la task 13 del plan de F.)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: PASS; ningún `.snap` modificado.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/app.ts packages/web/src/app.test.ts packages/web/src/toolbar.ts packages/web/index.html docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "fix(web): el botón Mapa muestra su estado, el panel de arista se cierra al salir del mapa y test de exportar el bloque seleccionado"
```
