// Text normalization for lexical search (PLAN-002 S6): accent- and case-insensitive folding and a
// tokenizer that also splits identifiers written in camelCase.

const MARKS = /\p{M}/gu;
const RUNS = /[\p{L}\p{N}]+/gu;
const UPPER = /[\p{Lu}\p{Lt}]/u;
const LOWER = /\p{Ll}/u;
const DIGIT = /\p{N}/u;

const stripMarks = (s: string): string => s.normalize("NFKD").replace(MARKS, "");

/** Compatibility decomposition, combining marks removed and lowercase ("Año" → "ano", "ﬁ" → "fi"). */
export function fold(s: string): string {
  // Lowercasing can introduce marks again ("İ" → "i̇"), so they are stripped after it as well.
  return stripMarks(stripMarks(s).toLowerCase());
}

/**
 * Parts of a run split at lower→Upper ("yearOf"), ACRONYM→Word ("HTTPServer") and letter↔digit
 * ("Server2") boundaries.
 */
function camelParts(run: string): string[] {
  const chars = Array.from(run);
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i < chars.length; i++) {
    const prev = chars[i - 1] ?? "";
    const cur = chars[i] ?? "";
    const next = chars[i + 1] ?? "";
    const digitEdge = DIGIT.test(prev) !== DIGIT.test(cur);
    const lowerUpper = LOWER.test(prev) && UPPER.test(cur);
    const acronymWord = UPPER.test(prev) && UPPER.test(cur) && LOWER.test(next);
    if (digitEdge || lowerUpper || acronymWord) {
      parts.push(chars.slice(start, i).join(""));
      start = i;
    }
  }
  parts.push(chars.slice(start).join(""));
  return parts;
}

/**
 * Terms of a text: each run of letters and digits (after removing combining marks), folded, followed
 * by its folded camelCase parts when it has more than one. Repetitions are kept (term frequency).
 */
export function tokenize(s: string): string[] {
  const out: string[] = [];
  for (const [run] of stripMarks(s).matchAll(RUNS)) {
    out.push(fold(run));
    const parts = camelParts(run);
    if (parts.length > 1) for (const p of parts) out.push(fold(p));
  }
  return out;
}
