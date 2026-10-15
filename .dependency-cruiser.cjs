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
