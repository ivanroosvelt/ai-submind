// Post-merge integrity with real git merges (PLAN-002 S10; FEAT-008, REQ-034, REQ-035, REQ-036): a textual
// conflict, duplicate IDs across two models and a broken reference, each produced by `git merge` in a
// temporary repository with the garage corpus, and diagnosed (never repaired) by the CLI `validate`, the MCP
// `validate` tool and the UI's `GET /api/findings`. dist/ is built once by test/build-dist.ts.
import { execFile, spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveProject } from "../../src/daemon/project.js";
import { startDaemon } from "../../src/daemon/server.js";
import { serialize } from "../../src/format/canonical.js";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const MAIN = join(REPO, "dist", "cli", "main.js");
const GARAGE = join(REPO, "spec", "format", "examples", "valid", "garage", "knowledge");

interface Finding {
  code: string;
  severity: string;
  file: string;
  pointer: string;
  subjects?: string[];
}
interface Report {
  state: string;
  errors: number;
  findings: Finding[];
}
interface ToolResult {
  isError?: boolean;
  structuredContent?: unknown;
}

let dir: string;

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), "ai-submind-merge-")));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function git(...args: string[]): { status: number | null; out: string } {
  const r = spawnSync(
    "git",
    [
      "-c",
      "commit.gpgsign=false",
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.invalid",
    ].concat(args),
    { cwd: dir, encoding: "utf8" },
  );
  return { status: r.status, out: r.stdout + r.stderr };
}

