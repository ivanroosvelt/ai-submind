---
id: DEC-020
type: decision
name: "Cross-diagram relations: operation behavior, links extension and format 1.1 with explicit migrate"
status: active
evidence: declared-doc
summary: "Operations gain a typed `behavior` (ref to an interaction) and every element with an id, the model and the diagrams gain a generic `links` extension (set of refs to any element, model or diagram); both arrive in format 1.1 (minor) with an explicit, deterministic migrate operation 1.0 → 1.1."
aliases: [behavior, operation method, links, flows of flows, drill-down, format 1.1, migrate, 1.0-to-1.1]
tags: [format, contracts, migrations, ui]
relations:
  affects: [REQ-041, REQ-042, REQ-043, API-004, ENT-003, ENT-004, VAL-003, VAL-004, FEAT-003, FEAT-007, FEAT-009, NFR-011]
  supersedes: []
uncertainties: []
---

# DEC-020 · Cross-diagram relations: operation behavior, links extension and format 1.1 with explicit migrate

## Context
- User, 2026-10-16 (translated): entities should keep their relations across diagrams of different kinds, and an
  element of a flow should be able to reference another whole flow file, so that flows of flows can be built
  (PLAN-005) [declared].
- Format 1.0 already has cross-kind references towards the class side: `lifeline.represents` → classifier or
  actor, `message.signature` → operation, `interaction_use.interaction` → interaction (spec §6.5, §10.2). There is
  no reference from the class side to a flow (which interaction implements an operation) and no reference whose
  target is a model or a diagram as a whole [verified in spec and `src/format/semantic.ts`].
- IDs are global (spec §3.1, §4; DEC-003): a reference may already cross model files without new syntax [declared].
- Format 1.0 is published in `ai-submind` 0.1.1 and its schemas use `additionalProperties: false` [verified]; so
  DEC-018's route (amend 1.0) is no longer available: a 1.0 reader would reject the new keys.
- Spec §11: a minor version only adds optional keys; earlier supported versions load with
  `FORMAT_VERSION_OUTDATED`. DEC-010 (proposed) fixes how migrations are shipped [declared].
- User decisions, 2026-10-16: (1) both mechanisms, `behavior` and `links`; (2) UI drill-down navigation plus a
  visible marker on navigable elements; (3) format 1.1 plus an explicit `migrate` 1.0 → 1.1 [declared].

## Alternatives considered
1. **Mechanism**
   - **`links` only** — one generic key covers every case; but "the flow that implements this operation" would be an
     untyped link among others: no `REF_TYPE_MISMATCH`, and queries and the UI cannot tell it apart.
   - **`behavior` only** — typed and faithful to UML (`Operation.method`); but it cannot reference a whole model or
     diagram, nor relate a class, a lifeline or a fragment to another flow.
   - **Both** (chosen) — `behavior` for the UML case with type checking; `links` for everything else.
2. **Version**
   - **Amend 1.0** — no migration; but 1.0 is published and closed (`additionalProperties: false`): files written
     with the new keys would be `SCHEMA_VIOLATION` for 0.1.1 users, silently.
   - **Stamp on write** (any write upgrades `format_version` to 1.1) — no explicit step; but it contradicts spec §11
     and NFR-011 (never a silent version rewrite) and mixes a version change into unrelated diffs.
   - **1.1 + explicit `migrate`** (chosen) — honours §11 and DEC-010; costs two supported schemas at once.

## Decision
- **`behavior`** (format 1.1): optional key of an operation, a single reference to an **interaction** (any model).
  It states that the interaction describes the operation's behavior (UML `Operation.method`). Any other target is
  `REF_TYPE_MISMATCH`. Not added to classifiers: `links` covers them.
- **`links`** (format 1.1): optional extension (spec §7.1) on every element with an `id`, on the model and on the
  diagrams; a **set** of references (`[{"idref": ...}]`, sorted by `idref`, no duplicates) whose target may be any
  element, **model or diagram** (a whole file). Not on the manifest or layouts. Meaning: "see also / drills down
  to"; no further UML semantics. A link to the element, model or diagram that carries it is the error
  `LINK_SELF`; links to its own model or to other elements of the same file are valid.
- Both use the uniform reference shape (spec §4), so `rename` rewrites them and deleting their target follows the
  engine's `cascade` like any other reference.
- **Format 1.1** is the current version; 1.0 stays supported:
  - 1.0 documents load with the warning `FORMAT_VERSION_OUTDATED`, are validated with the 1.0 schema (kept in
    `spec/format/schema/1.0/`), and remain writable as 1.0 without the new keys.
  - A write that would add `behavior` or `links` to a 1.0 document is rejected with the operation code
    `MIGRATION_REQUIRED`, which names `migrate`. New documents are written as 1.1.
- **`migrate` 1.0 → 1.1** is an explicit operation (engine, MCP and CLI): it rewrites `format_version` from `1.0`
  to `1.1` in every 1.0 document (models, layouts and manifest) in canonical form, and changes nothing else (1.1 only adds optional keys, so a valid 1.0 document is valid 1.1). Idempotent; supports
  `dryRun` (REQ-027). The batch is validated as a whole and written sequentially; re-running it is idempotent (no
  stronger atomicity is claimed). If a 1.0 document is not loaded (phase 1 or 3 error) it fails with `MIGRATE_BLOCKED` and
  writes nothing. Documents of any other version are left untouched.
- **UI drill-down to a model** (PLAN-005 S5): a model target opens the model's first diagram by ID (the tree's
  order); a model without diagrams shows the notice "Model X has no diagrams" and the UI stays where it is.
- **Guide** (DEC-010): `spec/format/migrations/1.0-to-1.1/README.md` with before/after. This refines DEC-010 on
  two points: the guide file is `README.md` (rendered by Git hosts), and this hop is fully mechanical, so the
  engine performs it deterministically; the guide is for people and agents that edit files by hand. DEC-010
  becomes active when PLAN-005 S2b ships the operation and its corpus test.

## Consequences
- Positive: class ↔ sequence relations navigable in both directions; flows of flows (operation → interaction,
  any element → model or diagram); 0.1.1 users are never surprised by unknown keys in 1.0 files; first real use of
  the migration path.
- Negative / costs: two schemas (1.0 and 1.1) loaded at once; writes must check the document version; one more
  semantic rule (`LINK_SELF`) and two operation codes; `spec/format/migrations/` must be added to the package
  `files` (DEC-010 says the guides are published). Cycles between flows (A → B → A) are valid and must not make
  queries or the UI recurse without bound.

## Affected elements
REQ-041, REQ-042, REQ-043, API-004, ENT-003, ENT-004, VAL-003, VAL-004, FEAT-003, FEAT-007, FEAT-009, NFR-011.
Related decisions: DEC-002 (format derived from UMJ), DEC-003 (global readable IDs), DEC-010 (migration guides),
DEC-018 (last amendment of 1.0 before release).

## Verification
PLAN-005 S2–S2b: `migrate` is the engine method `Engine.migrate({dryRun})` → `{migrated, revisions, diff}`, the MCP tool
`migrate` and the CLI `ai-submind migrate [--dry-run]`. PLAN-005 S1: spec `spec/format/README.md` updated to 1.1 and guide written; `scripts/check`. Implementation and
tests: PLAN-005 S2–S6.
