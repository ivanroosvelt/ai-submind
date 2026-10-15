---
id: FEAT-008
type: feature
name: "Git integrity"
status: active
evidence: verified-code
summary: "Detection of merge conflicts, duplicate IDs and broken references, exposed in CLI, MCP and UI."
aliases: ["git", "merge", "conflicts"]
tags: [integrity]
implementation: verified
code:
  - src/format/document.ts#parseDocument
  - src/format/semantic.ts#checkKnowledge
  - src/engine/engine.ts#Engine
  - src/engine/edit.ts#plan
  - src/query/filters.ts#resolveId
  - src/cli/commands.ts#validate
  - src/mcp/tools.ts#createMcpServer
  - src/daemon/ui-api.ts#uiRoutes
  - src/daemon/project.ts#ensureLocalDir
test_code:
  - test/integrity/merge.test.ts
  - test/format/rules.test.ts
  - test/engine/engine.test.ts
  - test/engine/edit.test.ts
  - test/query/query.test.ts
  - test/daemon/cli.test.ts
relations:
  entities: []
  functions: []
  interfaces: []
  integrations: []
  depends_on: [FEAT-002, FEAT-003]
  decisions: [DEC-014, DEC-016]
uncertainties:
  - "Assisted repair of duplicate ids: later."
---

# FEAT-008 · Git integrity

## Description
Post-merge diagnosis without silent repair: a file with conflict markers is `conflicted` (not indexed, never written:
while it is unreadable, writes that add IDs fail with `CREATE_BLOCKED`, `rename` with `RENAME_BLOCKED`, and a
write to a conflicted layout with `DOCUMENT_INVALID`), duplicate IDs are reported per occurrence and queries,
writes on them and new references to them fail with `AMBIGUOUS_ID`, broken references are reported while the rest loads. Exposed by `ai-submind validate`, the MCP
`validate` tool and `GET /api/findings` (UI findings panel). `knowledge/.ai-submind/` ignores itself through its
own `.gitignore` (DEC-014); the user's `.gitignore` is never edited.

## Behavior
REQ-034..036. Write rules while knowledge is inconsistent (unreadable documents, duplicated IDs): DEC-016.

## States and transitions
See document states in FEAT-002.

## Dependencies
FEAT-002, FEAT-003.

## Risks
More conflicts due to a single model file (DEC-002).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
