// Normative corpus of spec/format/examples (PLAN-002 S2/S4): valid documents with no findings and in
// canonical form, invalid ones with exactly the expected set of codes, byte-exact canonicalization; and
// the before/after corpus of every migration guide (DEC-010).
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Engine } from "../../src/engine/index.js";
import { classifyPath, serialize, validateKnowledgeDir } from "../../src/format/index.js";

const EXAMPLES = new URL("../../spec/format/examples/", import.meta.url);
const dir = (rel: string): string => fileURLToPath(new URL(rel, EXAMPLES));

function jsonFiles(root: URL, prefix = ""): string[] {
  return readdirSync(new URL(prefix, root), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? jsonFiles(root, `${prefix}${e.name}/`)
      : e.name.endsWith(".json")
        ? [`${prefix}${e.name}`]
        : [],
  );
}

const invalidCases = readdirSync(new URL("invalid/", EXAMPLES)).sort();

describe("valid corpus: garage", () => {
  const root = new URL("valid/garage/knowledge/", EXAMPLES);

  it("produces no errors or warnings", async () => {
    const report = await validateKnowledgeDir(fileURLToPath(root));
    expect(report.findings).toEqual([]);
    expect(report.documents.map((d) => d.status)).toEqual(report.documents.map(() => "writable"));
  });

  it.each(jsonFiles(root))("%s is in canonical form", (rel) => {
    const kind = classifyPath(rel);
    if (kind === undefined) throw new Error(`unclassifiable path: ${rel}`);
    const text = readFileSync(new URL(rel, root), "utf8");
    expect(serialize(kind, JSON.parse(text))).toBe(text);
  });
});

describe("invalid corpus", () => {
  it("covers the versioned cases", () => {
    expect(invalidCases.length).toBeGreaterThanOrEqual(33);
  });

  it.each(invalidCases)("%s produces exactly its expected codes", async (name) => {
    const expected = JSON.parse(readFileSync(dir(`invalid/${name}/expected.json`), "utf8")) as {
      codes: string[];
    };
    const report = await validateKnowledgeDir(dir(`invalid/${name}/knowledge/`));
    const codes = [...new Set(report.findings.map((f) => f.code))].sort();
    expect(codes).toEqual(expected.codes);
  });
});

describe("canonicalization", () => {
  const input = new URL("canonical/input/", EXAMPLES);
  const expectedDir = new URL("canonical/expected/", EXAMPLES);

  it("covers model, manifest and sequence inputs", () => {
    expect(jsonFiles(input).sort()).toEqual(
      ["ai-submind.json", "models/orders.json", "models/sequence.json"].sort(),
    );
  });

  it.each(jsonFiles(input))("%s rewritten matches expected byte for byte", (rel) => {
    const kind = classifyPath(rel);
    if (kind === undefined) throw new Error(`unclassifiable path: ${rel}`);
    const out = serialize(kind, JSON.parse(readFileSync(new URL(rel, input), "utf8")));
    expect(out).toBe(readFileSync(new URL(rel, expectedDir), "utf8"));
    expect(serialize(kind, JSON.parse(out))).toBe(out);
  });

  it("canonical/input and canonical/expected are valid", async () => {
    for (const root of [input, expectedDir]) {
      const report = await validateKnowledgeDir(fileURLToPath(root));
      expect(report.findings).toEqual([]);
    }
  });
});

describe("migration guides (DEC-010)", () => {
  const MIGRATIONS = new URL("../../spec/format/migrations/", import.meta.url);
  const hops = readdirSync(MIGRATIONS).sort();

  it("ship a guide for 1.0 → 1.1", () => {
    expect(hops).toContain("1.0-to-1.1");
  });

  it.each(hops)("%s: before is valid and outdated, after is valid, both canonical", async (hop) => {
    for (const side of ["before", "after"]) {
      const root = new URL(`${hop}/examples/${side}/knowledge/`, MIGRATIONS);
      const report = await validateKnowledgeDir(fileURLToPath(root));
      const files = jsonFiles(root);
      expect(report.findings.map((f) => [f.code, f.file])).toEqual(
        side === "before" ? files.sort().map((f) => ["FORMAT_VERSION_OUTDATED", f]) : [],
      );
      for (const rel of files) {
        const text = readFileSync(new URL(rel, root), "utf8");
        expect(serialize(classifyPath(rel) ?? "model", JSON.parse(text))).toBe(text);
      }
    }
  });

  it.each(hops)("%s: migrate turns before into after byte for byte", async (hop) => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-submind-migrate-"));
    try {
      const k = join(tmp, "knowledge");
      await cp(fileURLToPath(new URL(`${hop}/examples/before/knowledge/`, MIGRATIONS)), k, {
        recursive: true,
      });
      const after = new URL(`${hop}/examples/after/knowledge/`, MIGRATIONS);
      const e = await Engine.open(k);
      const r = await e.migrate();
      expect(r.migrated).toEqual(jsonFiles(after).sort());
      for (const rel of jsonFiles(after)) {
        expect(await readFile(join(k, rel), "utf8")).toBe(
          readFileSync(new URL(rel, after), "utf8"),
        );
      }
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
