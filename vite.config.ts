// UI build (DEC-017): src/ui → dist/ui, served by the daemon (API-002). `npm run build` runs it after tsc.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("src/ui/", import.meta.url)),
  base: "/",
  build: {
    outDir: fileURLToPath(new URL("dist/ui/", import.meta.url)),
    emptyOutDir: true,
  },
});
