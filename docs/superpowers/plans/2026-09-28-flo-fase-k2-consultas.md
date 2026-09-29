# .flo — consultas sobre el workspace (Fase K2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-09-28 (`df4e4dd`..`a11a746`, fix de la revisión final `95efb9d`); revisión de la task 1: el test `{ text: "api" }` del fixture chocaba con la cerca ` ```flo ` de `pkce` y se cambió a `"db"` (`text` busca también dentro de las cercas, spec §5). Revisión final: lista para merge; 1 hallazgo importante (`QueryOptions` mal formado desde JSON) y 1 menor quedaron en §11 como pendientes de K3 y K4; CRLF en `floSources`, adyacencia O(grado) y un test de texto dentro de cerca, corregidos.

**Goal:** `query(link, opts)` y `tagCatalog(link)` en `@flo/core`: funciones
puras sobre un `LinkResult` que filtran entidades por predicados de
conocimiento, expanden por relaciones y flujos hasta `depth`, proyectan
`meta`/`full`/`full+diagrams` y listan el vocabulario de tags en uso.

**Architecture:** Un único módulo nuevo `packages/core/src/workspace/query.ts`.
`query` arma primero la lista completa de aristas del workspace (relaciones
resueltas a entidad + aristas de flujo fundidas por par `from→to`), elige las
semillas con `matches(entity, where)`, hace BFS no dirigido sobre esas
aristas y ordena por (distancia, orden del catálogo). El texto fuente de las
cercas ` ```flo ` sale de un helper nuevo `floSources(body)` en
`parser/markdown.ts`, que reusa el `floFences` existente (una sola
definición de "qué es una cerca").

**Tech Stack:** TypeScript 5 (strict, target ES2022), Vitest. Sin
dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-28-flo-grafo-de-conocimiento-design.md`
(§4 modelo, §5 consultas, §10 K2, §11 testing K2). Decisiones vigentes en
`docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` §11
(#1, #2, #22, #24, #25, #28, #30). Orden de fases: D → E → K1 → **K2** → K3 →
F → K4.

## Global Constraints

- **Snapshots de SVG no se regeneran** (`vitest -u` prohibido); ningún
  `.snap` cambia en esta fase.
- **Imports relativos en `packages/core/src/` llevan sufijo `.js`.**
- **Sin dependencias nuevas.** Nada de módulos de Node en `@flo/core`
  (corre en el navegador).
- **Comentarios en español**; nombres de test en inglés.
- **Sin diagnósticos nuevos**: `query` y `tagCatalog` no reportan nada; una
  entrada que no aplica (id desconocido en `from`, `depth` negativo) se
  ignora.
- **Puras**: no mutan el `LinkResult` ni devuelven arrays/objetos
  compartidos con el AST (se copian `typeTags`, `contextTags`, `customTags`).
- **Decisiones nuevas** (#31, #32) van al final de §11 del spec de
  2026-09-19, en una tabla "Decisiones de la Fase K2 (2026-09-28)", en la
  task 1 (texto dado abajo).
- `@flo/web` no se toca, pero consume `@flo/core` por `dist/`: la task 2
  termina con `pnpm --filter @flo/core build` y la verificación completa.
- Un commit por task, con la línea final
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verificación final (desde la raíz): `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

## Review Focus

1. **Workspace con errores** (relación sin resolver `E035`, referencia de
   flujo sin resolver `E030`, id duplicado `E031`): `query` no lanza; lo no
   resuelto no genera aristas y la declaración perdedora no aporta
   relaciones ni tags. Fixture de la task 1 (y de la task 2 para tags).
2. **`from` con ids que no existen, o `from: []`**: los desconocidos se
   ignoran; `from: []` da resultado vacío (no "todas"). Test en task 1.
3. **Ciclos y `depth` mayor que el grafo**: termina, cada nodo aparece una
   vez a su distancia mínima; `depth` negativo equivale a 0. Test en task 1.
4. **Claves de `custom_tags` que coinciden con miembros de `Object.prototype`**
   (`constructor`, `toString`): `{ custom: "constructor" }` no matchea a
   quien no la tiene, y `tagCatalog` no se rompe. Test en tasks 1 y 2.
5. **Búsqueda de texto con acentos y mayúsculas** (`"CAÍDA"` encuentra
   `"Caída"`); `equals` compara con tipo (`3` ≠ `"3"`). Test en task 1.

---

## File Structure

- Create: `packages/core/src/workspace/query.ts` — `Where`, `QueryOptions`,
  `QueryNode`, `QueryEdge`, `QueryResult`, `TagCatalog`, `query`,
  `tagCatalog`.
- Create: `packages/core/src/workspace/query.test.ts` — fixture fijo y tabla
  de consultas.
- Modify: `packages/core/src/parser/markdown.ts` — exportar `floSources`.
- Modify: `packages/core/src/index.ts`, `packages/core/src/index.test.ts` —
  API pública (task 2).
- Modify: `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
  §11 — decisiones #31 y #32 (task 1).

---

### Task 1: `query` — semillas, expansión, aristas y proyección

**Files:**
- Create: `packages/core/src/workspace/query.ts`
- Create: `packages/core/src/workspace/query.test.ts`
- Modify: `packages/core/src/parser/markdown.ts` (agregar `floSources` debajo de `floFences`)
- Modify: `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` (final de §11)

**Interfaces:**
- Consumes: `LinkResult` (`workspace/workspace.ts`: `entities: Catalog` en
  orden de catálogo, `documents: Map<uri, { document }>` en orden de uri);
  `blockId(uri, name)` de `workspace/uri.ts`; `floFences(lines, from)`
  (privada en `parser/markdown.ts`).
- Produces (los usa la task 2 y K3):
  ```ts
  export type Where =
    | { and: Where[] } | { or: Where[] } | { not: Where }
    | { memory: MemoryType } | { typeTag: string } | { contextTag: string }
    | { custom: string; equals?: CustomTagValue } | { text: string };
  export type Projection = "meta" | "full" | "full+diagrams";
  export interface QueryOptions { where?: Where; from?: EntityId[]; depth?: number; project?: Projection }
  export interface QueryNode {
    id: EntityId; title: string; uri: DocumentUri; distance: number;
    memoryType: MemoryType | null; typeTags: string[]; contextTags: string[];
    customTags: Record<string, CustomTagValue>;
    body?: string; diagrams?: string[];
  }
  export interface QueryEdge { from: EntityId; to: EntityId; type: string; blocks?: BlockId[] }
  export interface QueryResult { nodes: QueryNode[]; edges: QueryEdge[] }
  export function query(link: LinkResult, opts?: QueryOptions): QueryResult;
  // parser/markdown.ts
  export function floSources(body: string): string[];
  ```

- [x] **Step 1: Escribir el test (fixture + tabla de consultas)**

Crear `packages/core/src/workspace/query.test.ts`:

````ts
import { describe, it, expect } from "vitest";
import { Workspace, type LinkResult } from "./workspace.js";
import { SCHEMA_URI } from "./schema.js";
import { query, type QueryOptions, type QueryResult } from "./query.js";

const md = (lines: string[]): string => [...lines, ""].join("\n");

/** Workspace fijo de la Fase K2. Orden del catálogo: api, db, cache, incidente, passwords, pkce, auth. */
const files: Record<string, string> = {
  [SCHEMA_URI]: "type_tags: [business_rule, decision, incident]\nrelation_types: [affects, enforces, visualized_by]\n",
  "catalogo.flo": "entity api\nentity db\nentity cache\n",
  "flujos/auth.flo": md([
    'use "../catalogo.flo"',
    "flow acceso {",
    "  api -> db",
    "  db -> api",
    "}",
    "sequence detalle {",
    "  api -> cache : get",
    "}",
    "flow admin {",
    "  api -> db",
    "  api -> ghost",
    "}",
  ]),
  "kb/incidente.md": md([
    "---",
    "id: incidente",
    "title: Caída del cache",
    "memory_type: working",
    "type_tags: [incident]",
    'context_tags: ["project:ops"]',
    "custom_tags:",
    '  security_level: "3"',
    "  urgent: true",
    'use: ["../catalogo.flo"]',
    "relations:",
    "  - target: cache",
    "    type: affects",
    "---",
    "El CACHE se cayó.",
  ]),
  "kb/passwords.md": md([
    "---",
    "id: passwords",
    "title: Reglas de contraseñas",
    "memory_type: short_term",
    "type_tags: [business_rule]",
    'context_tags: ["project:core"]',
    "custom_tags:",
    "  status: draft",
    "relations:",
    "  - target: fantasma",
    "    type: affects",
    "---",
    "Mínimo 12 caracteres.",
  ]),
  "kb/pkce.md": md([
    "---",
    "id: pkce",
    'title: "Decisión: OAuth2 + PKCE"',
    "memory_type: long_term",
    "type_tags: [decision]",
    'context_tags: ["project:core", "flow:authentication"]',
    "custom_tags:",
    "  status: approved",
    "  security_level: 3",
    'use: ["../catalogo.flo"]',
    "relations:",
    "  - target: ./passwords.md",
    "    type: enforces",
    "  - target: ../flujos/auth.flo#acceso",
    "    type: visualized_by",
    "  - target: api",
    "    type: affects",
    "---",
    "",
    "# Decisión de arquitectura",
    "",
    "Usamos PKCE en el cliente.",
    "",
    "```flo",
    "entity auth",
    "flow validacion {",
    "  api -> auth",
    "}",
    "```",
  ]),
  // Pierde contra kb/pkce.md (E031): no aporta relaciones ni tags.
  "kb/zz_dup.md": md([
    "---",
    "id: pkce",
    "title: Duplicado",
    "memory_type: long_term",
    "type_tags: [decision]",
    'context_tags: ["project:dup"]',
    "---",
  ]),
};

function linkFiles(input: Record<string, string>): LinkResult {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(input)) workspace.setDocument(uri, source);
  return workspace.link();
}

const link = linkFiles(files);
const run = (opts: QueryOptions = {}): QueryResult => query(link, opts);
const ids = (result: QueryResult): string[] => result.nodes.map((node) => node.id);
const distances = (result: QueryResult): [string, number][] => result.nodes.map((node) => [node.id, node.distance]);
const edges = (result: QueryResult): string[] => result.edges.map((edge) => `${edge.from}->${edge.to}:${edge.type}`);

describe("query", () => {
  it("links the fixture with exactly the expected diagnostics", () => {
    const codes = Object.fromEntries(
      [...link.diagnostics].map(([uri, list]) => [uri, list.map((diagnostic) => diagnostic.code)])
    );
    expect(codes).toEqual({
      "catalogo.flo": [],
      "flujos/auth.flo": ["E030"],
      "kb/incidente.md": [],
      "kb/passwords.md": ["E035"],
      "kb/pkce.md": [],
      "kb/zz_dup.md": ["E031"],
      [SCHEMA_URI]: [],
    });
  });

  it("returns every entity in catalog order when where is omitted", () => {
    const result = run();
    expect(ids(result)).toEqual(["api", "db", "cache", "incidente", "passwords", "pkce", "auth"]);
    expect(result.nodes.every((node) => node.distance === 0)).toBe(true);
  });

  it("lists relation edges and merged flow edges in document order", () => {
    const result = run();
    expect(edges(result)).toEqual([
      "api->db:flow",
      "db->api:flow",
      "api->cache:flow",
      "incidente->cache:affects",
      "pkce->passwords:enforces",
      "pkce->api:affects",
      "api->auth:flow",
    ]);
    expect(result.edges.map((edge) => edge.blocks)).toEqual([
      ["flujos/auth.flo#acceso", "flujos/auth.flo#admin"],
      ["flujos/auth.flo#acceso"],
      ["flujos/auth.flo#detalle"],
      undefined,
      undefined,
      undefined,
      ["kb/pkce.md#validacion"],
    ]);
  });

  it.each<[string, QueryOptions["where"], string[]]>([
    ["memory", { memory: "long_term" }, ["pkce"]],
    ["typeTag", { typeTag: "incident" }, ["incidente"]],
    ["exact contextTag", { contextTag: "project:core" }, ["passwords", "pkce"]],
    ["contextTag key with any value", { contextTag: "project:" }, ["incidente", "passwords", "pkce"]],
    ["custom key present", { custom: "status" }, ["passwords", "pkce"]],
    ["custom equals string", { custom: "status", equals: "approved" }, ["pkce"]],
    ["custom equals keeps the type (3 is not '3')", { custom: "security_level", equals: 3 }, ["pkce"]],
    ["custom equals boolean", { custom: "urgent", equals: true }, ["incidente"]],
    ["custom key inherited from Object.prototype", { custom: "constructor" }, []],
    ["text in title, ignoring case and keeping accents", { text: "CAÍDA" }, ["incidente"]],
    ["text in body", { text: "12 caracteres" }, ["passwords"]],
    ["text does not see .flo entities", { text: "api" }, []],
    ["and", { and: [{ memory: "short_term" }, { contextTag: "project:core" }] }, ["passwords"]],
    ["or", { or: [{ typeTag: "incident" }, { memory: "long_term" }] }, ["incidente", "pkce"]],
    ["not also matches .flo entities", { not: { memory: "working" } }, ["api", "db", "cache", "passwords", "pkce", "auth"]],
    ["empty and matches everything", { and: [] }, ["api", "db", "cache", "incidente", "passwords", "pkce", "auth"]],
    ["empty or matches nothing", { or: [] }, []],
  ])("filters seeds by %s", (_name, where, expected) => {
    expect(ids(run({ where }))).toEqual(expected);
  });

  it("intersects from with where, in catalog order, ignoring unknown ids", () => {
    expect(ids(run({ from: ["pkce", "api", "nope"] }))).toEqual(["api", "pkce"]);
    expect(ids(run({ from: ["pkce", "api", "nope"], where: { memory: "long_term" } }))).toEqual(["pkce"]);
    expect(run({ from: [] })).toEqual({ nodes: [], edges: [] });
  });

  it("only returns edges between nodes of the result", () => {
    expect(edges(run({ where: { memory: "long_term" } }))).toEqual([]);
  });

  it("expands undirected over relations and flows up to depth", () => {
    const one = run({ where: { memory: "long_term" }, depth: 1 });
    expect(distances(one)).toEqual([["pkce", 0], ["api", 1], ["passwords", 1]]);
    expect(edges(one)).toEqual(["pkce->passwords:enforces", "pkce->api:affects"]);

    const two = run({ where: { memory: "long_term" }, depth: 2 });
    expect(distances(two)).toEqual([
      ["pkce", 0],
      ["api", 1],
      ["passwords", 1],
      ["db", 2],
      ["cache", 2],
      ["auth", 2],
    ]);
    expect(edges(two)).toEqual([
      "api->db:flow",
      "db->api:flow",
      "api->cache:flow",
      "pkce->passwords:enforces",
      "pkce->api:affects",
      "api->auth:flow",
    ]);
  });

  it("follows incoming relations and flow edges alike", () => {
    expect(distances(run({ from: ["cache"], depth: 1 }))).toEqual([["cache", 0], ["api", 1], ["incidente", 1]]);
    expect(edges(run({ where: { typeTag: "incident" }, depth: 2 }))).toEqual([
      "api->cache:flow",
      "incidente->cache:affects",
    ]);
  });

  it("stops on cycles and lists each node once at its minimum distance", () => {
    expect(distances(run({ where: { memory: "long_term" }, depth: 10 }))).toEqual([
      ["pkce", 0],
      ["api", 1],
      ["passwords", 1],
      ["db", 2],
      ["cache", 2],
      ["auth", 2],
      ["incidente", 3],
    ]);
  });

  it("treats a negative depth as 0", () => {
    expect(ids(run({ where: { memory: "long_term" }, depth: -1 }))).toEqual(["pkce"]);
  });

  it("projects meta by default, for .md and .flo entities", () => {
    const [api, pkce] = run({ from: ["api", "pkce"] }).nodes;
    expect(pkce).toEqual({
      id: "pkce",
      title: "Decisión: OAuth2 + PKCE",
      uri: "kb/pkce.md",
      distance: 0,
      memoryType: "long_term",
      typeTags: ["decision"],
      contextTags: ["project:core", "flow:authentication"],
      customTags: { status: "approved", security_level: 3 },
    });
    expect(pkce).not.toHaveProperty("body");
    expect(pkce).not.toHaveProperty("diagrams");
    expect(api).toEqual({
      id: "api",
      title: "api",
      uri: "catalogo.flo",
      distance: 0,
      memoryType: null,
      typeTags: [],
      contextTags: [],
      customTags: {},
    });
  });

  it("adds the body with full, and the embedded flo sources with full+diagrams", () => {
    const [api, pkce] = run({ from: ["api", "pkce"], project: "full" }).nodes;
    expect(pkce.body).toBe(
      "\n# Decisión de arquitectura\n\nUsamos PKCE en el cliente.\n\n```flo\nentity auth\nflow validacion {\n  api -> auth\n}\n```\n"
    );
    expect(pkce).not.toHaveProperty("diagrams");
    expect(api.body).toBe("");

    const [apiFull, pkceFull] = run({ from: ["api", "pkce"], project: "full+diagrams" }).nodes;
    expect(pkceFull.diagrams).toEqual(["entity auth\nflow validacion {\n  api -> auth\n}"]);
    expect(apiFull.diagrams).toEqual([]);
  });

  it("does not share arrays or objects with the linked documents", () => {
    const [pkce] = run({ from: ["pkce"] }).nodes;
    pkce.typeTags.push("x");
    pkce.customTags.status = "x";
    expect(run({ from: ["pkce"] }).nodes[0].typeTags).toEqual(["decision"]);
    expect(link.entities.get("pkce")!.knowledge!.customTags.status).toBe("approved");
  });
});
````

- [x] **Step 2: Correr el test y verlo fallar**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/query.test.ts`
Expected: FAIL — `Failed to resolve import "./query.js"`.

- [x] **Step 3: `floSources` en `parser/markdown.ts`**

Agregar debajo de `floFences` (que queda privada):

```ts
/** Texto fuente de cada cerca ` ```flo ` de un cuerpo Markdown, sin las líneas de la cerca. */
export function floSources(body: string): string[] {
  const lines = body.split("\n");
  return floFences(lines, 0).map((fence) => lines.slice(fence.start, fence.end).join("\n"));
}
```

- [x] **Step 4: Implementar `workspace/query.ts`**

```ts
import type { BlockId, CustomTagValue, DocumentUri, EntityDecl, EntityId, MemoryType } from "../ast.js";
import { floSources } from "../parser/markdown.js";
import { blockId } from "./uri.js";
import type { LinkResult } from "./workspace.js";

/** Filtro de semillas (spec de conocimiento §5). Los predicados hoja solo los cumplen entidades de `.md`. */
export type Where =
  | { and: Where[] }
  | { or: Where[] }
  | { not: Where }
  | { memory: MemoryType }
  | { typeTag: string }
  | { contextTag: string } // exacto "clave:valor", o "clave:" = cualquier valor
  | { custom: string; equals?: CustomTagValue }
  | { text: string }; // substring sin distinguir mayúsculas en title + body

export type Projection = "meta" | "full" | "full+diagrams";

export interface QueryOptions {
  where?: Where; // omitido = todas
  from?: EntityId[]; // semillas explícitas; se intersecan con where
  depth?: number; // 0 por defecto
  project?: Projection; // "meta" por defecto
}

export interface QueryNode {
  id: EntityId;
  title: string; // el label de la entidad
  uri: DocumentUri;
  distance: number; // 0 = semilla
  memoryType: MemoryType | null; // null en entidades .flo
  typeTags: string[];
  contextTags: string[];
  customTags: Record<string, CustomTagValue>;
  body?: string; // full: Markdown sin frontmatter; "" en entidades .flo
  diagrams?: string[]; // full+diagrams: fuente de cada cerca ```flo
}

export interface QueryEdge {
  from: EntityId;
  to: EntityId;
  type: string; // tipo de la relación, o "flow"
  blocks?: BlockId[]; // solo en "flow": los bloques que contienen la arista
}

export interface QueryResult {
  nodes: QueryNode[]; // por distancia, luego orden del catálogo
  edges: QueryEdge[]; // todas las aristas entre nodos del resultado
}

function matches(entity: EntityDecl, where: Where): boolean {
  if ("and" in where) return where.and.every((w) => matches(entity, w));
  if ("or" in where) return where.or.some((w) => matches(entity, w));
  if ("not" in where) return !matches(entity, where.not);
  const knowledge = entity.knowledge;
  if (!knowledge) return false;
  if ("memory" in where) return knowledge.memoryType === where.memory;
  if ("typeTag" in where) return knowledge.typeTags.includes(where.typeTag);
  if ("contextTag" in where) {
    const tag = where.contextTag;
    return tag.endsWith(":")
      ? knowledge.contextTags.some((t) => t.startsWith(tag))
      : knowledge.contextTags.includes(tag);
  }
  if ("custom" in where) {
    // hasOwn: una clave como "constructor" no debe matchear por herencia.
    if (!Object.hasOwn(knowledge.customTags, where.custom)) return false;
    return where.equals === undefined || knowledge.customTags[where.custom] === where.equals;
  }
  const text = where.text.toLowerCase();
  return entity.label.toLowerCase().includes(text) || knowledge.body.toLowerCase().includes(text);
}

/**
 * Todas las aristas del workspace (decisión #32), por documento en orden de
 * uri: primero las relaciones resueltas a entidad de la declaración
 * ganadora, luego las aristas de flujo en orden de fuente, fundidas por par
 * `from→to` en la primera aparición.
 */
function workspaceEdges(link: LinkResult): QueryEdge[] {
  const edges: QueryEdge[] = [];
  const flows = new Map<string, QueryEdge & { blocks: BlockId[] }>();
  for (const { document } of link.documents.values()) {
    for (const entity of document.entities) {
      if (!entity.knowledge || link.entities.get(entity.id) !== entity) continue;
      for (const relation of entity.knowledge.relations) {
        if (relation.resolved?.kind === "entity") {
          edges.push({ from: entity.id, to: relation.resolved.id, type: relation.type });
        }
      }
    }
    for (const block of document.blocks) {
      const id = blockId(document.uri, block.name);
      for (const { from, to } of block.edges) {
        if (from.target === null || to.target === null) continue;
        const key = `${from.target} ${to.target}`;
        const known = flows.get(key);
        if (known) {
          if (!known.blocks.includes(id)) known.blocks.push(id);
          continue;
        }
        const edge = { from: from.target, to: to.target, type: "flow", blocks: [id] };
        flows.set(key, edge);
        edges.push(edge);
      }
    }
  }
  return edges;
}

function toNode(entity: EntityDecl, distance: number, project: Projection): QueryNode {
  const knowledge = entity.knowledge;
  const node: QueryNode = {
    id: entity.id,
    title: entity.label,
    uri: entity.uri,
    distance,
    memoryType: knowledge?.memoryType ?? null,
    typeTags: [...(knowledge?.typeTags ?? [])],
    contextTags: [...(knowledge?.contextTags ?? [])],
    customTags: { ...knowledge?.customTags },
  };
  if (project !== "meta") node.body = knowledge?.body ?? "";
  if (project === "full+diagrams") node.diagrams = knowledge ? floSources(knowledge.body) : [];
  return node;
}

/**
 * Consulta pura sobre un workspace enlazado (spec de conocimiento §5,
 * decisiones #31 y #32): semillas = entidades del catálogo que cumplen
 * `where` y están en `from`; expansión BFS no dirigida hasta `depth`.
 */
export function query(link: LinkResult, opts: QueryOptions = {}): QueryResult {
  const { where, from, depth = 0, project = "meta" } = opts;
  const allowed = from ? new Set(from) : null;
  const distance = new Map<EntityId, number>();
  for (const entity of link.entities.values()) {
    if (allowed && !allowed.has(entity.id)) continue;
    if (where && !matches(entity, where)) continue;
    distance.set(entity.id, 0);
  }

  const edges = workspaceEdges(link);
  const adjacent = new Map<EntityId, EntityId[]>();
  for (const { from: a, to: b } of edges) {
    adjacent.set(a, [...(adjacent.get(a) ?? []), b]);
    adjacent.set(b, [...(adjacent.get(b) ?? []), a]);
  }
  let frontier = [...distance.keys()];
  for (let d = 1; d <= depth && frontier.length > 0; d++) {
    const next: EntityId[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacent.get(id) ?? []) {
        if (distance.has(neighbor)) continue;
        distance.set(neighbor, d);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  const order = new Map([...link.entities.keys()].map((id, index) => [id, index]));
  const ids = [...distance.keys()].sort((a, b) => distance.get(a)! - distance.get(b)! || order.get(a)! - order.get(b)!);
  return {
    nodes: ids.map((id) => toNode(link.entities.get(id)!, distance.get(id)!, project)),
    edges: edges.filter((edge) => distance.has(edge.from) && distance.has(edge.to)),
  };
}
```

Nota: `adjacent.set(a, [...])` copia el array por arista; es O(grado²) por
nodo. Si al implementar preferís `push` sobre un array existente (patrón
`push()` de `xref.ts`), hacelo: el resultado es el mismo.

- [x] **Step 5: Correr el test y verlo pasar**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/query.test.ts`
Expected: PASS (todas).

Si el primer test (diagnósticos del fixture) falla, **no** ajustar las
expectativas de las otras: el fixture está mal escrito; reportarlo.

- [x] **Step 6: Registrar las decisiones #31 y #32**

Al final de §11 de `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md`
(después de "Pendientes diferidos (Fase K1, 2026-09-28)"), agregar:

```markdown
### Decisiones de la Fase K2 (2026-09-28)

| # | Fecha | Decisión | Afecta a |
|---|---|---|---|
| 31 | 2026-09-28 | **Semántica de `query`.** Los predicados hoja de `Where` solo los cumplen entidades de `.md` (un `memoryType: null` no cumple ningún `memory`); `not` los niega también para entidades `.flo`, `{ and: [] }` es verdadero y `{ or: [] }` falso. `contextTag` terminado en `:` compara por prefijo; `custom` exige clave propia (`Object.hasOwn`) y `equals` compara con `===` (`3` ≠ `"3"`); `text` busca en `label` y `body` por separado con `toLowerCase`. `from` se interseca con `where`, ignora ids desconocidos y `from: []` no da semillas. Orden de `nodes`: distancia y luego orden del catálogo (#1, #22, #24); las semillas son las de distancia 0. `QueryNode` = `id`, `title` (label), `uri`, `distance`, `memoryType`, `typeTags`, `contextTags`, `customTags` (vacíos/null en `.flo`), más `body` en `full` (`""` en `.flo`) y `diagrams` en `full+diagrams` (fuente de cada cerca ` ```flo ` del cuerpo, `[]` en `.flo`). Sin diagnósticos; `depth` negativo = 0. | query (K2), MCP (K3), filtros y vista de grafo (K4) |
| 32 | 2026-09-28 | **Aristas de `query`.** Una relación entra como arista solo si resolvió a entidad y es de la declaración ganadora (#2); una relación a bloque (`auth.flo#acceso`) no es arista ni expande: el resultado es un grafo de entidades, y K4 la lee de `xref.relationsFrom`. Las aristas de flujo (`flow` y `sequence`, tipo `"flow"`) son dirigidas, una por par `from→to` resuelto, con `blocks` = los `BlockId` que la contienen en orden de aparición; las referencias sin resolver no generan arista. Orden: documentos por uri; dentro de cada uno, relaciones (orden de declaración) y luego aristas de flujo (orden de fuente). La expansión las recorre sin dirección. | query (K2), MCP `get_node` (K3), render de conocimiento (K4) |
```

- [x] **Step 7: Suite y typecheck del core**

Run: `pnpm --filter @flo/core typecheck && pnpm --filter @flo/core test`
Expected: sin errores; ningún `.snap` cambia (`git status` no lista
`__snapshots__`).

- [x] **Step 8: Commit**

```bash
git add packages/core/src/workspace/query.ts packages/core/src/workspace/query.test.ts \
  packages/core/src/parser/markdown.ts docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md
git commit -m "feat(core): query sobre el workspace (semillas, expansión y proyección)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `tagCatalog` y API pública

**Files:**
- Modify: `packages/core/src/workspace/query.ts`
- Modify: `packages/core/src/workspace/query.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/index.test.ts`

**Interfaces:**
- Consumes: `LinkResult`; los tipos y `query` de la task 1; los helpers
  `files`, `linkFiles`, `link`, `md` e `ids` que ya define `query.test.ts`
  (mismo archivo).
- Produces:
  ```ts
  export interface TagCatalog {
    typeTags: string[];
    contextTags: string[];
    customTags: Record<string, CustomTagValue[]>;
  }
  export function tagCatalog(link: LinkResult): TagCatalog;
  ```
  y en `@flo/core`: `query`, `tagCatalog` y los tipos `Where`, `Projection`,
  `QueryOptions`, `QueryNode`, `QueryEdge`, `QueryResult`, `TagCatalog`.

- [x] **Step 1: Escribir los tests**

Agregar al final de `packages/core/src/workspace/query.test.ts` (y sumar
`tagCatalog` al import de `./query.js`):

```ts
describe("tagCatalog", () => {
  it("lists the tags in use by winning declarations, in catalog order without repeats", () => {
    expect(tagCatalog(link)).toEqual({
      typeTags: ["incident", "business_rule", "decision"],
      contextTags: ["project:ops", "project:core", "flow:authentication"],
      customTags: { security_level: ["3", 3], urgent: [true], status: ["draft", "approved"] },
    });
  });

  it("handles custom tag keys named like Object.prototype members", () => {
    const tagged = linkFiles({
      [SCHEMA_URI]: "type_tags: []\nrelation_types: []\n",
      "a.md": md(["---", "id: a", "title: A", "memory_type: working", "custom_tags:", "  constructor: x", "  toString: 1", "---"]),
    });
    expect(tagCatalog(tagged).customTags).toEqual({ constructor: ["x"], toString: [1] });
    expect(ids(query(tagged, { where: { custom: "constructor", equals: "x" } }))).toEqual(["a"]);
  });

  it("is empty for a workspace without knowledge", () => {
    expect(tagCatalog(linkFiles({ "a.flo": "entity a\n" }))).toEqual({ typeTags: [], contextTags: [], customTags: {} });
  });
});
```

En `packages/core/src/index.test.ts`, agregar `query` y `tagCatalog` al
import de `./index.js` (y los tipos `QueryResult`, `TagCatalog` como
`type`), y al final del `describe("index: navigation surface (Fase E)")`
(después del test "links and renders a complete knowledge workspace through
the public API"):

```ts
  it("queries a knowledge workspace through the public API", () => {
    const workspace = new Workspace();
    workspace.setDocument(SCHEMA_URI, "type_tags: [decision]\nrelation_types: [affects]\n");
    workspace.setDocument("catalogo.flo", "entity api\n");
    workspace.setDocument(
      "pkce.md",
      '---\nid: pkce\ntitle: PKCE\nmemory_type: long_term\ntype_tags: [decision]\nuse: ["./catalogo.flo"]\nrelations:\n  - target: api\n    type: affects\n---\n'
    );
    const link = workspace.link();

    const result: QueryResult = query(link, { where: { typeTag: "decision" }, depth: 1 });
    expect(result.nodes.map((node) => [node.id, node.distance])).toEqual([["pkce", 0], ["api", 1]]);
    expect(result.edges).toEqual([{ from: "pkce", to: "api", type: "affects" }]);
    const tags: TagCatalog = tagCatalog(link);
    expect(tags.typeTags).toEqual(["decision"]);
  });
```

- [x] **Step 2: Correr y verlos fallar**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/query.test.ts src/index.test.ts`
Expected: FAIL — `tagCatalog` no se exporta / `query` no está en `./index.js`.

- [x] **Step 3: Implementar `tagCatalog` en `workspace/query.ts`**

```ts
export interface TagCatalog {
  typeTags: string[];
  contextTags: string[];
  customTags: Record<string, CustomTagValue[]>; // valores distintos por clave
}

/** Vocabulario en uso por las declaraciones ganadoras, en orden del catálogo y sin repetir. */
export function tagCatalog(link: LinkResult): TagCatalog {
  const typeTags = new Set<string>();
  const contextTags = new Set<string>();
  // Map y no objeto: una clave "constructor" no debe leer Object.prototype.
  const customTags = new Map<string, CustomTagValue[]>();
  for (const { knowledge } of link.entities.values()) {
    if (!knowledge) continue;
    for (const tag of knowledge.typeTags) typeTags.add(tag);
    for (const tag of knowledge.contextTags) contextTags.add(tag);
    for (const [key, value] of Object.entries(knowledge.customTags)) {
      const values = customTags.get(key) ?? [];
      if (!values.includes(value)) values.push(value);
      customTags.set(key, values);
    }
  }
  return { typeTags: [...typeTags], contextTags: [...contextTags], customTags: Object.fromEntries(customTags) };
}
```

- [x] **Step 4: Exportar en `packages/core/src/index.ts`**

Después de la línea `export type { XRefIndex, BlockId, Location } from "./workspace/xref.js";`:

```ts
export { query, tagCatalog } from "./workspace/query.js";
export type {
  Where,
  Projection,
  QueryOptions,
  QueryNode,
  QueryEdge,
  QueryResult,
  TagCatalog,
} from "./workspace/query.js";
```

- [x] **Step 5: Correr y verlos pasar**

Run: `pnpm --filter @flo/core exec vitest run src/workspace/query.test.ts src/index.test.ts`
Expected: PASS.

Si el test de `constructor` falla porque K1 no guarda la clave
`constructor`/`toString` en `customTags` (lo parsea `parser/markdown.ts`),
reportarlo como hallazgo en vez de cambiar el parser en esta task.

- [x] **Step 6: Verificación completa (desde la raíz)**

Run: `pnpm --filter @flo/core build && pnpm -r typecheck && pnpm -r test && pnpm -r build`
Expected: todo verde; `git status` no lista `__snapshots__`.

- [x] **Step 7: Commit**

```bash
git add packages/core/src/workspace/query.ts packages/core/src/workspace/query.test.ts \
  packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): tagCatalog y API pública de consultas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
