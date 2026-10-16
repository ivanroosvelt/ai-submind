// Vitest global setup: builds dist/ once (tsc + Vite) for the suites that run the CLI as a real process
// (test/daemon/cli.test.ts, test/mcp/proxy.test.ts) and for the static UI served from dist/ui/
// (test/daemon/ui-api.test.ts). A build per suite could rewrite dist/ while another suite is loading it.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export default function setup(): void {
  try {
    const options = {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      stdio: "pipe",
    } as const;
    // npm is a .cmd shim on Windows, which Node only starts through a shell (NFR-001).
    if (process.platform === "win32")
      execFileSync("npm run --silent build", { ...options, shell: true });
    else execFileSync("npm", ["run", "--silent", "build"], options);
  } catch (e) {
    // tsc reports on stdout: show both streams instead of an opaque "Command failed".
    const { stdout = "", stderr = "" } = e as { stdout?: string; stderr?: string };
    throw new Error(`npm run build failed:\n${stdout}${stderr}`, { cause: e });
  }
}
