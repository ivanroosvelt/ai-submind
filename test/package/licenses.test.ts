// Licence and native-code audit of the production dependency tree (PLAN-002 S12; NFR-009, NFR-001):
// every installed runtime dependency has an allowed licence and nothing compiles or runs install scripts.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../", import.meta.url));

/** Permissive licences only. @joint/core (MPL-2.0) is a dev dependency bundled into dist/ui with its notice. */
const ALLOWED = new Set(["MIT", "ISC", "Apache-2.0", "BSD-3-Clause"]);

interface Manifest {
  name: string;
  license?: unknown;
  gypfile?: boolean;
  scripts?: Record<string, string>;
}

// `npm ls --parseable` prints the root first, then one directory per installed production package.
const dirs = [
  ...new Set(
    // npm is a .cmd shim on Windows, which Node only starts through a shell (NFR-001).
    (process.platform === "win32"
      ? execFileSync("npm ls --omit=dev --all --parseable", {
          cwd: REPO,
          encoding: "utf8",
          shell: true,
        })
      : execFileSync("npm", ["ls", "--omit=dev", "--all", "--parseable"], {
          cwd: REPO,
          encoding: "utf8",
        })
    )
      .trim()
      .split(/\r?\n/)
      .slice(1),
  ),
];
const packages = dirs.map((dir) => ({
  dir,
  pkg: JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest,
}));

describe("production dependencies (NFR-009, NFR-001)", () => {
  it("are found", () => {
    expect(packages.map((p) => p.pkg.name)).toContain("@dagrejs/dagre");
  });

  it("have allowed licences", () => {
    const bad = packages
      .filter(({ pkg }) => {
        return typeof pkg.license !== "string" || !ALLOWED.has(pkg.license);
      })
      .map(({ pkg }) => `${pkg.name}: ${JSON.stringify(pkg.license)}`);
    expect(bad).toEqual([]);
  });

  it("have no native code or install scripts", () => {
    const bad = packages
      .filter(
        ({ dir, pkg }) =>
          pkg.gypfile === true ||
          existsSync(join(dir, "binding.gyp")) ||
          ["preinstall", "install", "postinstall"].some((s) => pkg.scripts?.[s] !== undefined),
      )
      .map(({ pkg }) => pkg.name);
    expect(bad).toEqual([]);
  });
});
