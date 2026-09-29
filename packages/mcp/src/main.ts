#!/usr/bin/env node
import { statSync } from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FloFolder } from "./folder.js";
import { createServer } from "./tools.js";

// stdout es el protocolo MCP: los avisos van a stderr.
const [root] = process.argv.slice(2);
if (!root || !statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
  console.error("uso: flo-mcp <carpeta>");
  process.exit(1);
}
const folder = new FloFolder(root);
folder.load();
folder.watch();
await createServer(folder).connect(new StdioServerTransport());
// El watcher mantiene vivo el proceso: sin esto, el servidor sobrevive al
// cliente que cerró stdin.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
