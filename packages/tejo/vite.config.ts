import { defineConfig } from "vite";

// La CLI empaquetada (decisión #64): @tejo/* dentro del bundle, el resto de las dependencias externas.
export default defineConfig({
  build: {
    ssr: "src/cli.ts",
    outDir: "dist",
    target: "node20",
    rollupOptions: { output: { entryFileNames: "cli.js", banner: "#!/usr/bin/env node" } },
  },
  ssr: { noExternal: [/^@tejo\//] },
});
