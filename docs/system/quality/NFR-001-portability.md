---
id: NFR-001
type: quality-attribute
name: "Portability"
status: active
summary: "Works on Linux, macOS and Windows with Node ≥22 using only npx, without Docker or native compilation."
aliases: ["portable", "npx", "cross-platform"]
tags: [quality]
test_code: [test/e2e/npx.test.ts, test/package/licenses.test.ts]
relations:
  tests: []
  decisions: []
evidence: verified-code
uncertainties:
  - "On Windows a reused pid looks alive, so a stale lock whose pid was reused waits for a daemon that does not exist (DEC-014)."
---

# NFR-001 · Portability

## Requirement
ai-submind is installed and run with `npx ai-submind` on Node ≥22 (DEC-001) without Docker, without external services and without native compilation when installing the core.

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Supported OSes | Linux, macOS, Windows | `test/e2e/npx.test.ts`: packed tarball installed in a fresh git repo and driven through `npx ai-submind` (init, serve, mcp, stop); CI job `portability` of `.github/workflows/validate.yml` on ubuntu, macos and windows × Node 22 and 24 (run 38953008314, 3 of 3 attempts green) |
| Native dependencies of the core | 0 | `test/package/licenses.test.ts`: no production package with `binding.gyp`, `gypfile` or preinstall/install/postinstall scripts |

## Scope
The whole product except the optional embeddings module (DEC-007).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
