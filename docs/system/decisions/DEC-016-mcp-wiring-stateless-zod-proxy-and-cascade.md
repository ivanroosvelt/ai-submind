---
id: DEC-016
type: decision
name: "MCP wiring: stateless handler, zod schemas, SDK proxy, camelCase arguments and cascade"
status: active
evidence: declared-doc
summary: "The daemon serves MCP with the SDK v2 stateless handler behind its own auth; tool schemas use zod 4; `ai-submind mcp` bridges stdio to HTTP with SDK transports and retries once through `ensureDaemon`; arguments are camelCase; `cascade` also deletes elements that cannot exist without the deleted one."
aliases: [mcp, stateless, zod, proxy, camelCase, cascade]
tags: [mcp, contracts, architecture]
relations:
  affects: [API-001, FEAT-006, REQ-003, REQ-023, REQ-024, REQ-026, REQ-027, NFR-004]
  supersedes: []
uncertainties: []
---

# DEC-016 · MCP wiring: stateless handler, zod schemas, SDK proxy, camelCase arguments and cascade

## Context
- API-001 fixes SDK `@modelcontextprotocol/server` v2 (2.3.1 on 2026-10-14). Its `createMcpHandler` is
  stateless by construction and serves 2025-era `initialize` clients through a legacy stateless fallback; it
  performs no auth, Host or Origin checks [verified in the package `.d.mts`].
- Tool schemas must implement Standard Schema with JSON Schema output; the SDK depends on `zod ^4.2.0` [verified].
- `@modelcontextprotocol/node` only adds `toNodeHandler` and pulls in `hono` [verified].
- The HTTP client transport derives the SEP-2243 headers (`MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`)
  that the modern server requires [verified].
- The user chose on 2026-10-14: camelCase arguments, the SDK client as a runtime dependency for the proxy, and a
  cascade that deletes dependent elements [declared].

## Alternatives considered
1. **HTTP mode**: stateful sessions (daemon keeps per-session state; inactivity never fires while a client is
   connected); **stateless** (chosen).
2. **Node adapter**: `@modelcontextprotocol/node` (hono); **own ~25-line `IncomingMessage` ↔ `Request` bridge** (chosen).
3. **Schemas**: Ajv as Standard Schema (extra glue); **zod 4** (chosen).
4. **Proxy**: own byte forwarder (~80 lines re-implementing headers and SSE parsing); **SDK transports** (chosen).
5. **Argument names**: snake_case (translation layer); **camelCase like the Query facade** (chosen).
6. **Cascade**: clean references only, fail with VALIDATION_FAILED if something becomes invalid;
   **also delete elements that cannot exist without the deleted one** (chosen).

## Decision
- `POST|GET|DELETE /mcp` on the daemon, behind the existing token, Host and Origin checks (DEC-014), served by
  `createMcpHandler(..., {legacy: "stateless"})` through an own Node bridge.
- Tool input schemas are zod 4 `strictObject`s. Typed errors: `isError: true`, text `"CODE: message"`,
  `structuredContent: {error: {code, message, details}}` for `EngineError` and `QueryError`.
- `ai-submind mcp`: `StdioServerTransport` down, `StreamableHTTPClientTransport` up with `Authorization: Bearer`;
  on connection refused or 401 it calls `ensureDaemon` again and retries once (the request never reached a
  handler). Logs go to stderr only.
- Tool arguments are camelCase (`dryRun`, `expectedRevision`, `cascade`).
- `cascade: true` removes array references to the deleted subtree, unsets optional references, and deletes
  elements whose mandatory reference pointed into the subtree (generalizations, association ends and their
  associations, realizations, occurrences on deleted lifelines…), repeating to a fixed point; everything is
  listed in `affected`. Layout entries of deleted elements and the layout of deleted diagrams are removed.
  Mandatory also covers the message events its `kind` requires (spec §6.5: `complete` both, `lost`
  `send_event`, `found` `receive_event`; otherwise the event is unset). A message deleted by a cascade takes
  with it its occurrences that no other message uses, so no `OCCURRENCE_UNUSED` warning is left. A list with `minItems: 1` left empty
  deletes its owner: `covered` of a combined fragment or interaction use, `operands` of a combined fragment, and
  `elements` of a sequence diagram (so deleting an interaction deletes its diagram and that diagram's layout).
  Only an association end cannot be deleted alone (INVALID_ARGUMENT: delete its association); every other
  element of the garage corpus cascade-deletes to valid knowledge with no new warning (`test/engine/edit.test.ts`).

## Consequences
- Positive: one auth path for MCP, UI and API; no per-session state, so DEC-014 inactivity works while a proxy is
  connected and the proxy restarts the daemon transparently.
- Negative / costs: about ten MIT transitive packages from the SDK client; no server-to-client requests
  (sampling, elicitation); a cascade may delete more than the agent expects (mitigated by `dryRun` and `affected`).

## Affected elements
API-001, FEAT-006, REQ-003, REQ-023, REQ-024, REQ-026, REQ-027, NFR-004 (complements DEC-014); `src/mcp/`, `src/engine/edit.ts`,
`src/cli/proxy.ts`, `src/daemon/server.ts`.

## Verification
PLAN-002 S8 tests in `test/engine/edit.test.ts` and `test/mcp/`.
