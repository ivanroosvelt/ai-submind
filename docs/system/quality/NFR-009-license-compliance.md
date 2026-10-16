---
id: NFR-009
type: quality-attribute
name: "License compliance"
status: active
evidence: verified-code
summary: "Dependencies with compatible licenses, clean-room for proprietary software and the UMJ spec rewritten and cited."
aliases: ["licenses", "clean-room", "rea"]
tags: [licenses]
test_code: [test/package/licenses.test.ts, test/e2e/npx.test.ts]
relations:
  tests: []
  decisions: []
uncertainties:
  - "ai-submind's own license not yet defined (DEC-001): `package.json` says `UNLICENSED` and `private: true`; blocks publishing, not development."
---

# NFR-009 · License compliance

## Requirement
Dependencies with compatible licenses; strong copyleft requires review; JointJS+ only clean-room from public documentation and behavior; REA only on artifacts without source when the license allows it (DEC-006). The format spec rewrites UMJ in our own words and cites it (CC BY-NC-ND 4.0, DEC-002).

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Production dependencies outside the allowlist | 0 | `test/package/licenses.test.ts`: every package of `npm ls --omit=dev --all` has MIT, ISC, Apache-2.0 or BSD-3-Clause (`@joint/core`, MPL-2.0, is a development dependency bundled into `dist/ui`) |
| Bundled third-party code without its notice | 0 | Vite `build.license` writes `dist/ui/THIRD-PARTY-LICENSES.md`; `dist/ui/index.html` points to the source form of `@joint/core` (MPL-2.0 §3.2); `test/e2e/npx.test.ts` checks the notice file ships in the tarball (the `index.html` comment is checked by hand) |

## Scope
Dependencies, UI, specification.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
