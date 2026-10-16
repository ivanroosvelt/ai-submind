---
id: DEC-008
type: decision
name: "Single npm package with Vitest, ESLint (typescript-eslint) and Prettier"
status: active
evidence: declared-doc
summary: "ai-submind is a single npm package at the repo root (src/ by module, test/ separate); tests with Vitest, lint with ESLint + type-aware typescript-eslint, formatting with Prettier."
aliases: [scaffolding, vitest, eslint, prettier, tsconfig, monorepo, single-package]
tags: [architecture, stack, testing]
relations:
  affects: [NFR-008]
  supersedes: []
uncertainties:
  - "The UI build (Vite) is configured in PLAN-002 S9, when UI code exists."
---

# DEC-008 · Single npm package with Vitest, ESLint (typescript-eslint) and Prettier

## Context
- DEC-001 left the repo structure and development tools open for PLAN-002 [declared].
- User (2026-10-14) chooses single package, Vitest and ESLint + typescript-eslint + Prettier [declared].
- Installed versions: TypeScript 6.0.3, Vitest 5.0.4, ESLint 10.12.0, typescript-eslint 8.71.2
  (peer `typescript <6.1.0`), Prettier 3.9.10 [verified: `npm ls`, 2026-10-14].

## Alternatives considered
1. Structure: **single package** vs monorepo with npm workspaces (`packages/{core,cli,mcp,ui}`) —
   the monorepo gives hard boundaries between modules at the cost of more configuration and bundling of internals.
2. Tests: **Vitest** vs `node:test` — `node:test` has no dependencies, but the UI (S9/S11) would need
   another tool; Vitest shares Vite with the future UI build.
3. Lint/format: **ESLint + typescript-eslint + Prettier** vs Biome — Biome is lighter, but with
   fewer type-based rules (floating promises, unsafe `any`), relevant in the daemon and MCP.

## Decision
- One `package.json` at the root (`ai-submind`, ESM, `engines.node >=22`, bin `dist/cli/main.js`,
  `files: [dist, spec]`). `"private": true` until PLAN-002 S12 to prevent accidental publication.
- Code in `src/<module>/` (format, engine, query, cli, daemon, mcp, ui) decoupled through interfaces
  (DEC-001); tests in `test/**/*.test.ts`. `code_roots: [src/]` in `schema.yaml`.
- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `NodeNext` modules); build with `tsc -p tsconfig.build.json` to `dist/`.
- ESLint with `strictTypeChecked` + `stylisticTypeChecked` and `eslint-config-prettier`.
- Prettier only over product code and configuration (`.prettierignore` as an allowlist):
  `spec/` contains byte-exact canonical examples and is not reformatted.
- `npm run check` = typecheck + lint + format + tests; `scripts/check` runs it (EDR-006).
- Node for development: `^22.13.0 || ^24.0.0 || >=26.0.0` (intersection of ESLint 10 and Vitest 5); the published runtime
  keeps `engines.node >=22` (DEC-001). Declared in `devEngines` of `package.json`.
- Development dependencies with exact versions (`--save-exact`) and a versioned `package-lock.json`.

## Consequences
- Positive: trivial publication and `npx`; a single toolchain for core and UI.
- Negative / costs: boundaries between modules only by convention (no workspaces); more development
  dependencies than `node:test` (license audit in S12).
- Source maps: `tsc` emits them for development, but the package excludes `dist/**/*.map` (`files` in `package.json`)
  because `src/` is not published and the maps would point to missing files (PLAN-002 S13).

## Affected elements
DEC-001 (resolves its structure open question), NFR-008, `docs/system/schema.yaml` (`code_roots`), `scripts/check`.

## Verification
2026-10-14: `npm run check` (typecheck, lint, format, 1 Vitest test) and `npm run build` green;
`node dist/cli/main.js` prints `ai-submind`; `scripts/check` runs the product section.
