import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query, tagCatalog, type Where } from "@flo/core";
import type { FloFolder } from "./folder.js";

const memory = z.enum(["working", "short_term", "long_term"]);
const projection = z.enum(["meta", "full", "full+diagrams"]);

/**
 * `Where` del core validado estricto (pendiente de K2): una clave
 * desconocida o un tipo incorrecto se rechaza antes de llegar a `query`,
 * que confía en sus tipos.
 */
const where: z.ZodType<Where> = z.lazy(() =>
  z.union([
    z.strictObject({ and: z.array(where) }),
    z.strictObject({ or: z.array(where) }),
    z.strictObject({ not: where }),
    z.strictObject({ memory }),
    z.strictObject({ typeTag: z.string() }),
    z.strictObject({ contextTag: z.string() }),
    z.strictObject({ custom: z.string(), equals: z.union([z.string(), z.number(), z.boolean()]).optional() }),
    z.strictObject({ text: z.string() }),
  ])
);

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const failure = (value: unknown) => ({ ...json(value), isError: true });

/** Las cinco herramientas del spec de conocimiento §6 sobre una carpeta (decisión #35). */
export function createServer(folder: FloFolder): McpServer {
  const server = new McpServer({ name: "flo-mcp", version: "0.1.0" });

  server.registerTool(
    "query",
    {
      description:
        "Consulta el grafo de conocimiento. `where` filtra las semillas (and/or/not, memory, typeTag, contextTag, custom, text); `from` limita las semillas a esos ids; `depth` expande por relaciones y flujos; `project` elige meta, full (con body) o full+diagrams.",
      inputSchema: z.strictObject({
        where: where.optional(),
        from: z.array(z.string()).optional(),
        depth: z.number().int().min(0).optional(),
        project: projection.optional(),
      }),
    },
    async (opts) => json(query(folder.link(), opts))
  );

  server.registerTool(
    "get_node",
    {
      description: "Una entidad por id, con sus relaciones salientes y entrantes.",
      inputSchema: z.strictObject({ id: z.string(), project: projection.optional() }),
    },
    async ({ id, project }) => {
      const link = folder.link();
      const [node] = query(link, { from: [id], project }).nodes;
      if (!node) return failure({ error: `no existe la entidad '${id}'` });
      return json({
        node,
        outgoing: link.xref.relationsFrom(id).map(({ type, target, resolved }) => ({ type, target, resolved })),
        incoming: link.xref.relationsTo(id).map(({ from, relation }) => ({ from, type: relation.type, target: relation.target })),
      });
    }
  );

  server.registerTool(
    "list_tags",
    { description: "El vocabulario en uso: type_tags, context_tags y los valores de cada custom_tag." },
    async () => json(tagCatalog(folder.link()))
  );

  server.registerTool(
    "check",
    {
      description: "Diagnósticos del workspace (solo los archivos que tienen alguno), o de un archivo si se da `path`.",
      inputSchema: z.strictObject({ path: z.string().optional() }),
    },
    async ({ path }) => {
      if (path === undefined) return json(folder.diagnostics());
      const uri = folder.toUri(path);
      const found = uri === null ? null : folder.diagnostics(uri);
      return found ? json(found) : failure({ error: `'${path}' no es un documento del workspace` });
    }
  );

  server.registerTool(
    "write_node",
    {
      description:
        "Crea o reemplaza un archivo .md o .flo (ruta relativa a la carpeta raíz). Solo escribe si el archivo no tiene errores y no aparecen errores nuevos en otros archivos; si no, devuelve los diagnósticos.",
      inputSchema: z.strictObject({ path: z.string(), content: z.string() }),
    },
    async ({ path, content }) => {
      const result = folder.write(path, content);
      return result.ok ? json(result) : failure(result);
    }
  );

  return server;
}
