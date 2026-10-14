// Validation and serialization rules not covered by the static corpus in spec/format/examples.
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveKnowledgePath,
  serialize,
  validateFiles,
  validateKnowledgeDir,
  type Finding,
  type KnowledgeFile,
} from "../../src/format/index.js";

const enc = new TextEncoder();
const MANIFEST: KnowledgeFile = {
  path: "ai-submind.json",
  bytes: enc.encode('{"format_version": "1.0"}\n'),
};

function file(path: string, data: unknown): KnowledgeFile {
  return { path, bytes: enc.encode(JSON.stringify(data)) };
}

function model(id: string, elements: unknown, extra: Record<string, unknown> = {}): KnowledgeFile {
  return file(`models/${id}.json`, { format_version: "1.0", id, name: id, elements, ...extra });
}

const cls = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  visibility: "public",
  ...extra,
});

const codes = (findings: Finding[]): string[] => [...new Set(findings.map((f) => f.code))].sort();

function check(...files: KnowledgeFile[]): Finding[] {
  return validateFiles([MANIFEST, ...files]).findings;
}

/** Minimal interaction with two lifelines and one complete message between them. */
function interaction(id: string, extraFragments: unknown[] = []) {
  return {
    id,
    name: id,
    visibility: "public",
    lifelines: [
      { id: `${id}.a`, name: "a" },
      { id: `${id}.b`, name: "b" },
    ],
    messages: [
      {
        id: `${id}.m`,
        name: "m",
        sort: "synch_call",
        kind: "complete",
        send_event: { idref: `${id}.m.send` },
        receive_event: { idref: `${id}.m.receive` },
      },
    ],
    fragments: [
      { id: `${id}.m.send`, type: "occurrence", covered: { idref: `${id}.a` } },
      { id: `${id}.m.receive`, type: "occurrence", covered: { idref: `${id}.b` } },
      ...extraFragments,
    ],
  };
}

