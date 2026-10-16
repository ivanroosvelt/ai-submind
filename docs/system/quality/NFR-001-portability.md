---
id: NFR-001
type: quality-attribute
name: "Portability"
status: active
evidence: declared-doc
summary: "Works on Linux, macOS and Windows with Node ≥22 using only npx, without Docker or native compilation."
aliases: ["portable", "npx", "cross-platform"]
tags: [quality]
test_code: [test/e2e/npx.test.ts, test/package/licenses.test.ts]
relations:
  tests: []
  decisions: []
uncertainties:
  - "CI matrix per operating system not yet defined: the e2e runs on macOS (locally) and Linux (CI, ubuntu-latest, validate run 38932422340); Windows pending. On Windows the tests start npm/npx through a shell (.cmd shims); not yet executed there."
---

# NFR-001 · Portability

## Requirement
ai-submind is installed and run with `npx ai-submind` on Node ≥22 (DEC-001) without Docker, without external services and without native compilation when installing the core.

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Supported OSes | Linux, macOS, Windows | `test/e2e/npx.test.ts`: packed tarball installed in a fresh git repo and driven through `npx ai-submind` (init, serve, mcp, stop); run on macOS and Linux (CI) |
| Native dependencies of the core | 0 | `test/package/licenses.test.ts`: no production package with `binding.gyp`, `gypfile` or preinstall/install/postinstall scripts |

## Scope
The whole product except the optional embeddings module (DEC-007).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
