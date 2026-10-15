# Product context

> Classification of each statement: **[verified]** in code · **[declared]** in documentation or
> by a person · **[inferred]** with partial evidence · **[unknown]**.

## What is known

- Repository name: `submind` **[verified]** (Git remote). Name of the product, npm package,
  command and MCP server: `ai-submind` (DEC-001) **[declared]**.
- Working branch `v2` started without history (EDR-002) **[declared]**.
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
  Element-level create/update/delete (REQ-023, REQ-024) arrives with MCP (PLAN-002 S8) **[declared]**.
- Process: single daemon per project in `src/daemon/` (HTTP on 127.0.0.1:7777 with fallback, token by Bearer or
  cookie, Host/Origin, lockfile, idle shutdown) and CLI `serve`/`status`/`stop`/`init`/`validate` in `src/cli/`
  (DEC-005, DEC-014, FEAT-001, REQ-037) **[verified]**; stdio MCP proxy `ai-submind mcp` in PLAN-002 S8 **[declared]**.
- UI: `@joint/core` with own shapes; explore and adjust layout; model changes only via MCP
  (DEC-006, FEAT-007; sequence in FEAT-009, PLAN-002 S11) **[declared]**.
- Search: structured queries (list, get, find, relations, impact, paths) and own BM25F lexical search in
  `src/query/` over the engine (FEAT-004, DEC-012, DEC-013) **[verified]**; semantic with embeddings later and
  outside PLAN-002 (DEC-007, FEAT-005) **[declared]**.
- Interfaces: API-001 MCP server, API-002 UI HTTP API, API-003 CLI **[declared]**.
- Single npm package at the root: `src/` (code, `code_roots`), `test/` (Vitest), ESLint + typescript-eslint + Prettier;
  `scripts/check` runs `npm run check` (DEC-008, EDR-006) **[verified]**.
- Implemented: format core (FEAT-003, VAL-001..007), engine (FEAT-002, partial) and queries (FEAT-004); CLI and daemon (FEAT-001, API-003)
  partial, without the `mcp` proxy (S8); MCP and UI remain at `implementation: none` **[verified]**.
- Cycles and boundaries between modules checked by dependency-cruiser in `npm run check` (NFR-008, DEC-009) **[verified]**.
- Target scale ~10,000 elements per project (NFR-007, thresholds unconfirmed) **[inferred]**.

## What is not known (pending)

- Whether the MCP agent can modify layout (P9), implicit init (P10) **[unknown]**.
- ai-submind license **[unknown]**.

## Next step

PLAN-002 S7 (CLI and per-project daemon with local security).
