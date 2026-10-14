// Semantic diff between two states of knowledge/ (DEC-004): IDs added, removed or changed, and the
// documents whose content changed.
import { compareCodeUnits } from "../format/canonical.js";
import type { IndexedElement } from "../format/semantic.js";

export interface SemanticDiff {
  added: string[];
  removed: string[];
  /** IDs whose content, type or location changed (an element changes with its nested elements). */
  changed: string[];
  /** Paths created, deleted or modified on disk. */
  documents: string[];
}

// Without the pointer: inserting an item shifts the indices of its siblings without changing them.
const signature = (list: readonly IndexedElement[]): string =>
  JSON.stringify(list.map((x) => [x.type, x.file, x.node]));

export function semanticDiff(
  before: ReadonlyMap<string, readonly IndexedElement[]>,
  after: ReadonlyMap<string, readonly IndexedElement[]>,
  documents: readonly string[],
): SemanticDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [id, list] of after) {
    const prev = before.get(id);
    if (!prev) added.push(id);
    else if (signature(prev) !== signature(list)) changed.push(id);
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);
  return {
    added: added.sort(compareCodeUnits),
    removed: removed.sort(compareCodeUnits),
    changed: changed.sort(compareCodeUnits),
    documents: [...documents].sort(compareCodeUnits),
  };
}

export const isEmptyDiff = (d: SemanticDiff): boolean =>
  d.added.length + d.removed.length + d.changed.length + d.documents.length === 0;