function gitOk(...args: string[]): string {
  const r = git(...args);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.out}`);
  return r.out;
}

type Model = { elements: Record<string, Record<string, unknown>[]> } & Record<string, unknown>;

async function editModel(name: string, change: (m: Model) => void): Promise<void> {
  const path = join(dir, "knowledge", "models", `${name}.json`);
  const model = JSON.parse(await readFile(path, "utf8")) as Model;
  change(model);
  await writeFile(path, serialize("model", model));
}

const money = { id: "Money", name: "Money", visibility: "public", kind: "real" };

/** Adds `Car.price`, of type Money. */
const addPrice = (m: Model): void => {
  const car = m.elements.classes?.find((c) => c.id === "Car") as { attributes: unknown[] };
  car.attributes.push({
    id: "Car.price",
    name: "price",
    visibility: "private",
    type: { idref: "Money" },
  });
};

/**
 * Commits the garage corpus (after `base`) on main, commits `theirs` on a branch and `ours` on main, and
 * merges the branch into main. Returns the merge's exit status.
 */
async function merge(
  ours: () => Promise<void>,
  theirs: () => Promise<void>,
  base?: () => Promise<void>,
): Promise<number | null> {
  gitOk("init", "-q", "-b", "main");
  await cp(GARAGE, join(dir, "knowledge"), { recursive: true });
  await base?.();
  gitOk("add", "-A");
  gitOk("commit", "-q", "-m", "base");
  gitOk("checkout", "-q", "-b", "theirs");
  await theirs();
  gitOk("add", "-A");
  gitOk("commit", "-q", "-m", "theirs");
  gitOk("checkout", "-q", "main");
  await ours();
  gitOk("add", "-A");
  gitOk("commit", "-q", "-m", "ours");
  return git("merge", "--no-edit", "theirs").status;
}

/** Bytes of every file in knowledge/ outside .ai-submind/, to prove that nothing was repaired. */
async function snapshot(): Promise<Map<string, string>> {
  const root = join(dir, "knowledge");
  const files = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(root.length + 1))
    .filter((f) => !f.startsWith(".ai-submind"))
    .sort();
  return new Map(
    await Promise.all(
      files.map(async (f) => [f, (await readFile(join(root, f))).toString("base64")] as const),
    ),
  );
}

function cli(...args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((ok) => {
    execFile(process.execPath, [MAIN, ...args], { cwd: dir }, (error, stdout) => {
      ok({ code: error ? Number(error.code ?? 1) : 0, stdout });
    });
  });
}

interface Session {
  tool: (name: string, args?: Record<string, unknown>) => Promise<ToolResult>;
  /** `GET /api/findings` of the UI API. */
  findings: () => Promise<Report>;
}

/** Runs `use` against an in-process daemon on port 0 (MCP client + UI API); always closes both. */
async function withDaemon(use: (s: Session) => Promise<void>): Promise<void> {
  const r = await startDaemon(await resolveProject(dir), { port: 0 });
  if (r.status !== "started") throw new Error("expected a new daemon");
  const d = r.daemon;
  const client = new Client({ name: "test", version: "0" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL("mcp", d.url), {
        requestInit: { headers: { authorization: `Bearer ${d.token}` } },
      }),
    );
    await use({
      tool: (name, args = {}) => client.callTool({ name, arguments: args }) as Promise<ToolResult>,
      findings: () =>
        new Promise((ok, fail) => {
          const headers = {
            host: `127.0.0.1:${String(d.port)}`,
            authorization: `Bearer ${d.token}`,
          };
          const req = httpRequest(
            { host: "127.0.0.1", port: d.port, path: "/api/findings", headers },
            (res) => {
              let text = "";
              res.setEncoding("utf8").on("data", (c: string) => (text += c));
              res.on("end", () => {
                if (res.statusCode === 200) ok(JSON.parse(text) as Report);
                else fail(new Error(`${String(res.statusCode)} ${text}`));
              });
            },
          );
          req.on("error", fail).end();
        }),
    });
  } finally {
    await client.close();
    await d.close();
  }
}

const errorCode = (r: ToolResult): string | undefined =>
  r.isError === true ? (r.structuredContent as { error: { code: string } }).error.code : undefined;

const report = (r: ToolResult): Report => {
  expect(r.isError).toBeFalsy();
  return r.structuredContent as Report;
};

const only = (findings: Finding[], code: string): Finding[] =>
  findings.filter((f) => f.code === code);

describe("post-merge integrity with real git merges", () => {
  it("a textual conflict is reported everywhere and the file is never overwritten (REQ-034)", async () => {
    const status = await merge(
      () => editModel("types", (m) => (m.documentation = "Ours.")),
      () => editModel("types", (m) => (m.documentation = "Theirs.")),
    );
    expect(status).toBe(1);
    expect(await readFile(join(dir, "knowledge", "models", "types.json"), "utf8")).toMatch(
      /^<<<<<<< /m,
    );
    const before = await snapshot();
    const gitBefore = gitOk("status", "--porcelain");

    const c = await cli("validate");
    expect(c.code).toBe(1);
    expect(c.stdout).toMatch(/^error MERGE_CONFLICT models\/types\.json# /m);

    await withDaemon(async ({ tool, findings }) => {
      const conflict = { code: "MERGE_CONFLICT", severity: "error", file: "models/types.json" };
      expect(only(report(await tool("validate")).findings, "MERGE_CONFLICT")).toEqual([
        expect.objectContaining(conflict),
      ]);
      expect(only((await findings()).findings, "MERGE_CONFLICT")).toEqual([
        expect.objectContaining(conflict),
      ]);
      // Writes that would touch the conflicted file fail (recreating it adds IDs: CREATE_BLOCKED before
      // the engine's DOCUMENT_INVALID guard); its elements are not indexed at all.
      expect(
        errorCode(
          await tool("create_element", { type: "model", data: { id: "types", name: "T" } }),
        ),
      ).toBe("CREATE_BLOCKED");
      expect(errorCode(await tool("update_element", { id: "String", patch: { name: "S" } }))).toBe(
        "NOT_FOUND",
      );
      expect(errorCode(await tool("delete_element", { id: "types" }))).toBe("NOT_FOUND");
      // A new ID could already exist inside the conflicted file: creations elsewhere are blocked too.
      const string = { id: "String", name: "String", visibility: "public", kind: "string" };
      expect(
        errorCode(
          await tool("create_element", { type: "primitive_type", parent: "garage", data: string }),
        ),
      ).toBe("CREATE_BLOCKED");
      // The rest of knowledge/ still loads.
      expect(errorCode(await tool("get_element", { id: "Car" }))).toBeUndefined();
    });

    expect(await snapshot()).toEqual(before);
    expect(gitOk("status", "--porcelain")).toBe(gitBefore);
  });

  it("duplicate IDs from a clean merge are reported per location and block queries and writes (REQ-035)", async () => {
    const status = await merge(
      async () => {
        await editModel("types", (m) => m.elements.primitive_types?.push(money));
        await editModel("garage", addPrice);
      },
      () =>
        writeFile(
          join(dir, "knowledge", "models", "billing.json"),
          serialize("model", {
            format_version: "1.0",
            id: "billing",
            name: "Billing",
            elements: { primitive_types: [money] },
          }),
        ),
    );
    expect(status).toBe(0);
    const before = await snapshot();

    const c = await cli("validate");
    expect(c.code).toBe(1);
    expect(c.stdout).toMatch(
      /^error ID_DUPLICATE models\/billing\.json#\/elements\/\S+ \[Money\]/m,
    );
    expect(c.stdout).toMatch(/^error ID_DUPLICATE models\/types\.json#\/elements\/\S+ \[Money\]/m);

    const both = [
      expect.objectContaining({ file: "models/billing.json", subjects: ["Money"] }),
      expect.objectContaining({ file: "models/types.json", subjects: ["Money"] }),
    ];
    const sorted = (fs: Finding[]): Finding[] =>
      only(fs, "ID_DUPLICATE").sort((a, b) => a.file.localeCompare(b.file));
    await withDaemon(async ({ tool, findings }) => {
      const v = sorted(report(await tool("validate")).findings);
      expect(v).toEqual(both);
      for (const f of v) expect(f.pointer).toMatch(/^\/elements\/primitive_types\/\d+$/);
      expect(sorted((await findings()).findings)).toEqual(v);
      expect(errorCode(await tool("get_element", { id: "Money" }))).toBe("AMBIGUOUS_ID");
      expect(errorCode(await tool("update_element", { id: "Money", patch: { name: "M" } }))).toBe(
        "AMBIGUOUS_ID",
      );
      expect(errorCode(await tool("delete_element", { id: "Money" }))).toBe("AMBIGUOUS_ID");
      expect(errorCode(await tool("rename", { id: "Money", newId: "Cash" }))).toBe("AMBIGUOUS_ID");
      // A new reference to Money would resolve to either copy; the existing Car.price does not block.
      const cost = { name: "cost", visibility: "private", type: { idref: "Money" } };
      expect(
        errorCode(await tool("create_element", { type: "attribute", parent: "Car", data: cost })),
      ).toBe("AMBIGUOUS_ID");
      const plain = await tool("update_element", {
        id: "Car",
        patch: { documentation: "A car." },
        dryRun: true,
      });
      expect(errorCode(plain)).toBeUndefined();
      // Deleting one copy keeps Car.price pointing to the copy that remains.
      const del = await tool("delete_element", { id: "billing", cascade: true, dryRun: true });
      expect(errorCode(del)).toBeUndefined();
      expect((del.structuredContent as { affected: unknown }).affected).toEqual([
        { action: "deleted", file: "models/billing.json", pointer: "", id: "billing" },
      ]);
    });

    expect(await snapshot()).toEqual(before);
  });

  it("a broken reference from a clean merge is reported with its location; the rest loads (REQ-036)", async () => {
    const status = await merge(
      () => editModel("garage", addPrice),
      () =>
        editModel("types", (m) => {
          m.elements.primitive_types = (m.elements.primitive_types ?? []).filter(
            (t) => t.id !== "Money",
          );
        }),
      () => editModel("types", (m) => m.elements.primitive_types?.push(money)),
    );
    expect(status).toBe(0);
    const before = await snapshot();

    const c = await cli("validate");
    expect(c.code).toBe(1);
    expect(c.stdout).toMatch(
      /^error REF_UNRESOLVED models\/garage\.json#\/elements\/classes\/\d+\/attributes\/\d+\/type \[Money\]/m,
    );

    const broken: unknown = expect.objectContaining({
      code: "REF_UNRESOLVED",
      file: "models/garage.json",
      pointer: expect.stringMatching(
        /^\/elements\/classes\/\d+\/attributes\/\d+\/type$/,
      ) as unknown,
      subjects: ["Money"],
    });
    await withDaemon(async ({ tool, findings }) => {
      const v = report(await tool("validate"));
      expect(v.errors).toBe(1);
      expect(v.findings.filter((f) => f.severity === "error")).toEqual([broken]);
      expect(only((await findings()).findings, "REF_UNRESOLVED")).toEqual([broken]);
      for (const id of ["Car", "Car.price", "Engine", "Integer"])
        expect(errorCode(await tool("get_element", { id })), id).toBeUndefined();
    });

    expect(await snapshot()).toEqual(before);
    // The daemon's knowledge/.ai-submind/ ignores itself (DEC-014): the merged tree stays clean.
    expect(gitOk("status", "--porcelain")).toBe("");
  });
});
