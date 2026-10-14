---
id: DEC-010
type: decision
name: "Format migrations as versioned from→to guides for LLM agents"
status: proposed
evidence: declared-doc
summary: "Every format version change ships a migration guide spec/format/migrations/<from>-to-<to>/ with step-by-step instructions an LLM agent can follow, a before/after corpus tested in CI, and an explicit migrate operation that is the only write allowed on documents of another version."
aliases: [migration, format migration, upgrade, from-to, migration guide]
tags: [format, versioning, migrations]
relations:
  affects: [VAL-004, NFR-011, API-004]
  supersedes: []
uncertainties:
  - "Whether trivial mechanical steps also ship a deterministic transform script next to the guide, or the guide alone is enough: decide with the first real version change."
  - "Shape of the migrate operation in CLI and MCP (one document per call vs a batch per version hop): fixed in the plan that implements this decision."
---

# DEC-010 · Format migrations as versioned from→to guides for LLM agents

## Context
- Spec §11: a document whose version is not the supported one (later, or earlier without migration) is
  opened read-only with tolerant reading; earlier supported versions are only updated through an explicit
  migration [declared].
- User, 2026-10-14 (translated): the read-only rule is fine, but plan something to update without much
  complication, perhaps versioned from→to instructions for the LLM [declared].
- The main maintainers of `knowledge/` are AI agents working through MCP (ACT-002); knowledge files are
  small, canonical JSON under Git, so an agent can rewrite them and Git keeps the previous state [declared].
- Only version 1.0 exists today: there is nothing to migrate yet [verified].

## Alternatives considered
1. **Versioned guides for LLM agents** (`<from>-to-<to>`), with a before/after corpus — cheap to write,
   handles judgment calls (deriving new required fields, renamed concepts), reviewable as a Git diff; relies
   on validation to catch agent mistakes.
2. Coded migrators only (one function per hop) — deterministic, but every change needs code, tests and a
   release, and cases that need judgment cannot be automated.
3. No migrations: users recreate documents — loses data; contradicts NFR-011.

## Decision
Alternative 1 (proposed; it becomes active with the plan that implements it, at the first format change).
- **Location**: `spec/format/migrations/<from>-to-<to>/` (e.g. `1.0-to-1.1/`), published with the package.
  Migrating across several versions chains hops (1.0→1.1→2.0); there is no direct 1.0→2.0 guide unless
  written on purpose.
- **Guide** (`GUIDE.md`, English, written for an LLM agent and readable by people), fixed sections:
  1. *Summary* of the changes and the document kinds affected (manifest, model, layout).
  2. *Steps*: ordered rules "where X → do Y", each with a minimal JSON before/after.
  3. *Derived values*: how to fill new required fields; when the value cannot be derived, stop and ask a
     person (never invent).
  4. *Invariants*: IDs and references unchanged unless a step says otherwise; no data loss — anything that
     cannot be mapped is reported, not dropped; result in canonical form (spec §9).
  5. *Checklist*: validate against the target version with zero errors; review the Git diff.
- **Corpus**: `examples/before/knowledge/` (valid with the source schema) and `examples/after/knowledge/`
  (valid and canonical with the target schema); a test in `npm test` checks both, so a guide cannot be
  merged without a working example.
- **Schemas of supported versions are kept** (`spec/format/schema/<version>/`) so that every document is
  validated with the schema of its own version (spec §11).
- **Explicit operation**: `migrate` (CLI and MCP) lists the documents that need it, returns the chain of
  guides, and accepts the migrated document only if it validates against the target version; it then writes
  it in canonical form with the new `format_version`. It is the only write allowed on a document whose version
  is not writable; the read-only rule of spec §11 stays as is. `dry_run` reports without writing (REQ-027).
- **Definition of done of a format change**: new schema + spec update + migration guide + corpus test.

## Consequences
- Positive: upgrading is "ask the agent to follow the guide and validate"; judgment cases are covered;
  every migration is reviewable in Git and reversible with Git.
- Negative / costs: correctness depends on the agent following the guide; mitigated by target-schema
  validation, the before/after corpus and Git review. One guide per hop to write and maintain.

## Affected elements
VAL-004 (version handling), NFR-011 (format compatibility), API-004 (format contract: `spec/format/migrations/`),
spec §11.

## Verification
Not implemented: there is a single format version. It is verified with the first version change (guide,
corpus test, `migrate` operation).