describe("phase 1: file", () => {
  it("invalid UTF-8 without BOM is FILE_ENCODING", () => {
    const bad = { path: "models/m.json", bytes: new Uint8Array([0x7b, 0xff, 0x7d]) };
    expect(codes(check(bad))).toEqual(["FILE_ENCODING"]);
  });

  it("a conflict marker after U+2028 inside a string is not MERGE_CONFLICT", () => {
    const lineSeparator = String.fromCharCode(0x2028);
    const text = `{"format_version": "1.0", "id": "m", "name": "a${lineSeparator}=======b"}`;
    expect(check({ path: "models/m.json", bytes: enc.encode(text) })).toEqual([]);
  });

  it("a conflict marker at the start of the file or of a line is MERGE_CONFLICT", () => {
    for (const text of ["<<<<<<< HEAD\n{}", '{\n=======\n"x": 1}']) {
      expect(codes(check({ path: "models/m.json", bytes: enc.encode(text) }))).toEqual([
        "MERGE_CONFLICT",
      ]);
    }
  });

  it("unloaded document: references to its IDs become REF_UNRESOLVED", () => {
    const broken = {
      path: "models/types.json",
      bytes: enc.encode('{"format_version": "1.0", "id": "types",'),
    };
    const user = model("m", {
      classes: [
        cls("A", {
          attributes: [{ id: "A.x", name: "x", visibility: "public", type: { idref: "Int" } }],
        }),
      ],
    });
    expect(codes(check(broken, user))).toEqual(["JSON_PARSE", "REF_UNRESOLVED"]);
  });

  it("resolveKnowledgePath rejects absolute paths, `..`, `\\` and empty segments", () => {
    for (const rel of [
      "/etc/passwd",
      "../x.json",
      "models/../../x",
      "models\\m.json",
      "models//m.json",
      "./m.json",
      "",
    ]) {
      const r = resolveKnowledgePath("/repo/knowledge", rel);
      expect(typeof r === "string" ? r : r.code, rel).toBe("PATH_OUTSIDE_KNOWLEDGE");
    }
    expect(resolveKnowledgePath("/repo/knowledge", "models/m.json")).toBe(
      "/repo/knowledge/models/m.json",
    );
  });

  describe("directory reading", () => {
    let tmp = "";
    let k = "";
    beforeEach(async () => {
      tmp = await mkdtemp(join(tmpdir(), "ai-submind-"));
      k = join(tmp, "knowledge");
      await mkdir(join(k, "models"), { recursive: true });
      await mkdir(join(k, ".ai-submind"));
      await writeFile(join(k, "ai-submind.json"), '{\n  "format_version": "1.0"\n}\n');
      await writeFile(join(k, ".ai-submind", "cache.json"), '{"format_version": "1.0"}');
    });
    afterEach(async () => {
      await rm(tmp, { recursive: true, force: true });
    });

    const result = async () => {
      const report = await validateKnowledgeDir(k);
      return {
        findings: report.findings.map((f) => [f.code, f.file]),
        documents: report.documents.map((d) => d.path),
      };
    };

    it("a link pointing outside knowledge/ is PATH_OUTSIDE_KNOWLEDGE and is not read", async () => {
      await writeFile(
        join(tmp, "outside.json"),
        '{"format_version": "1.0", "id": "outside", "name": "O"}',
      );
      await symlink(join(tmp, "outside.json"), join(k, "models", "outside.json"));
      expect(await result()).toEqual({
        findings: [["PATH_OUTSIDE_KNOWLEDGE", "models/outside.json"]],
        documents: ["ai-submind.json"],
      });
    });

    it("links into .ai-submind/, to directories and broken links are UNKNOWN_FILE and not read", async () => {
      await symlink(join(k, ".ai-submind", "cache.json"), join(k, "models", "cache.json"));
      await symlink(join(k, "models"), join(k, "models", "loop.json"));
      await symlink(join(k, "missing.json"), join(k, "models", "broken.json"));
      expect(await result()).toEqual({
        findings: [
          ["UNKNOWN_FILE", "models/broken.json"],
          ["UNKNOWN_FILE", "models/cache.json"],
          ["UNKNOWN_FILE", "models/loop.json"],
        ],
        documents: ["ai-submind.json"],
      });
    });

    it("unexpected directories, even empty or nested, are UNKNOWN_FILE and not walked", async () => {
      await mkdir(join(k, "notes"));
      await mkdir(join(k, "models", "sub"));
      await writeFile(join(k, "models", "sub", "x.json"), "{}");
      expect(await result()).toEqual({
        findings: [
          ["UNKNOWN_FILE", "models/sub"],
          ["UNKNOWN_FILE", "notes"],
        ],
        documents: ["ai-submind.json"],
      });
    });

    it.skipIf(process.platform === "win32")("a FIFO is UNKNOWN_FILE and is not read", async () => {
      execFileSync("mkfifo", [join(k, "models", "pipe.json")]);
      expect(await result()).toEqual({
        findings: [["UNKNOWN_FILE", "models/pipe.json"]],
        documents: ["ai-submind.json"],
      });
    });
  });
});

