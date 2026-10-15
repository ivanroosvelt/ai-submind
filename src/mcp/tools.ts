// MCP server of ai-submind (FEAT-006, API-001, DEC-015, DEC-016): read tools over the query facade, write
// tools over engine edits, and resources for models, diagrams and the format schemas. One instance per
// request (stateless); the transport and its auth live outside (daemon HTTP route or tests).
import { readFile } from "node:fs/promises";
import {
  McpServer,
  ResourceTemplate,
  type CallToolResult,
  type ToolCallback,
} from "@modelcontextprotocol/server";
import * as z from "zod";
import { SUPPORTED_VERSION } from "../format/schema.js";
import { ELEMENT_TYPES } from "../format/semantic.js";
import { edit, type EditOperation } from "../engine/edit.js";
import type { Engine } from "../engine/engine.js";
import { EngineError } from "../engine/errors.js";
import { QueryError } from "../query/errors.js";
import type { FindFilter } from "../query/filters.js";
import { EDGE_KINDS } from "../query/graph.js";
import type { PageArgs } from "../query/limits.js";
import { RELATION_GROUPS, type Query } from "../query/query.js";
import type { ImpactArgs, PathArgs } from "../query/traverse.js";

const SCHEMA_DIR = new URL(`../../spec/format/schema/${SUPPORTED_VERSION}/`, import.meta.url);
const SCHEMAS = ["ai-submind", "defs", "layout", "model"] as const;

/** Typed error result for engine and query errors (DEC-016); anything else is a bug and is rethrown. */
function fail(e: unknown): CallToolResult {
  if (e instanceof EngineError || e instanceof QueryError) {
    return {
      isError: true,
      content: [{ type: "text", text: e.message }],
      structuredContent: { error: { code: e.code, message: e.message, details: e.details } },
    };
  }
  throw e;
}

const ok = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
  structuredContent: value,
});

// Ranges and enumerations of query arguments are checked by the query facade (DEC-012); zod only checks
// shapes and rejects unknown keys.
const id = z.string().min(1);
const ids = z.array(id);
const int = z.number().int();
const page = { offset: int.optional(), limit: int.optional() };
const filter = {
  type: z.union([z.enum(ELEMENT_TYPES), z.array(z.enum(ELEMENT_TYPES))]).optional(),
  model: id.optional(),
  package: id.optional(),
  diagram: id.optional(),
  owner: id.optional(),
  interaction: id.optional(),
  name: z.string().optional(),
  match: z.enum(["exact", "contains", "prefix"]).optional(),
  tags: z.array(z.string()).optional(),
  stereotypes: z.array(z.string()).optional(),
  hasCodeRef: z.boolean().optional(),
  codeRefPath: z.string().optional(),
  hasDocumentation: z.boolean().optional(),
  visibility: z.enum(["public", "private", "protected", "package"]).optional(),
};
const kinds = z.array(z.enum(EDGE_KINDS)).optional();
const revision = z
  .string()
  .optional()
  .describe(
    "Revision of the document the operation touches; a mismatch fails with REVISION_CONFLICT",
  );
const dryRun = z
  .boolean()
  .optional()
  .describe("Validate and return the result and diff without writing anything");
const object = z.record(z.string(), z.unknown());
const OPS = {
  create: {
    type: z.enum(ELEMENT_TYPES),
    parent: id.optional().describe("Container ID; required for everything but a model"),
    data: object.describe("Element content in format 1.0; `id` is derived when absent"),
    index: int.optional().describe("Position in an ordered container (default: append)"),
    expectedRevision: revision,
  },
  update: {
    id,
    patch: object.describe("RFC 7396 merge patch: null removes a field, arrays replace"),
    expectedRevision: revision,
  },
  delete: {
    id,
    cascade: z
      .boolean()
      .optional()
      .describe("Also remove references and delete elements that cannot exist without it"),
    expectedRevision: revision,
  },
  edit_diagram: { id, add: ids.optional(), remove: ids.optional(), expectedRevision: revision },
};

