---
id: REQ-043
type: requirement
name: "Migrate knowledge from format 1.0 to 1.1"
status: active
evidence: declared-doc
summary: "ACT-002 or ACT-001 can explicitly migrate every 1.0 document of knowledge/ to format 1.1 in one batch (validated as a whole, written sequentially, idempotent), with dry run. Implemented in the engine, MCP tool `migrate` and CLI `ai-submind migrate [--dry-run]` (PLAN-005 S2b)"
aliases: ["migrate", "migration", "1.0-to-1.1", "format upgrade"]
tags: [format, migrations, mcp, cli]
relations:
  actors: [ACT-002, ACT-001]
  features: [FEAT-003]
  constraints: [VAL-004, NFR-011]
  depends_on: [REQ-026, REQ-027]
  decisions: [DEC-020, DEC-010]
uncertainties: []
---

# REQ-043 · Migrate knowledge from format 1.0 to 1.1

## Statement

ACT-002 (MCP) or ACT-001 (CLI) can migrate the 1.0 documents of `knowledge/` to format 1.1 with an explicit
operation, in order to use the 1.1 keys (`behavior`, `links`) without ever rewriting a version silently.

## Source

User (2026-10-16, PLAN-005): "1.1 + explicit migrate"; DEC-020; DEC-010; spec §11.

## Acceptance criteria

1. Given 1.0 documents (models, layouts, manifest), when `migrate` runs, then each one is rewritten in canonical
   form with `format_version` `1.1` and no other change, in one batch validated as a whole and written
   sequentially; re-running it is idempotent.
2. Given `dryRun`, then the documents that would change are reported and nothing is written.
3. Given no 1.0 document, then `migrate` succeeds without writing (idempotent).
4. Given a 1.0 document not loaded (phase 1 or 3 error), then `migrate` fails with `MIGRATE_BLOCKED` and writes
   nothing.
5. Given documents of another version (later or unsupported), then they are left untouched.
6. Given a 1.0 document, when it is written for any other reason, then it stays 1.0 (no stamp on write).
7. The guide `spec/format/migrations/1.0-to-1.1/` describes the change with a before/after example.

## Business rules

- `migrate` is the only operation that changes `format_version` of an existing document (spec §11).

## Errors and edge cases

`MIGRATE_BLOCKED`; a later 1.x version stays read-only (`FORMAT_VERSION_UNSUPPORTED`).

## Out of scope

Migrations between other versions.