describe("phase 2: version", () => {
  it("earlier version without migration: read-only", () => {
    const m = model("m", { classes: [cls("A")] }, { format_version: "0.9" });
    const report = validateFiles([MANIFEST, m]);
    expect(codes(report.findings)).toEqual(["FORMAT_VERSION_UNSUPPORTED"]);
    expect(report.documents.find((d) => d.path === "models/m.json")?.status).toBe("read_only");
  });

  it("tolerant reading drops unknown keys and items and takes part in phase 4", () => {
    const future = model(
      "future",
      {
        classes: [cls("A", { color: "red" }), { id: "B", name: "B", visibility: "galactic" }],
        widgets: [{ id: "W" }],
      },
      { format_version: "1.3", novelty: true },
    );
    const other = model("m", { classes: [cls("A")] });
    const report = validateFiles([MANIFEST, future, other]);
    const doc = report.documents.find((d) => d.path === "models/future.json");
    expect(doc?.status).toBe("read_only");
    expect(doc?.data).toEqual({
      format_version: "1.3",
      id: "future",
      name: "future",
      elements: { classes: [cls("A")] },
    });
    expect(codes(report.findings)).toEqual(["FORMAT_VERSION_UNSUPPORTED", "ID_DUPLICATE"]);
  });

  it("phase-4 pointers of a read-only document refer to the file as read", () => {
    const dropped = { id: "bad id", name: "X", visibility: "public" };
    const c = cls("C", {
      attributes: [
        { id: "C.drop", name: "drop", visibility: "unknown" },
        { id: "C.x", name: "x", visibility: "public", type: { idref: "Missing" } },
      ],
    });
    const i = interaction("I", [{ id: "I.weird", type: "teleport" }]);
    i.fragments.unshift({ id: "I.future", type: "hologram" });
    const future = model(
      "future",
      { classes: [dropped, c], interactions: [i] },
      { format_version: "2.0" },
    );
    const f = check(future).filter((x) => x.code !== "FORMAT_VERSION_UNSUPPORTED");
    expect(f.map((x) => [x.code, x.pointer])).toEqual([
      ["REF_UNRESOLVED", "/elements/classes/1/attributes/1/type"],
    ]);
    const occurrence = interaction("J");
    occurrence.fragments.unshift({ id: "J.future", type: "hologram" });
    occurrence.fragments.push({ id: "J.lonely", type: "occurrence", covered: { idref: "J.a" } });
    const g = check(model("later", { interactions: [occurrence] }, { format_version: "2.0" }));
    expect(g.filter((x) => x.code === "OCCURRENCE_UNUSED").map((x) => x.pointer)).toEqual([
      "/elements/interactions/0/fragments/3",
    ]);
  });

  it("tolerant reading of a layout keeps valid entries and reports orphans by original key", () => {
    const m = model(
      "m",
      { classes: [cls("A")] },
      { diagrams: [{ id: "c", kind: "class", name: "C", elements: [{ idref: "A" }] }] },
    );
    const layout = file("layout/c.json", {
      format_version: "1.1",
      diagram: { idref: "c" },
      nodes: { A: { x: 1, y: 2, glow: true }, Z: { x: 0, y: 0 }, Q: { x: 0.5, y: 0 } },
    });
    const report = validateFiles([MANIFEST, m, layout]);
    expect(report.documents.find((d) => d.path === "layout/c.json")?.data).toEqual({
      format_version: "1.1",
      diagram: { idref: "c" },
      nodes: { A: { x: 1, y: 2 }, Z: { x: 0, y: 0 } },
    });
    expect(report.findings.map((x) => [x.code, x.pointer])).toEqual([
      ["FORMAT_VERSION_UNSUPPORTED", "/format_version"],
      ["LAYOUT_ORPHAN", "/nodes/Z"],
    ]);
  });
});

