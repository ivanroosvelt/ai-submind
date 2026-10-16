---
id: DEC-011
type: decision
name: "Engine persistence: per-file atomic writes, SHA-256 revisions, no-new-errors acceptance and native recursive fs.watch"
status: active
evidence: declared-doc
summary: "The engine writes each file atomically (temporary file in .ai-submind/tmp, fsync, rename) without a multi-file journal, versions documents by the SHA-256 of their bytes, accepts a batch only if it introduces no new errors, and reloads with node:fs.watch recursive plus debounce."
aliases: [atomic write, revision, watcher, fs.watch, journal, transaction]
tags: [architecture, data, engine]
relations:
  affects: [FEAT-002, REQ-007, REQ-008, REQ-011, REQ-022, REQ-026, NFR-005]
  supersedes: []
uncertainties:
  - "A crash in the middle of a multi-file batch leaves some files new and others old; the validator reports the result (e.g. ID_DUPLICATE after an interrupted move) and git recovers it. A recovery journal can be added later without changing the API."
  - "node:fs.watch recursive does not see changes on some network file systems; reload() remains available as a fallback (MCP `validate` tool)."
  - "On macOS node:fs.watch recursive (FSEvents) starts asynchronously with no ready signal: changes made in the first moments after open (or between the initial load and the watcher start) are seen only with the next change or an explicit reload (MCP `validate`). Observed under parallel test load, PLAN-002 S8."
  - "Local threat model: between the symbolic-link checks of the parent directories and the final rename, a local process could swap a directory for a link (TOCTOU). The daemon runs as the user over the user's own repository; this is accepted as a residual risk."
---

# DEC-011 · Engine persistence and reload

## Context
- DEC-004 fixes the engine subset: transactional batches validated before writing, optimistic control by
  revision hash, atomic writes and reload on external changes [declared].
- REQ-008 requires that a killed process never leaves a truncated file; it does not require atomicity across
  files [declared].
- Node ≥22 supports `fs.watch(dir, { recursive: true })` on Linux, macOS and Windows [verified: Node 22.22.3 in
  the S5 tests].
- `knowledge/` may already contain errors (after a merge, REQ-034..036) and the engine must keep working
  in degraded mode (REQ-022) [declared].
- User (2026-10-14) chooses native `fs.watch`, per-file atomicity and scope of S5 [declared].

## Alternatives considered
1. Watcher: **`node:fs.watch` recursive** (no dependency) vs `chokidar` 4 (more robust on unusual file
   systems, one more runtime dependency).
2. Batch atomicity: **per file** vs recovery journal in `.ai-submind/` (all-or-nothing after a crash, more
   code and tests).
3. Acceptance of a batch: reject if the result has any error (blocks every write while `knowledge/` is
   degraded) vs **reject only if it introduces new errors**.

## Decision
- Write: temporary file in `knowledge/.ai-submind/tmp/` (same file system), `fsync`, `rename` over the target
  and `fsync` of the directory; never through a symbolic link. Creations and replacements before deletions,
  so an interrupted move leaves a duplicate instead of a loss. Leftover temporary files are removed on open.
- Revision of a document = SHA-256 (hex) of its bytes. `expectedRevision`: string = must match, `null` = must
  not exist. Every batch (and `rename`) first reloads what changed on disk, so validation runs against the
  current `knowledge/`; a batch over a document that changed that way, or whose bytes differ from memory right
  before writing, is a `REVISION_CONFLICT`, never overwritten (NFR-005). Writes are serialized inside the
  process. Documents reached through a symbolic link are read but never written (`PATH_OUTSIDE_KNOWLEDGE`);
  a broken `.ai-submind/` does not prevent opening, it only makes writes fail and is reported in
  `status().localError`.
- A batch is validated as a whole (phases 1–3 on the data as given, before serializing; phase 4 over the
  resulting `knowledge/`) and rejected with `VALIDATION_FAILED` if the number of errors with the same code,
  file and subject IDs (`subjects`, spec §10.4; the message when there are none) grows. `rename` compares after
  moving the files and renaming the subjects of existing errors; it fails with `INVALID_ID` if a resulting ID
  breaks the grammar, and with `RENAME_BLOCKED` also when a document path could not be read at all.
- Reload: `fs.watch` recursive, ignoring `.ai-submind/`, with a quiet period (100 ms by default, at most
  2 s since the first event of a burst) so that a checkout is reloaded as one batch; errors of the watcher or of an
  automatic reload are kept in `status().watchError` and emitted as `error` only if there is a listener; files are re-parsed only if their hash changed, and a `change` event with a
  semantic diff is emitted only if something changed (the engine's own writes produce no external event).

## Consequences
- Positive: no new dependencies; fixing a degraded `knowledge/` is possible document by document; the
  watcher never exposes intermediate states of a single burst.
- Negative / costs: no all-or-nothing guarantee across files after a crash (see uncertainties); a short
  window remains between the disk check and the rename in which an external write can be lost.

## Affected elements
FEAT-002, REQ-007, REQ-008, REQ-011, REQ-022, REQ-026, NFR-005; `src/engine/`.

## Verification
2026-10-14: `test/engine/engine.test.ts` (transactions, conflicts, confinement, rename, reload with watcher) and
mutations of the disk check, schema pre-validation, new-error rule, rename translation and rename blocking:
each one makes a test fail. Independent review (change-verifier, findings H1-H10) corrected with regression
tests; removing the reload before a batch makes the H1 test fail.
