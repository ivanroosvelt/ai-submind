---
id: API-001
type: interface
name: "ai-submind MCP server"
status: active
evidence: verified-code
summary: "Typed MCP tools for querying and administering knowledge, over stdio (proxy) or stateless Streamable HTTP on the daemon."
aliases: ["mcp", "mcp tools", "streamable http"]
tags: [contracts]
implementation: implemented
code:
  - src/mcp/tools.ts#createMcpServer
  - src/mcp/http.ts#mcpRoutes
  - src/cli/proxy.ts#proxy
  - src/engine/edit.ts#edit
  - src/layout/class-layout.ts#autoLayout
test_code:
  - test/mcp/tools.test.ts
  - test/mcp/http.test.ts
  - test/mcp/proxy.test.ts
relations:
  providers: []
  consumers: [ACT-002]
  entities: [ENT-002, ENT-003, ENT-004]
  validations: [VAL-001, VAL-002, VAL-003, VAL-006, VAL-007]
  tests: []
  decisions: [DEC-005, DEC-014, DEC-015, DEC-016, DEC-017]
uncertainties:
  - "Versioning of the MCP contract."
  - "No output schemas yet: results are JSON text plus `structuredContent`."
---

# API-001 · ai-submind MCP server

## Contract
MCP server `ai-submind` (SDK `@modelcontextprotocol/server` 2.3.1, input schemas in zod 4) served by the daemon at
`POST|GET|DELETE /mcp` with `createMcpHandler(..., {legacy: "stateless"})`: a new server instance per request, no
session state, 2025-era clients served by the legacy stateless fallback (GET/DELETE answer 405). `ai-submind mcp`
is the stdio proxy (DEC-005, DEC-016). Arguments are camelCase. Every result is returned as JSON text and as
`structuredContent`; query results keep the query facade's shape `{data, meta}` (FEAT-004).

## Operations

| Tool | Input | Output | Errors |
|------|-------|--------|--------|
| `list_models` | `offset?`, `limit?` | page of models with counts and validity | INVALID_ARGUMENT |
| `list_diagrams` | `model?`, `kind?`, page | page of diagrams with layout status | NOT_FOUND, INVALID_ARGUMENT |
| `get_element` | `id` | element, type, owner, file, children, content | NOT_FOUND, AMBIGUOUS_ID |
| `find_elements` | filter (type, model, package, diagram, owner, interaction, name+match, tags, stereotypes, code refs, documentation, visibility), page | page of element summaries | INVALID_ARGUMENT |
| `search` | `text`, `mode?`, `prefix?`, filter, page | ranked hits (BM25F) | INVALID_ARGUMENT |
| `relations` | `id`, `direction?`, `kinds?`, `keys?`, `groups?`, page | page of edges | NOT_FOUND, AMBIGUOUS_ID, INVALID_ARGUMENT |
| `impact` | `id`, `direction?`, `maxDepth?`, `kinds?`, `limit?` | dependents/dependencies with depth and files | NOT_FOUND, INVALID_ARGUMENT |
| `paths` | `from`, `to`, `directed?`, `mode?`, `maxLength?`, `maxPaths?`, `kinds?`, `throughHubs?` | simple paths | NOT_FOUND, INVALID_ARGUMENT |
| `validate` | - | reload from disk, then `{state, errors, warnings, findings}` | |
| `create_element` | `type`, `parent?` (required unless `model`), `data`, `index?`, `expectedRevision?`, `dryRun?` | write result | INVALID_ARGUMENT, NOT_FOUND, REVISION_CONFLICT, INVALID_ID, DOCUMENT_INVALID, VALIDATION_FAILED |
| `update_element` | `id`, `patch` (RFC 7396 merge patch; `null` removes = unknown; `id` rejected, use `rename`), `expectedRevision?`, `dryRun?` | write result | same |
| `delete_element` | `id`, `cascade?`, `expectedRevision?`, `dryRun?` | write result | REFERENCED (with `references`), same |
| `edit_diagram` | `id`, `add?`, `remove?`, `expectedRevision?`, `dryRun?` | write result | VALIDATION_FAILED (`DIAGRAM_ELEMENT_NOT_ALLOWED`), same |
| `apply_batch` | `operations` (`op`: create, update, delete, edit_diagram), `dryRun?` | one write result, all or nothing | any of the above |
| `rename` | `id`, `newId`, `dryRun?` | revisions, diff, `renamed` pairs | NOT_FOUND, AMBIGUOUS_ID, INVALID_ID, RENAME_COLLISION, RENAME_BLOCKED, VALIDATION_FAILED |
| `auto_layout_diagram` | `diagram`, `dryRun?` | `{dryRun, initialized, layout, revisions, diff, generation}` | NOT_FOUND, AMBIGUOUS_ID, INVALID_ARGUMENT (not a class diagram), REVISION_CONFLICT, DOCUMENT_INVALID, VALIDATION_FAILED |

Write result: `{dryRun, initialized, created, affected, revisions, diff, generation}`; `affected` lists every
cascade step as `{action: "removed_ref" | "unset" | "deleted", file, pointer, id}`, in execution order; each
`pointer` is relative to `file` as left by the preceding entries, so a pointer may repeat (e.g. `/…/fragments/0`
twice when two consecutive items are removed). `__proto__`, `constructor` and `prototype` keys in `data` or
`patch` are rejected with INVALID_ARGUMENT. `auto_layout_diagram` recomputes every node position of a class diagram with the module shared with the UI
(`src/layout/`, DEC-017): node sizes from the shape text, dagre top-to-bottom with parents and interfaces above;
explicit sizes (a minimum, spec §8) and styles are kept, link vertices dropped, entries of elements no longer shown removed; an
unchanged layout is not rewritten. Agents never set coordinates (DEC-015). Every write tool except `create_element` is annotated
`destructiveHint: true`. Creating a model is
`create_element` with `type: "model"` (REQ-021); a diagram is created under its model, renamed with
`update_element` and deleted (with its layout) with `delete_element`. The first write on a `knowledge/` without
`ai-submind.json` creates it like `ai-submind init`; `initialized: true` means that the write creates (in a dry run,
would create) that manifest. A dry run validates and returns the same result without writing anything (DEC-015). `cascade` semantics: DEC-016.

Resources: `ai-submind://schema/{name}` (`ai-submind`, `defs`, `layout`, `model`: JSON Schemas of format 1.0),
`ai-submind://model/{id}` (model document as loaded), `ai-submind://diagram/{id}` (`{diagram, layout | null}`).

## Errors
Engine and query errors become tool results with `isError: true`, text `"CODE: message"` and
`structuredContent: {error: {code, message, details}}`. Input that does not match the tool's schema (unknown keys
included) is rejected by the SDK as a tool error. Any other failure is reported by the SDK as a generic tool error.

## Authentication and permissions
HTTP: the daemon's per-start token (Bearer or cookie), Host and Origin checks and loopback binding apply before
`/mcp` is dispatched (DEC-014, NFR-004); confined paths (NFR-006). stdio: `ai-submind mcp` reads the token from
`runtime.json`; on connection refused or 401 it calls `ensureDaemon` again and retries the request once, so a
stopped or restarted daemon is transparent to the agent (DEC-016). Model writes only through this channel (DEC-006).

## Versioning and compatibility
Typed input schemas (zod `strictObject`); contract versioning to be defined.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007; tools fixed in PLAN-002 S8 (DEC-015, DEC-016).
