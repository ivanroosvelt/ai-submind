import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FloFolder } from "./folder.js";
import { createServer } from "./tools.js";

/** `tejo mcp`: servidor MCP por stdio sobre `root`; `notice` se suma a las instrucciones (#68). stdout es el protocolo: los avisos van a stderr. */
export async function runMcp(root: string, notice?: string): Promise<void> {
  const folder = new FloFolder(root);
  folder.load();
  folder.watch();
  await createServer(folder, notice).connect(new StdioServerTransport());
  // El watcher mantiene vivo el proceso: sin esto, el servidor sobrevive al
  // cliente que cerró stdin.
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("close", () => process.exit(0));
}
