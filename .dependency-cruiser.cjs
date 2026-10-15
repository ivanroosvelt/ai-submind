// Module rules of the product (NFR-008, DEC-009). `npm run deps` checks them on src/.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "No circular dependencies between modules (NFR-008).",
      from: {},
      to: { circular: true },
    },
    {
      name: "format-is-core",
      severity: "error",
      comment: "src/format is the core: it depends on no other product module.",
      from: { path: "^src/format/" },
      to: { path: "^src/(?!format/)" },
    },
    {
      name: "engine-on-format",
      severity: "error",
      comment: "src/engine depends only on src/format (DEC-004, DEC-011).",
      from: { path: "^src/engine/" },
      to: { path: "^src/(?!format/|engine/)" },
    },
    {
      name: "query-on-format-engine",
      severity: "error",
      comment: "src/query depends only on src/format and src/engine (DEC-012).",
      from: { path: "^src/query/" },
      to: { path: "^src/(?!format/|engine/|query/)" },
    },
    {
      name: "daemon-on-format-engine-query",
      severity: "error",
      comment:
        "src/daemon depends only on src/format, src/engine, src/query and src/mcp (DEC-005, DEC-014, DEC-016).",
      from: { path: "^src/daemon/" },
      to: { path: "^src/(?!format/|engine/|query/|mcp/|daemon/)" },
    },
    {
      name: "mcp-on-format-engine-query-layout",
      severity: "error",
      comment:
        "src/mcp depends only on src/format, src/engine, src/query and src/layout; the daemon passes it what it needs (DEC-016, DEC-017).",
      from: { path: "^src/mcp/" },
      to: { path: "^src/(?!format/|engine/|query/|layout/|mcp/)" },
    },
    {
      name: "layout-on-format-types",
      severity: "error",
      comment:
        "src/layout is pure and runs in Node and in the browser: only types of src/format, no Node built-ins (DEC-017).",
      from: { path: "^src/layout/" },
      to: { path: "^src/(?!layout/|format/types[.]ts$)" },
    },
    {
      name: "ui-on-layout-and-format-types",
      severity: "error",
      comment: "src/ui (browser) depends only on src/layout and on types of src/format (DEC-017).",
      from: { path: "^src/ui/" },
      to: { path: "^src/(?!ui/|layout/|format/)" },
    },
    {
      name: "ui-format-types-only",
      severity: "error",
      comment: "src/ui imports only types from src/format: its runtime code needs Node (DEC-017).",
      from: { path: "^src/ui/" },
      to: { path: "^src/format/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "browser-without-node",
      severity: "error",
      comment: "src/layout and src/ui run in the browser: no Node built-ins (DEC-017).",
      from: { path: "^src/(layout|ui)/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "nothing-imports-ui",
      severity: "error",
      comment:
        "src/ui is bundled by Vite into dist/ui and served as files; no module imports it (DEC-017).",
      from: { path: "^src/(?!ui/)" },
      to: { path: "^src/ui/" },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment: "Published code does not import development dependencies.",
      from: { path: "^src/" },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".js", ".json"],
    },
  },
};