describe("phase 4: references and semantics", () => {
  it("covered and events must belong to the same interaction", () => {
    const i1 = interaction("I1");
    const i2 = interaction("I2", [{ id: "I2.x", type: "occurrence", covered: { idref: "I1.a" } }]);
    i2.messages[0] = {
      ...i2.messages[0],
      receive_event: { idref: "I1.m.receive" },
    } as (typeof i2.messages)[0];
    const f = check(model("m", { interactions: [i1, i2] }));
    expect(f.filter((x) => x.code === "REF_TYPE_MISMATCH").map((x) => x.pointer)).toEqual([
      "/elements/interactions/1/fragments/2/covered",
      "/elements/interactions/1/messages/0/receive_event",
    ]);
  });

  it("interaction_use cannot reference its own interaction", () => {
    const use = {
      id: "I.ref--I",
      type: "interaction_use",
      covered: [{ idref: "I.a" }],
      interaction: { idref: "I" },
    };
    expect(codes(check(model("m", { interactions: [interaction("I", [use])] })))).toEqual([
      "REF_TYPE_MISMATCH",
    ]);
  });

  it("a dependency on a diagram is REF_TYPE_MISMATCH; on an attribute it is valid", () => {
    const elements = {
      classes: [cls("A", { attributes: [{ id: "A.x", name: "x", visibility: "public" }] })],
      dependencies: [
        { id: "A--uses--view", client: { idref: "A" }, supplier: { idref: "view" } },
        { id: "A--uses--A.x", client: { idref: "A" }, supplier: { idref: "A.x" } },
      ],
    };
    const f = check(model("m", elements, { diagrams: [{ id: "view", kind: "class", name: "V" }] }));
    expect(f.map((x) => [x.code, x.pointer])).toEqual([
      ["REF_TYPE_MISMATCH", "/elements/dependencies/0/supplier"],
    ]);
  });

  it("a generalization of an element to itself is GENERALIZATION_CYCLE", () => {
    const elements = {
      classes: [cls("A")],
      generalizations: [{ id: "g", specific: { idref: "A" }, general: { idref: "A" } }],
    };
    expect(codes(check(model("m", elements)))).toEqual(["GENERALIZATION_CYCLE"]);
  });

  it("a generalization across different collections is REF_TYPE_MISMATCH", () => {
    const elements = {
      classes: [cls("A")],
      interfaces: [cls("I")],
      generalizations: [{ id: "g", specific: { idref: "A" }, general: { idref: "I" } }],
    };
    expect(codes(check(model("m", elements)))).toEqual(["REF_TYPE_MISMATCH"]);
  });

  it("a package cycle is PACKAGE_MEMBERSHIP; a chain without a cycle is valid", () => {
    const pkg = (id: string, members: string[]) => ({
      ...cls(id),
      members: members.map((m) => ({ idref: m })),
    });
    const cycle = check(model("m", { packages: [pkg("P", ["Q"]), pkg("Q", ["P"])] }));
    expect(codes(cycle)).toEqual(["PACKAGE_MEMBERSHIP"]);
    expect(
      check(model("m", { packages: [pkg("P", ["Q"]), pkg("Q", ["R"]), pkg("R", [])] })),
    ).toEqual([]);
  });

  it("references to a duplicated ID are not type-checked (already ID_DUPLICATE)", () => {
    const elements = {
      classes: [cls("A"), cls("B")],
      interfaces: [cls("A")],
      realizations: [{ id: "r", client: { idref: "B" }, supplier: { idref: "A" } }],
    };
    expect(codes(check(model("m", elements)))).toEqual(["ID_DUPLICATE"]);
  });

  it("layout: a relation key in nodes is LAYOUT_ORPHAN; a missing diagram is REF_UNRESOLVED", () => {
    const elements = {
      classes: [cls("A"), cls("B")],
      generalizations: [{ id: "B--extends--A", specific: { idref: "B" }, general: { idref: "A" } }],
    };
    const diagrams = [
      {
        id: "c",
        kind: "class",
        name: "C",
        elements: [{ idref: "A" }, { idref: "B" }, { idref: "B--extends--A" }],
      },
    ];
    const layout = file("layout/c.json", {
      format_version: "1.0",
      diagram: { idref: "c" },
      nodes: { A: { x: 0, y: 0 }, "B--extends--A": { x: 1, y: 1 } },
      edges: { "B--extends--A": { vertices: [{ x: 5, y: 5 }] } },
    });
    const ghost = file("layout/nothing.json", {
      format_version: "1.0",
      diagram: { idref: "nothing" },
      nodes: { A: { x: 0, y: 0 } },
    });
    const f = check(model("m", elements, { diagrams }), layout, ghost);
    expect(f.map((x) => [x.code, x.file, x.pointer])).toEqual([
      ["LAYOUT_ORPHAN", "layout/c.json", "/nodes/B--extends--A"],
      ["REF_UNRESOLVED", "layout/nothing.json", "/diagram"],
    ]);
  });

  it("CODE_REF_MISSING only with the host's existence check", () => {
    const m = model("m", {
      classes: [cls("A", { code_refs: [{ path: "src/a.ts" }, { path: "src/b.ts", symbol: "B" }] })],
    });
    expect(validateFiles([MANIFEST, m]).findings).toEqual([]);
    const f = validateFiles([MANIFEST, m], { codeRefExists: (p) => p === "src/a.ts" }).findings;
    expect(f.map((x) => [x.code, x.severity, x.pointer])).toEqual([
      ["CODE_REF_MISSING", "warning", "/elements/classes/0/code_refs/1/path"],
    ]);
  });

  it("n..* and * are valid; inverted bounds, also beyond 2^53, are MULTIPLICITY_INVALID", () => {
    const elements = {
      classes: [
        cls("A", {
          attributes: [
            { id: "A.x", name: "x", visibility: "public", multiplicity: "1..*" },
            {
              id: "A.big",
              name: "big",
              visibility: "public",
              multiplicity: "99999999999999999999..99999999999999999998",
            },
          ],
          operations: [
            {
              id: "A.f()",
              name: "f",
              visibility: "public",
              parameters: [{ id: "A.f().p", name: "p", multiplicity: "2..1" }],
            },
          ],
        }),
      ],
      associations: [
        {
          id: "A--A",
          type: "association",
          direction: "undirected",
          end1: { id: "A--A.end1", element: { idref: "A" }, multiplicity: "*" },
          end2: { id: "A--A.end2", element: { idref: "A" }, multiplicity: "10..9" },
        },
      ],
    };
    const f = check(model("m", elements));
    expect(f.map((x) => [x.code, x.pointer])).toEqual([
      ["MULTIPLICITY_INVALID", "/elements/associations/0/end2/multiplicity"],
      ["MULTIPLICITY_INVALID", "/elements/classes/0/attributes/1/multiplicity"],
      ["MULTIPLICITY_INVALID", "/elements/classes/0/operations/0/parameters/0/multiplicity"],
    ]);
  });
});

