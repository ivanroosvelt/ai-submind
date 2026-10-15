---
id: DEC-005
type: decision
name: "Single daemon per project with stdio MCP proxy"
status: active
evidence: declared-doc
summary: "One process per project serves UI and MCP (Streamable HTTP on loopback); `ai-submind mcp` over stdio connects to it or starts it. A single writer."
aliases: [daemon, process, mcp, stdio, http, lockfile]
tags: [architecture, security, contracts]
relations:
  affects: [REQ-001, REQ-003, REQ-004, REQ-037, NFR-004, NFR-005, NFR-006, FEAT-001, API-001, API-002, API-003]
  supersedes: []
uncertainties: []
---

# DEC-005 · Single daemon per project with stdio MCP proxy

## Context
- User chose "Single daemon + MCP proxy" (2026-10-14) [declared].
- Stable MCP SDK v2: `@modelcontextprotocol/server` 2.3.1; stdio and Streamable HTTP transports [verified: npm].
- Claude Code registers stdio servers via `.mcp.json` with `npx` [verified: tech-research].
- Planned registration: `{"mcpServers":{"ai-submind":{"type":"stdio","command":"npx","args":["-y","ai-submind","mcp"]}}}` [inferred].

## Alternatives considered
1. **Daemon + stdio proxy** — a single writer, UI and agents see the same state.
2. One stdio process per agent — simple; several writers and a separate UI.
3. HTTP only — no proxy; worse integration with clients that expect stdio.

## Decision
- `npx ai-submind` (or `ai-submind serve`): starts the project daemon; HTTP on `127.0.0.1` (free port),
  serves the UI, the UI API and the MCP Streamable HTTP endpoint.
- `npx ai-submind mcp`: stdio transport; locates the daemon through `knowledge/.ai-submind/runtime.json`
  (pid, port, token) and starts it if it does not exist; forwards messages. Logs only to stderr.
- A lockfile guarantees one daemon per project. Shutdown, port, browser token and local directory: DEC-014.
- Security: bind to loopback only; random per-session token in `runtime.json` (permissions 0600);
  `Host`/`Origin` validation (anti DNS-rebinding); paths confined to `knowledge/`.

## Consequences
- Positive: consistency and no write races.
- Negative / costs: daemon lifecycle management and recovery of orphaned lockfiles.

## Affected elements
CLI, MCP, UI, security (CAP-013).

## Verification
Pending: tests for concurrent startup, orphaned lock, rejection of foreign Origin, real MCP client.
