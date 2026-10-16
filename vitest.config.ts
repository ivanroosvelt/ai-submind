import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    globalSetup: ["test/build-dist.ts"],
    // Many tests spawn node, git, npm and daemons and take 3-6 s on their own: the 5 s default fails them under
    // load, and their hooks (stop, cleanup) do the same work. The default of cores - 1 workers oversubscribes the
    // CPU (5x slower); half the cores is also faster (83 s vs 120 s on 8 cores).
    testTimeout: 15_000,
    hookTimeout: 15_000,
    maxWorkers: "50%",
  },
});
