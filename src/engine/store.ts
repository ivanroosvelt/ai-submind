// Confined file access for engine writes (REQ-008, NFR-006): atomic replacement through a temporary file
// in the local directory, never through symbolic links.
import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LOCAL_DIR, resolveKnowledgePath } from "../format/knowledge.js";
import { EngineError } from "./errors.js";

const TMP_DIR = `${LOCAL_DIR}/tmp`;

const isMissing = (e: unknown): boolean => (e as NodeJS.ErrnoException).code === "ENOENT";

/** Absolute path of a knowledge/ document; rejects paths that escape it (spec §2). */
export function documentPath(root: string, rel: string): string {
  const abs = resolveKnowledgePath(root, rel);
  if (typeof abs !== "string")
    throw new EngineError("PATH_OUTSIDE_KNOWLEDGE", abs.message, { path: rel });
  return abs;
}

/** Fails if `abs` exists and is not a regular file or a directory (as `dir` says), e.g. a symlink. */
async function assertKind(abs: string, rel: string, dir: boolean): Promise<boolean> {
  try {
    const s = await lstat(abs);
    if (s.isSymbolicLink() || (dir ? !s.isDirectory() : !s.isFile())) {
      throw new EngineError(
        "PATH_OUTSIDE_KNOWLEDGE",
        `${rel} is not a ${dir ? "directory" : "regular file"} (symbolic links are not written through)`,
        { path: rel },
      );
    }
    return true;
  } catch (e) {
    if (isMissing(e)) return false;
    throw e;
  }
}

/**
 * Checks the parent directories of `rel` from `root` down, rejecting symbolic links on the way; with
 * `create`, missing ones are created, otherwise the walk stops at the first missing one.
 */
async function walkParents(root: string, rel: string, create: boolean): Promise<void> {
  let abs = root;
  let path = "";
  for (const s of rel.split("/").slice(0, -1)) {
    abs = join(abs, s);
    path = path === "" ? s : `${path}/${s}`;
    if (await assertKind(abs, path, true)) continue;
    if (!create) return;
    await mkdir(abs);
  }
}

/** Current bytes of a document, or `null` if it does not exist. Never follows a symbolic link. */
export async function readDocument(root: string, rel: string): Promise<Uint8Array | null> {
  const abs = documentPath(root, rel);
  await walkParents(root, rel, false);
  try {
    if (!(await assertKind(abs, rel, false))) return null;
    return await readFile(abs);
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

async function syncDir(abs: string): Promise<void> {
  // Directory fsync makes the rename durable; not supported on every platform (e.g. Windows).
  try {
    const fh = await open(abs, "r");
    try {
      await fh.sync();
    } finally {
      await fh.close();
    }
  } catch {
    // best effort
  }
}

/**
 * Atomic replacement of a document: temporary file in `.ai-submind/tmp/` (same file system), fsync and
 * rename. A crash leaves the previous or the new version, never a truncated file (REQ-008).
 */
export async function writeDocument(root: string, rel: string, bytes: Uint8Array): Promise<void> {
  const abs = documentPath(root, rel);
  await walkParents(root, rel, true);
  await assertKind(abs, rel, false);
  await walkParents(root, `${TMP_DIR}/x`, true);
  const tmp = join(root, ...TMP_DIR.split("/"), `${randomUUID()}.tmp`);
  const fh = await open(tmp, "wx", 0o644);
  try {
    await fh.writeFile(bytes);
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await rename(tmp, abs);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
  await syncDir(dirname(abs));
}

export async function deleteDocument(root: string, rel: string): Promise<void> {
  const abs = documentPath(root, rel);
  await walkParents(root, rel, false);
  if (!(await assertKind(abs, rel, false))) return;
  await unlink(abs);
  await syncDir(dirname(abs));
}

/** Removes temporary files left by an interrupted write. */
export async function cleanTemporary(root: string): Promise<void> {
  const local = join(root, LOCAL_DIR);
  if (!(await assertKind(local, LOCAL_DIR, true))) return;
  await rm(join(root, ...TMP_DIR.split("/")), { recursive: true, force: true });
}
