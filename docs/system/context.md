# Product context

> Classification of each statement: **[verified]** in code · **[declared]** in documentation or
> by a person · **[inferred]** with partial evidence · **[unknown]**.

## What is known

- Repository: `github.com/ivanroosvelt/ai-submind` (renamed from `tejo` on 2026-10-16; `master` = the `v2` line, the old tejo history kept in the `archive/tejo-master` branch) **[verified]** (Git remote). Name of the product, npm package,
  command and MCP server: `ai-submind` (DEC-001) **[declared]**.
- Branch `v2` started without history (EDR-002); since 2026-10-16 it is `master` **[verified]**.
- Purpose: diagram manager (class and sequence diagrams in the first scope) that lives in `knowledge/` of the
  host project, versioned with Git as the single source of truth; agents query and manage it via
  MCP and people explore it in a web UI (REQ-001..040, REP-003) **[declared]**.
- Actors: ACT-001 Developer, ACT-002 AI agent (MCP client), ACT-003 Host Git repository;
  ACT-004 Embeddings provider (later) **[declared]**. Single local user, no roles **[inferred]**.
- Stack: Node.js ≥22, strict TypeScript, ESM, distributed with `npx ai-submind`; root = git root of the cwd (DEC-001) **[declared]**.
- Format: own, derived from UMJ, JSON Schema 2020-12, one file per model
  (`knowledge/models/<model-id>.json`), separate layout (`knowledge/layout/<diagram-id>.json`), manifest
  `knowledge/ai-submind.json`, derived files in `knowledge/.ai-submind/` ignored by git; canonical serialization (DEC-002, FEAT-003) **[declared]**.
- Format 1.0 contract: `spec/format/README.md` + JSON Schema 2020-12 in `spec/format/schema/1.0/` + corpus of
  examples (API-004) **[declared]**.
- Format core in `src/format/` (FEAT-003, DEC-009): schema-driven canonical serialization and validation
  in four phases (file, version, schema with strict Ajv 8, references and semantic rules) with reading
  confined to `knowledge/`; the `spec/format/examples` corpus runs in `npm test` **[verified]**.
- Readable scoped element IDs (`Car`, `Car.start()`), unique in a global namespace (models and
  diagrams too), stable when `name` changes; cross-model references with a simple `idref`; rename only via the engine with
  reference rewriting (DEC-003, REQ-039, API-004) **[declared]**.
- Format version other than the supported one (1.0) → the validator marks the document `read_only` and applies tolerant
  reading **[verified]**; the engine rejects writes to it (`DOCUMENT_INVALID`) **[verified]** (VAL-004, NFR-011).
- Own embedded knowledge engine instead of TerminusDB (DEC-004, FEAT-002) in `src/engine/`: loading and indexes,
  document-level batch transactions validated before writing with revision control, per-file atomic writes,
  rename with reference rewriting, ID derivation and reload with `fs.watch` (DEC-011) **[verified]**.
  Element-level create/update/delete with `cascade`, diagram editing, atomic batches, `dryRun` and implicit init
  in `src/engine/edit.ts` (REQ-023..027, DEC-015, DEC-016) **[verified]**.
- Process: single daemon per project in `src/daemon/` (HTTP on 127.0.0.1:7777 with fallback, token by Bearer or
  cookie, Host/Origin, lockfile, idle shutdown) and CLI `serve`/`status`/`stop`/`init`/`validate` in `src/cli/`
  (DEC-005, DEC-014, FEAT-001, REQ-037) **[verified]**; stdio MCP proxy `ai-submind mcp` in `src/cli/proxy.ts`
  (DEC-016) **[verified]**.
- MCP: stateless Streamable HTTP endpoint `/mcp` on the daemon behind its auth, query and administration tools and
  resources in `src/mcp/` (API-001, FEAT-006, DEC-016) **[verified]**; `auto_layout_diagram` over the shared layout module (DEC-015, DEC-017) **[verified]**.
- UI: plain TypeScript over `@joint/core` with own shapes in `src/ui/`, bundled by Vite into `dist/ui/`; shapes sized by
  the pure module `src/layout/` (dagre via `@dagrejs/dagre`, shared with MCP); explore and adjust layout, SSE refresh;
  model changes only via MCP (DEC-006, DEC-017, FEAT-007): implemented; API/layout **[verified]** by tests; browser
  check of class diagrams done (S9). Sequence diagrams (FEAT-009, DEC-018): pure geometry module
  `src/layout/sequence-layout.ts` shared by the UI and `auto_layout_diagram`, executions in format 1.0 (amended)
  **[verified]** by tests; browser check of `rent-car` and `check-fuel` done by the user (2026-10-15, PLAN-002 S11).
- Search: structured queries (list, get, find, relations, impact, paths) and own BM25F lexical search in
  `src/query/` over the engine (FEAT-004, DEC-012, DEC-013) **[verified]**; semantic with embeddings later and
  outside PLAN-002 (DEC-007, FEAT-005) **[declared]**.
- Interfaces: API-001 MCP server and API-003 CLI **[verified]**; API-002 UI HTTP API in `src/daemon/ui-api.ts` **[verified]**.
- Single npm package at the root: `src/` (code, `code_roots`), `test/` (Vitest), ESLint + typescript-eslint + Prettier;
  `scripts/check` runs `npm run check` (DEC-008, EDR-006) **[verified]**.
- Implemented and covered by tests: format core (FEAT-003, API-004, VAL-001..007, ENT-001..005), engine (FEAT-002), queries (FEAT-004),
  MCP (API-001, FEAT-006), CLI and daemon (FEAT-001, API-003, including `npx` of the packed tarball in `test/e2e/npx.test.ts`),
  Git integrity (FEAT-008), UI HTTP API (API-002); UI rendering (FEAT-007, FEAT-009) implemented, checked in the browser by hand
  (no automated browser test) **[verified]**.
- License: Apache-2.0, copyright Iván López; `LICENSE` and `NOTICE` ship in the tarball (DEC-019) **[verified]**. Published on npm: 0.1.0 (local, without provenance) and 0.1.1 through the `release` workflow with trusted publishing and SLSA provenance (2026-10-16, PLAN-004) **[verified]**.
- Cycles and boundaries between modules checked by dependency-cruiser in `npm run check` (NFR-008, DEC-009) **[verified]**.
- Target scale ~10,000 elements per project (NFR-007, thresholds unconfirmed) **[inferred]**.

## What is not known (pending)


## Next step

PLAN-002 and PLAN-004 (npm publication) are completed (archived). Next: semantic search (FEAT-005, DEC-007).
