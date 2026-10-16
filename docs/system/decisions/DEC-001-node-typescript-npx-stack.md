---
id: DEC-001
type: decision
name: "Node.js ≥22 + TypeScript ESM stack distributed as the npm package ai-submind (npx)"
status: active
evidence: declared-doc
summary: "submind is distributed as the npm package `ai-submind` (TypeScript ESM, Node ≥22) runnable with npx; host project root = git root of the cwd."
aliases: [stack, npx, cli, node, typescript, ai-submind, package]
tags: [architecture, stack]
relations:
  affects: [REQ-001, REQ-002, NFR-001, NFR-008, FEAT-001, ENT-001, API-003]
  supersedes: []
uncertainties: []
---

# DEC-001 · Node.js ≥22 + TypeScript ESM stack distributed as the npm package ai-submind (npx)

## Context
- User: "it will be an npx command or similar that runs the server from the project where it is launched" [declared].
- User chose "Node ≥22 TS, root = git root" (2026-10-14) [declared].
- User (2026-10-14): package name `ai-submind` [declared]. `submind` is taken on npm (v1.2.80); `ai-submind` is free [verified: `npm view`, 2026-10-14].
- The official MCP SDK, JointJS and Ajv belong to the JS/TS ecosystem [verified: npm, tech-research 2026-10-14].

## Alternatives considered
1. Node ≥22 + TS, root = git root — current LTS, universal `npx`; requires a build.
2. Node ≥20, root = cwd — more compatible; ambiguous root in subdirectories.
3. Bun — faster; narrower reach than npx.

## Decision
- npm package `ai-submind` with bin `ai-submind` (`npx ai-submind`), strict TypeScript, ESM, `engines.node >=22`.
  Name of the product, package, command, MCP server and artifacts in the host project: `ai-submind`
  (`knowledge/ai-submind.json`, `knowledge/.ai-submind/`). `submind` remains only as the name of this repository.
- Host project root: `git rev-parse --show-toplevel` from the cwd; if there is no git, the cwd.
- Knowledge directory: `<root>/knowledge` by default, configurable with `--knowledge <dir>`;
  always confined within the root.
- Own modules, decoupled through interfaces (format core, engine, queries, MCP, HTTP server, UI).
  Structure (single package, npm) and development tools: DEC-008.

## Consequences
- Positive: a single language across the whole stack; trivial distribution.
- Negative / costs: TS→JS build and UI bundling at publication.

## Affected elements
`schema.yaml` (`code_roots`), CAP-011 (no longer deferred).

## Verification
`test/e2e/npx.test.ts`: the packed tarball is installed in a fresh git repo and driven through `npx ai-submind` (init, serve, mcp, stop); run on macOS (locally) and Linux (CI); Windows not yet (NFR-001).