/** MCP server over `engine` and `query`; `version` is the package version. */
export function createMcpServer(engine: Engine, query: Query, version: string): McpServer {
  const server = new McpServer({ name: "ai-submind", version });

  const tool = <S extends z.ZodObject>(
    name: string,
    description: string,
    schema: S,
    /** `create` only adds; every other `write` may remove or overwrite data. */
    kind: "read" | "create" | "write",
    run: (args: z.infer<S>) => unknown,
  ): void => {
    server.registerTool(
      name,
      {
        description,
        inputSchema: schema,
        annotations: {
          readOnlyHint: kind === "read",
          destructiveHint: kind === "write",
          idempotentHint: kind === "read",
          openWorldHint: false,
        },
      },
      // The SDK's callback type is conditional on the schema and does not resolve for a generic `S`.
      (async (args: z.infer<S>) => {
        try {
          return ok(await run(args));
        } catch (e) {
          return fail(e);
        }
      }) as ToolCallback<S>,
    );
  };

  const write = async (ops: EditOperation[], dry: boolean | undefined): Promise<unknown> =>
    edit(engine, ops, { dryRun: dry === true });

  tool(
    "list_models",
    "Models in knowledge/ with counts and validity.",
    z.strictObject(page),
    "read",
    (a) => query.listModels(a as PageArgs),
  );
  tool(
    "list_diagrams",
    "Diagrams, optionally of one model or kind, with their layout status.",
    z.strictObject({
      model: id.optional(),
      kind: z.enum(["class", "sequence"]).optional(),
      ...page,
    }),
    "read",
    (a) => query.listDiagrams(a as Parameters<Query["listDiagrams"]>[0]),
  );
  tool(
    "get_element",
    "Element by ID with its content, owner, file and children.",
    z.strictObject({ id }),
    "read",
    (a) => query.get(a.id),
  );
  tool(
    "find_elements",
    "Elements matching every given condition (AND), sorted by ID.",
    z.strictObject({ ...filter, ...page }),
    "read",
    (a) => query.find(a as FindFilter & PageArgs),
  );
  tool(
    "search",
    "Lexical search (BM25F) over names, documentation, tags and more; filters apply after ranking.",
    z.strictObject({
      text: z.string(),
      mode: z.enum(["any", "all"]).optional(),
      prefix: z.boolean().optional(),
      ...filter,
      ...page,
    }),
    "read",
    ({ text, ...rest }) => query.search(text, rest as Parameters<Query["search"]>[1]),
  );
  tool(
    "relations",
    "Edges that leave or reach an element (associations, generalizations, ownership, references…).",
    z.strictObject({
      id,
      direction: z.enum(["out", "in", "both"]).optional(),
      kinds,
      keys: z.array(z.string()).optional(),
      groups: z.array(z.enum(RELATION_GROUPS)).optional(),
      ...page,
    }),
    "read",
    ({ id: target, ...rest }) => query.relations(target, rest as Parameters<Query["relations"]>[1]),
  );
  tool(
    "impact",
    "What depends on an element (or what it depends on), transitively, with the files involved.",
    z.strictObject({
      id,
      direction: z.enum(["dependents", "dependencies", "both"]).optional(),
      maxDepth: int.optional(),
      kinds,
      limit: int.optional(),
    }),
    "read",
    ({ id: target, ...rest }) => query.impact(target, rest as ImpactArgs),
  );
  tool(
    "paths",
    "Simple paths between two elements in the model graph.",
    z.strictObject({
      from: id,
      to: id,
      directed: z.boolean().optional(),
      mode: z.enum(["shortest", "all"]).optional(),
      maxLength: int.optional(),
      maxPaths: int.optional(),
      kinds,
      throughHubs: z.boolean().optional(),
    }),
    "read",
    ({ from, to, ...rest }) => query.paths(from, to, rest as PathArgs),
  );
  tool(
    "validate",
    "Reloads knowledge/ from disk and returns every validation finding.",
    z.strictObject({}),
    "read",
    async () => {
      await engine.reload();
      const { state, findings } = engine.status();
      const errors = findings.filter((f) => f.severity === "error").length;
      return { state, errors, warnings: findings.length - errors, findings };
    },
  );

  tool(
    "create_element",
    "Creates a model (no parent), a diagram, or an element under its container. IDs are derived from " +
      "names when absent, also for inline children. The first write initializes knowledge/.",
    z.strictObject({ ...OPS.create, dryRun }),
    "create",
    ({ dryRun: dry, ...op }) => write([{ op: "create", ...op } as EditOperation], dry),
  );
  tool(
    "update_element",
    "Applies a merge patch to an element or model (names change, IDs never do; use rename).",
    z.strictObject({ ...OPS.update, dryRun }),
    "write",
    ({ dryRun: dry, ...op }) => write([{ op: "update", ...op } as EditOperation], dry),
  );
  tool(
    "delete_element",
    "Deletes an element, diagram (with its layout) or model. Fails with REFERENCED while referenced " +
      "unless cascade is set; every side effect is listed in `affected`.",
    z.strictObject({ ...OPS.delete, dryRun }),
    "write",
    ({ dryRun: dry, ...op }) => write([{ op: "delete", ...op } as EditOperation], dry),
  );
  tool(
    "edit_diagram",
    "Adds or removes elements shown by a diagram (removed ones also leave its layout).",
    z.strictObject({ ...OPS.edit_diagram, dryRun }),
    "write",
    ({ dryRun: dry, ...op }) => write([{ op: "edit_diagram", ...op } as EditOperation], dry),
  );
  tool(
    "apply_batch",
    "Applies several create/update/delete/edit_diagram operations atomically: all or nothing.",
    z.strictObject({
      operations: z
        .array(
          z.discriminatedUnion("op", [
            z.strictObject({ op: z.literal("create"), ...OPS.create }),
            z.strictObject({ op: z.literal("update"), ...OPS.update }),
            z.strictObject({ op: z.literal("delete"), ...OPS.delete }),
            z.strictObject({ op: z.literal("edit_diagram"), ...OPS.edit_diagram }),
          ]),
        )
        .min(1),
      dryRun,
    }),
    "write",
    ({ operations, dryRun: dry }) => write(operations as EditOperation[], dry),
  );
  tool(
    "rename",
    "Renames an ID (and the IDs prefixed by it) rewriting every reference, layout key and file name.",
    z.strictObject({ id, newId: id, dryRun }),
    "write",
    async ({ id: from, newId, dryRun: dry }) => ({
      dryRun: dry === true,
      ...(await engine.rename(from, newId, { dryRun: dry === true })),
      generation: engine.generation,
    }),
  );

  const json = (
    uri: URL,
    value: unknown,
  ): { contents: { uri: string; mimeType: string; text: string }[] } => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(value) }],
  });
  const element = (target: string, type: "model" | "diagram"): unknown => {
    const { data } = query.get(target);
    if (data.type !== type)
      throw new QueryError("NOT_FOUND", `${target} is not a ${type}`, { id: target });
    return data.node;
  };
  server.registerResource(
    "schema",
    new ResourceTemplate("ai-submind://schema/{name}", {
      list: () => ({
        resources: SCHEMAS.map((name) => ({
          uri: `ai-submind://schema/${name}`,
          name: `${name} schema`,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      description: `JSON Schemas of knowledge format ${SUPPORTED_VERSION}`,
      mimeType: "application/json",
    },
    async (uri, { name }) => {
      if (!SCHEMAS.includes(name as (typeof SCHEMAS)[number])) {
        throw new QueryError("NOT_FOUND", `no schema ${String(name)}`);
      }
      const text = await readFile(new URL(`${String(name)}.schema.json`, SCHEMA_DIR), "utf8");
      return { contents: [{ uri: uri.href, mimeType: "application/json", text }] };
    },
  );
  server.registerResource(
    "model",
    new ResourceTemplate("ai-submind://model/{id}", {
      list: () => ({
        resources: query.listModels({ limit: 1000 }).data.items.map((m) => ({
          uri: `ai-submind://model/${m.id}`,
          name: m.name ?? m.id,
          mimeType: "application/json",
        })),
      }),
    }),
    { description: "A model document as loaded", mimeType: "application/json" },
    (uri, { id: target }) => json(uri, element(String(target), "model")),
  );
  server.registerResource(
    "diagram",
    new ResourceTemplate("ai-submind://diagram/{id}", {
      list: () => ({
        resources: query.listDiagrams({ limit: 1000 }).data.items.map((d) => ({
          uri: `ai-submind://diagram/${d.id}`,
          name: d.name,
          mimeType: "application/json",
        })),
      }),
    }),
    { description: "A diagram and its layout (null if it has none)", mimeType: "application/json" },
    (uri, { id: target }) => {
      const diagram = element(String(target), "diagram");
      const layout = engine.document(`layout/${String(target)}.json`)?.data ?? null;
      return json(uri, { diagram, layout });
    },
  );
  return server;
}
