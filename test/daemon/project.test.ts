// Project resolution and Node guard (PLAN-002 S7; REQ-001, NFR-006).
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nodeVersionError } from "../../src/cli/node-version.js";
import { resolveProject } from "../../src/daemon/project.js";

let dir: string;

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), "ai-submind-project-")));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("resolveProject", () => {
  it("uses the git toplevel from a subdirectory", async () => {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    await mkdir(join(dir, "a", "b"), { recursive: true });
    const p = await resolveProject(join(dir, "a", "b"));
    expect(p).toEqual({
      root: dir,
      knowledge: join(dir, "knowledge"),
      local: join(dir, "knowledge", ".ai-submind"),
    });
  });

  it("uses the cwd outside a git repository", async () => {
    await mkdir(join(dir, "sub"));
    const p = await resolveProject(join(dir, "sub"));
    expect(p.root).toBe(join(dir, "sub"));
    expect(p.knowledge).toBe(join(dir, "sub", "knowledge"));
  });

  it("resolves --knowledge relative to the cwd, inside the root", async () => {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    await mkdir(join(dir, "docs"));
    const p = await resolveProject(join(dir, "docs"), "kb");
    expect(p.knowledge).toBe(join(dir, "docs", "kb"));
  });

  it("rejects --knowledge outside the root", async () => {
    await mkdir(join(dir, "repo"));
    execFileSync("git", ["init", "-q"], { cwd: join(dir, "repo") });
    await expect(resolveProject(join(dir, "repo"), "../elsewhere")).rejects.toThrow(
      /outside the project root/,
    );
    await expect(resolveProject(join(dir, "repo"), tmpdir())).rejects.toThrow(
      /outside the project root/,
    );
  });
});

describe("resolveProject confinement through symbolic links", () => {
  beforeEach(async () => {
    await mkdir(join(dir, "repo"));
    await mkdir(join(dir, "outside"));
  });

  it("rejects knowledge/ as a link to a directory outside the root", async () => {
    await symlink(join(dir, "outside"), join(dir, "repo", "knowledge"));
    await expect(resolveProject(join(dir, "repo"))).rejects.toThrow(/outside the project root/);
  });

  it("rejects knowledge/ as a dangling link pointing outside the root", async () => {
    await symlink(join(dir, "outside", "missing"), join(dir, "repo", "knowledge"));
    await expect(resolveProject(join(dir, "repo"))).rejects.toThrow(/outside the project root/);
    await symlink("../outside/missing", join(dir, "repo", "kb"));
    await expect(resolveProject(join(dir, "repo"), "kb/sub")).rejects.toThrow(
      /outside the project root/,
    );
  });

  it("accepts a link that stays inside the root", async () => {
    await mkdir(join(dir, "repo", "real"));
    await symlink("real", join(dir, "repo", "knowledge"));
    expect((await resolveProject(join(dir, "repo"))).knowledge).toBe(join(dir, "repo", "real"));
  });

  it("rejects --knowledge equal to the root", async () => {
    await expect(resolveProject(join(dir, "repo"), ".")).rejects.toThrow(
      /must not be the project root/,
    );
  });
});

describe("nodeVersionError", () => {
  it("accepts Node 22 and later, rejects older", () => {
    expect(nodeVersionError("22.13.0")).toBeUndefined();
    expect(nodeVersionError("26.1.0")).toBeUndefined();
    expect(nodeVersionError("20.18.1")).toMatch(/requires Node.js 22 or later \(found 20.18.1\)/);
    expect(nodeVersionError("garbage")).toBeDefined();
  });
});
