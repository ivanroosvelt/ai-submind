// Project resolution for the CLI and the daemon (REQ-001, NFR-006, DEC-014): root = git toplevel of the
// cwd (or the cwd), knowledge/ confined to the root, and the self-ignored local directory.
import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, readlink, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { LOCAL_DIR } from "../format/knowledge.js";

export interface Project {
  /** Real path of the project root. */
  root: string;
  /** Absolute path of knowledge/ (its existing part resolved to a real path). */
  knowledge: string;
  /** knowledge/.ai-submind/: lock, runtime.json and log. */
  local: string;
}

async function gitRoot(cwd: string): Promise<string> {
  try {
    const { stdout } = await promisify(execFile)("git", ["rev-parse", "--show-toplevel"], { cwd });
    return await realpath(stdout.trim());
  } catch {
    return realpath(cwd); // git missing or not a repository
  }
}

/**
 * Real path of `abs` even if it does not exist yet: existing parts are resolved, and symbolic links are
 * followed even when dangling, so that a link leaving the root is caught by the confinement check.
 */
async function realpathLoose(abs: string, depth = 0): Promise<string> {
  if (depth > 40) throw new Error(`too many symbolic links resolving ${abs}`);
  try {
    return await realpath(abs);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const parent = dirname(abs) === abs ? abs : await realpathLoose(dirname(abs), depth + 1);
  const candidate = join(parent, basename(abs));
  const stats = await lstat(candidate).catch(() => undefined);
  if (stats?.isSymbolicLink() !== true) return candidate;
  return realpathLoose(resolve(parent, await readlink(candidate)), depth + 1);
}

/** Resolves the project from `cwd`; `knowledge` is relative to `cwd` and must stay inside the root. */
export async function resolveProject(cwd: string, knowledge?: string): Promise<Project> {
  const root = await gitRoot(cwd);
  const dir = await realpathLoose(
    knowledge === undefined ? join(root, "knowledge") : resolve(cwd, knowledge),
  );
  const rel = relative(root, dir);
  if (rel === "") throw new Error(`--knowledge must not be the project root itself (${root})`);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(
      `${knowledge === undefined ? "knowledge/ (default)" : `--knowledge ${knowledge}`} resolves to ${dir}, outside the project root ${root}`,
    );
  }
  return { root, knowledge: dir, local: join(dir, LOCAL_DIR) };
}

/**
 * Creates knowledge/.ai-submind/ (owner-only: it holds the token) with a `.gitignore` that ignores
 * everything in it (DEC-014).
 */
export async function ensureLocalDir(project: Project): Promise<void> {
  await mkdir(project.knowledge, { recursive: true });
  await mkdir(project.local, { mode: 0o700 }).catch((e: unknown) => {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  });
  await chmod(project.local, 0o700);
  await writeFile(join(project.local, ".gitignore"), "*\n", { flag: "wx" }).catch((e: unknown) => {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  });
}
