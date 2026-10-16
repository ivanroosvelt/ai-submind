// Normative corpus of spec/format/examples (PLAN-002 S2/S4): valid documents with no findings and in
// canonical form, invalid ones with exactly the expected set of codes, byte-exact canonicalization.
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
