---
id: VAL-004
type: validation
name: "Supported format version"
status: active
evidence: verified-code
summary: "The document declares a version; 1.0 loads outdated and writable as 1.0, an unknown version prevents writing."
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
  - test/daemon/cli.test.ts
relations:
  tests: []
  decisions: [DEC-010, DEC-020]
uncertainties: []
---

# VAL-004 · Supported format version

## Rule
Version field present in `ai-submind.json` (and wherever the spec requires it). Supported version → load; earlier supported → warning and explicit migration; later than the supported one → `FORMAT_VERSION_UNSUPPORTED`, document read-only with tolerant reading (user, 2026-10-14; spec §11). Earlier without migration (`0.x`) → same treatment (proposed in PLAN-002 S4, confirmed by the user on 2026-10-14). Writes to a `read_only` document are rejected by the engine with `DOCUMENT_INVALID`, and writing an unsupported version fails with `VALIDATION_FAILED`. Current version 1.1; 1.0 is the earlier supported one: `FORMAT_VERSION_OUTDATED` (warning), validated with the 1.0 schema, writable keeping 1.0; a write that adds a 1.1 key to it or changes the `format_version` of an existing document is `MIGRATION_REQUIRED`; only `migrate` upgrades it (REQ-043; `MIGRATE_BLOCKED` while a 1.0 document does not load). Migrations: DEC-010, DEC-020.

## Applies to
ENT-001 and versioned documents.

## Message / error code
Error or warning depending on the case.

## Examples

| Input | Result |
|-------|--------|
| No version field | error |
| Later version (`2.0`) | FORMAT_VERSION_UNSUPPORTED, read-only |
| `1.0` | FORMAT_VERSION_OUTDATED (warning), writable as 1.0 |

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007. Exact grammar and codes: format spec (API-004, §10).
