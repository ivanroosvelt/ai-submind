# Changelog

All notable changes to `ai-submind` are recorded here. Versions follow semver; while in 0.x the knowledge
format may change only as described in [spec/format/README.md](spec/format/README.md) §11.

## 0.2.0 — 2026-10-17

- Knowledge format 1.1 (minor): operation `behavior` (reference to the interaction that implements it) and a
  `links` extension on every element with an id, the model and diagrams (references to any element, model or
  diagram); new semantic rule `LINK_SELF`. Format 1.0 stays supported (loads with `FORMAT_VERSION_OUTDATED`).
- `migrate` 1.0 → 1.1 as an MCP tool and a CLI command (`ai-submind migrate [--dry-run]`), with a migration
  guide in `spec/format/migrations/1.0-to-1.1/`. The CLI `migrate` and `init` refuse to run while the daemon is
  running.
- Queries: new relation group `links`; `behavior` belongs to the `sequence` group.
- Web UI: drill-down between diagrams; elements with a target show ↗ and open it by double click.
- MCP prompt `guide`: a hand-written workflow plus a reference generated from every registered tool and
  resource template.

## 0.1.1 — 2026-10-16

- README: quick start with `npx ai-submind` and the release process.
- First release through the `release` workflow: npm trusted publishing with provenance.

## 0.1.0 — 2026-10-16

First public release.

- Knowledge format 1.0 (JSON Schema 2020-12) with four-phase validation and canonical serialization.
- Embedded engine: atomic per-file writes, readable IDs, rename with reference rewriting, cascade delete.
- Structured queries and BM25F lexical search.
- CLI (`serve`, `status`, `stop`, `init`, `validate`, `mcp`) with a per-project local daemon.
- MCP server (stdio proxy and Streamable HTTP) with query and write tools, all with `dryRun`.
- Web UI for class and sequence diagrams; layout edits and auto-layout.
- Git integrity: diagnosis of merge conflicts, duplicate IDs and broken references.
- Apache-2.0 license.