describe("canonical serialization", () => {
  it("JSON.stringify escapes, literal Unicode and single-line references", () => {
    const m = {
      format_version: "1.0",
      id: "m",
      name: 'Quotes " backslash \\ tab\t nl\n ctrl\u0001 del\u007f ñ 😀',
      elements: {
        classes: [
          cls("Á", {
            attributes: [{ id: "Á.x", name: "x", visibility: "public", type: { idref: "Á" } }],
          }),
        ],
      },
    };
    expect(serialize("model", m)).toBe(
      [
        "{",
        '  "format_version": "1.0",',
        '  "id": "m",',
        '  "name": "Quotes \\" backslash \\\\ tab\\t nl\\n ctrl\\u0001 del\u007f ñ 😀",',
        '  "elements": {',
        '    "classes": [',
        "      {",
        '        "id": "Á",',
        '        "name": "Á",',
        '        "visibility": "public",',
        '        "attributes": [',
        "          {",
        '            "id": "Á.x",',
        '            "name": "x",',
        '            "visibility": "public",',
        '            "type": {"idref": "Á"}',
        "          }",
        "        ]",
        "      }",
        "    ]",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("sets by code point, code_refs by path and symbol, ordered arrays untouched", () => {
    const m = {
      format_version: "1.0",
      id: "m",
      name: "M",
      elements: {
        enumerations: [
          { id: "b", name: "b", visibility: "public", literals: ["z", "a"] },
          { id: "B", name: "B", visibility: "public" },
        ],
        classes: [
          cls("A", {
            tags: ["b", "B", "a"],
            code_refs: [{ path: "x", symbol: "S" }, { path: "x" }, { path: "a", symbol: "Z" }],
          }),
        ],
      },
    };
    const out = JSON.parse(serialize("model", m)) as {
      elements: {
        enumerations: { id: string; literals?: string[] }[];
        classes: { tags: string[]; code_refs: unknown[] }[];
      };
    };
    expect(out.elements.enumerations.map((e) => e.id)).toEqual(["B", "b"]);
    expect(out.elements.enumerations[1]?.literals).toEqual(["z", "a"]);
    expect(out.elements.classes[0]?.tags).toEqual(["B", "a", "b"]);
    expect(out.elements.classes[0]?.code_refs).toEqual([
      { path: "a", symbol: "Z" },
      { path: "x" },
      { path: "x", symbol: "S" },
    ]);
  });

  it("empty required values are written; layout maps sorted and without empty entries", () => {
    const lifeline = serialize("model", {
      format_version: "1.0",
      id: "m",
      name: "M",
      elements: {
        interactions: [
          { id: "I", name: "I", visibility: "public", lifelines: [{ id: "I.l", name: "" }] },
        ],
      },
    });
    expect(lifeline).toContain('"name": ""');
    const layout = serialize("layout", {
      edges: { z: {}, a: { vertices: [] } },
      nodes: { b: { y: 2, x: 1, style: null }, B: { x: 0, y: 0 } },
      diagram: { idref: "d" },
      format_version: "1.0",
    });
    expect(layout).toBe(
      [
        "{",
        '  "format_version": "1.0",',
        '  "diagram": {"idref": "d"},',
        '  "nodes": {',
        '    "B": {',
        '      "x": 0,',
        '      "y": 0',
        "    },",
        '    "b": {',
        '      "x": 1,',
        '      "y": 2',
        "    }",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
  });
});

describe("review S4 follow-ups", () => {
  it("a CR-only line ending before a conflict marker is MERGE_CONFLICT", () => {
    const text = '{\r=======\r"x": 1}';
    expect(codes(check({ path: "models/m.json", bytes: enc.encode(text) }))).toEqual([
      "MERGE_CONFLICT",
    ]);
  });

  it.each([
    [
      "combined_fragment covered",
      model("m", {
        interactions: [
          interaction("I", [
            {
              id: "I.opt",
              type: "combined_fragment",
              operator: "opt",
              covered: [{ idref: "I.a" }, { idref: "I.a" }],
              operands: [{ id: "I.opt.op1" }],
            },
          ]),
        ],
      }),
    ],
    [
      "interaction_use covered",
      model("m", {
        interactions: [
          interaction("I", [
            {
              id: "I.ref--J",
              type: "interaction_use",
              covered: [{ idref: "I.b" }, { idref: "I.b" }],
              interaction: { idref: "J" },
            },
          ]),
          { id: "J", name: "J", visibility: "public" },
        ],
      }),
    ],
    [
      "diagram elements",
      model(
        "m",
        { classes: [cls("A")] },
        {
          diagrams: [
            { id: "c", kind: "class", name: "C", elements: [{ idref: "A" }, { idref: "A" }] },
          ],
        },
      ),
    ],
  ])("a repeated reference in %s is SCHEMA_VIOLATION", (_name, m) => {
    expect(codes(check(m))).toEqual(["SCHEMA_VIOLATION"]);
  });

  it("tolerant reading drops repeated set items but keeps the rest of the set", () => {
    const pkg = { ...cls("P"), members: [{ idref: "A" }, { idref: "A" }, { idref: "Missing" }] };
    const future = model(
      "future",
      { packages: [pkg], classes: [cls("A")] },
      { format_version: "1.5" },
    );
    const report = validateFiles([MANIFEST, future]);
    expect(report.findings.map((x) => [x.code, x.pointer])).toEqual([
      ["REF_UNRESOLVED", "/elements/packages/0/members/2"],
      ["FORMAT_VERSION_UNSUPPORTED", "/format_version"],
    ]);
  });

  it("tolerant reading that recovers nothing says so", () => {
    const future = file("models/x.json", { format_version: "3.0", id: "bad id", name: "X" });
    const report = validateFiles([MANIFEST, future]);
    expect(report.documents.find((d) => d.path === "models/x.json")?.data).toBeUndefined();
    expect(report.findings.map((x) => [x.code, x.pointer])).toEqual([
      ["FORMAT_VERSION_UNSUPPORTED", ""],
      ["FORMAT_VERSION_UNSUPPORTED", "/format_version"],
    ]);
  });
});
