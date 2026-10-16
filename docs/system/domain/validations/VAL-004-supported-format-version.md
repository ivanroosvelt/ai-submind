---
id: VAL-004
type: validation
name: "Supported format version"
status: active
evidence: verified-code
summary: "The document declares a version; an unknown version prevents writing."
aliases: ["format_version"]
tags: [validation]
implementation: verified
code:
  - src/format/document.ts#parseDocument
  - src/engine/engine.ts#Engine
test_code:
  - test/format/corpus.test.ts
  - test/format/rules.test.ts
  - test/engine/engine.test.ts
relations:
  tests: []
  decisions: [DEC-010]
uncertainties:
  - "`FORMAT_VERSION_OUTDATED` is not emitted yet: 1.0 is the first version and there is no earlier supported version; every version other than 1.0 is opened read-only (spec §11)."
---

# VAL-004 · Supported format version

## Rule
Version field present in `ai-submind.json` (and wherever the spec requires it). Supported version → load; earlier supported → warning and explicit migration; later than the supported one → `FORMAT_VERSION_UNSUPPORTED`, document read-only with tolerant reading (user, 2026-10-14; spec §11). Earlier without migration (`0.x`) → same treatment (proposed in PLAN-002 S4, confirmed by the user on 2026-10-14). Writes to a `read_only` document are rejected by the engine with `DOCUMENT_INVALID`, and writing a version other than the supported one fails with `VALIDATION_FAILED`. Migrations: DEC-010.

## Applies to
ENT-001 and versioned documents.

## Message / error code
Error or warning depending on the case.

## Examples

| Input | Result |
|-------|--------|
| No version field | error |
| Later version (`2.0`) | FORMAT_VERSION_UNSUPPORTED, read-only |

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Exact grammar and codes: format spec (API-004, §10).
