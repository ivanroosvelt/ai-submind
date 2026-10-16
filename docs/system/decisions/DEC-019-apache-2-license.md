---
id: DEC-019
type: decision
name: "ai-submind is licensed under Apache-2.0"
status: active
evidence: verified-code
test_code: [test/package/licenses.test.ts, test/e2e/npx.test.ts]
summary: "ai-submind is released under the Apache License 2.0, copyright Iván López, with LICENSE and NOTICE at the package root."
aliases: [license, apache, apache-2.0, notice, copyright]
tags: [licenses]
relations:
  affects: [NFR-009]
  supersedes: []
uncertainties: []
---

# DEC-019 · ai-submind is licensed under Apache-2.0

## Context
- The own license was undecided (`UNLICENSED`, `private: true`), which blocked publishing (DEC-001, NFR-009) [declared]. This decision closes that pending point of DEC-001.
- User (2026-10-16): "elige la licencia que me respalde más"; personal project, copyright holder Iván López [declared].
- Production dependencies are MIT, ISC, Apache-2.0 and BSD-3-Clause; the UI bundles `@joint/core` (MPL-2.0) [verified: `test/package/licenses.test.ts`].

## Alternatives considered
1. Apache-2.0 — permissive; explicit warranty and liability disclaimer, express patent grant that terminates for anyone who sues over patents, no trademark rights over the name, attribution through NOTICE.
2. MIT — permissive and shorter; no patent clause, no trademark reservation.
3. AGPL-3.0 — strong copyleft, also over network use; keeps forks open but deters adoption and integration by companies and agent tooling.
4. Proprietary / source-available (BUSL, PolyForm) — maximum control; not open source, incompatible with distribution via public `npx` as a community tool.

## Decision
- License `Apache-2.0` in `package.json`; full official text in `LICENSE` (apache.org, sha256 `cfc7749b…3d30`); `NOTICE` with "Copyright 2026 Iván López" shipped in the tarball (`files`).
- Chosen as the permissive license that protects the author most: disclaimer, patent retaliation and trademark reservation (Apache-2.0 §6–§8).
- Compatible with every current dependency; MPL-2.0 code stays under MPL-2.0 inside `dist/ui` with its notice (NFR-009).

## Consequences
- Positive: unblocks publishing (PLAN-004); companies can adopt it without legal friction.
- Negative / costs: third parties may build closed derivatives (allowed by a permissive license); they must keep LICENSE/NOTICE and mark changes.

## Affected elements
NFR-009 (own license defined), `LICENSE`, `NOTICE`, `package.json`, `test/e2e/npx.test.ts` (tarball carries LICENSE and NOTICE).

## Verification
`test/package/licenses.test.ts` checks the `license` field, the sha256 of `LICENSE` and the copyright line in `NOTICE`; `test/e2e/npx.test.ts` asserts that both files are in the packed tarball.
