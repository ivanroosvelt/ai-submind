// Rewriting for `rename(old, new)` (spec §3.2): IDs equal to `old` or starting with `old.`, every
// `{"idref"}`, layout map keys and the file names of models and layouts.
import { isObject } from "../format/schema.js";

/** Maps an ID through the rename: `old` → `new`, `old.x` → `new.x`; any other ID is unchanged. */
export function renamer(oldId: string, newId: string): (id: string) => string {
  const prefix = `${oldId}.`;
  return (id) =>
    id === oldId ? newId : id.startsWith(prefix) ? newId + id.slice(oldId.length) : id;
}

const LAYOUT_MAPS = new Set(["nodes", "edges"]);

/** Copy of a document with every ID, reference and layout key mapped through `map`. */
export function rewriteIds(data: unknown, map: (id: string) => string, key?: string): unknown {
  if (Array.isArray(data)) return data.map((x) => rewriteIds(x, map));
  if (!isObject(data)) return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const mapped = key !== undefined && LAYOUT_MAPS.has(key) ? map(k) : k;
    out[mapped] =
      (k === "id" || k === "idref") && typeof v === "string" ? map(v) : rewriteIds(v, map, k);
  }
  return out;
}

/**
 * Path of a document after the rename: a model file follows its model `id` and a layout file its `diagram`,
 * only when the file is named after it (a misnamed file stays: it is already `FILE_ID_MISMATCH`).
 */
export function movedPath(
  path: string,
  doc: { kind: string; data?: unknown },
  map: (id: string) => string,
): string {
  const data = isObject(doc.data) ? doc.data : {};
  const diagram = isObject(data.diagram) ? data.diagram.idref : undefined;
  const own = doc.kind === "model" ? data.id : doc.kind === "layout" ? diagram : undefined;
  if (typeof own !== "string") return path;
  const dir = doc.kind === "model" ? "models" : "layout";
  return path === `${dir}/${own}.json` ? `${dir}/${map(own)}.json` : path;
}
