#!/usr/bin/env node
// Entry point of the `ai-submind` binary (API-003): checks the Node version before loading anything else.
import { nodeVersionError } from "./node-version.js";

const error = nodeVersionError(process.versions.node);
if (error !== undefined) {
  process.stderr.write(`${error}\n`);
  process.exit(1);
}
const { run } = await import("./commands.js");
process.exitCode = await run(process.argv.slice(2));
