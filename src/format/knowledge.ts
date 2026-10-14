// Validation of a whole knowledge/: confined directory reading, phases 1–3 per document and phase 4 over
// the set (spec §10).
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { compareCodeUnits } from "./canonical.js";
import { classifyPath, isLoaded, parseDocument, type ParsedDocument } from "./document.js";
import { finding, type Finding } from "./findings.js";
import { schemas, type SchemaSet } from "./schema.js";
import { checkKnowledge, type SemanticOptions } from "./semantic.js";

/** Directory of local derived data: ignored by git and by the validator (spec §2). */
export const LOCAL_DIR = ".ai-submind";

/** Directories that may contain documents (spec §2); any other directory is `UNKNOWN_FILE`. */
const DOCUMENT_DIRS = new Set(["models", "layout"]);

export interface KnowledgeFile {
  /** Path relative to knowledge/, with `/`. */
  path: string;
  bytes: Uint8Array;
}

export interface KnowledgeReport {
  documents: ParsedDocument[];
  /** All findings, sorted by file, pointer and code. */
  findings: Finding[];
}

const inside = (root: string, target: string): boolean => {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/**
 * Absolute path of `rel` inside `root`, or `PATH_OUTSIDE_KNOWLEDGE` if it is absolute, uses `\` or leaves
 * knowledge/ through `..`. Symbolic links are not resolved here (directory reading does that).
 */
export function resolveKnowledgePath(root: string, rel: string): string | Finding {
  const segments = rel.split("/");
  if (
    rel === "" ||
    rel.startsWith("/") ||
    rel.includes("\\") ||
    isAbsolute(rel) ||
    segments.some((s) => s === "" || s === "." || s === "..")
  ) {
    return finding(
      "PATH_OUTSIDE_KNOWLEDGE",
      rel,
      "",
      "path must be relative to knowledge/ and contain no empty, . or .. segments",
    );
  }
  return join(root, ...segments);
}

/**
 * Reads the files of knowledge/ without leaving it: symbolic links that point outside knowledge/ or into
 * the local directory are reported and not read; unexpected directories are reported and not walked.
 */
export async function readKnowledgeDir(
  root: string,
): Promise<{ files: KnowledgeFile[]; findings: Finding[] }> {
  const realRoot = await realpath(root);
  const localDir = join(realRoot, LOCAL_DIR);
  const files: KnowledgeFile[] = [];
  const findings: Finding[] = [];
  const unknown = (rel: string, message: string): void => {
    findings.push(finding("UNKNOWN_FILE", rel, "", message));
  };
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => compareCodeUnits(a.name, b.name));
    for (const e of entries) {
      const rel = prefix === "" ? e.name : `${prefix}/${e.name}`;
      if (rel === LOCAL_DIR) continue;
      const abs = join(dir, e.name);
      if (e.isSymbolicLink()) {
        let target: string;
        try {
          target = await realpath(abs);
        } catch {
          unknown(rel, "broken symbolic link");
          continue;
        }
        if (!inside(realRoot, target)) {
          findings.push(
            finding("PATH_OUTSIDE_KNOWLEDGE", rel, "", "symbolic link pointing outside knowledge/"),
          );
        } else if (inside(localDir, target)) {
          unknown(rel, `symbolic link into ${LOCAL_DIR}/: not read`);
        } else if (!(await stat(target)).isFile()) {
          unknown(rel, "symbolic link to something that is not a regular file: not read");
        } else {
          files.push({ path: rel, bytes: await readFile(target) });
        }
      } else if (e.isDirectory()) {
        if (prefix === "" && DOCUMENT_DIRS.has(e.name)) await walk(abs, rel);
        else unknown(rel, "unexpected directory in knowledge/: not walked");
      } else if (e.isFile()) {
        files.push({ path: rel, bytes: await readFile(abs) });
      } else {
        unknown(rel, "entry is not a regular file");
      }
    }
  };
  await walk(realRoot, "");
  return { files, findings };
}

const byLocation = (a: Finding, b: Finding): number =>
  compareCodeUnits(a.file, b.file) ||
  compareCodeUnits(a.pointer, b.pointer) ||
  compareCodeUnits(a.code, b.code);

/** Validates a set of knowledge/ files that was already read. */
export function validateFiles(
  files: readonly KnowledgeFile[],
  options: SemanticOptions = {},
  set: SchemaSet = schemas(),
): KnowledgeReport {
  const documents: ParsedDocument[] = [];
  const findings: Finding[] = [];
  for (const f of files) {
    const kind = classifyPath(f.path);
    if (kind === undefined) {
      findings.push(finding("UNKNOWN_FILE", f.path, "", "unexpected file in knowledge/"));
      continue;
    }
    const doc = parseDocument(f.path, kind, f.bytes, set);
    documents.push(doc);
    findings.push(...doc.findings);
  }
  findings.push(...checkKnowledge(documents.filter(isLoaded), options));
  return { documents, findings: findings.sort(byLocation) };
}

/** Reads and validates the knowledge/ directory at `root`. */
export async function validateKnowledgeDir(
  root: string,
  options: SemanticOptions = {},
): Promise<KnowledgeReport> {
  const read = await readKnowledgeDir(root);
  const report = validateFiles(read.files, options);
  return {
    documents: report.documents,
    findings: [...read.findings, ...report.findings].sort(byLocation),
  };
}
