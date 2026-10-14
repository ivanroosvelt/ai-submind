---
id: REQ-003
type: requirement
name: "Expose MCP server"
status: active
evidence: declared-doc
summary: "ACT-002 must be able to connect to the `ai-submind` MCP server"
aliases: ["mcp", "stdio", "proxy"]
tags: [mcp]
relations:
  actors: [ACT-002]
  features: [FEAT-001, FEAT-004, FEAT-006]
  constraints: [NFR-004, NFR-010]
  depends_on: [REQ-037]
  decisions: []
uncertainties: []
---

# REQ-003 · Expose MCP server

## Statement

ACT-002 must be able to connect to the `ai-submind` MCP server to query and manage the knowledge.

## Source

User [U]; DEC-005. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given `npx ai-submind mcp` launched by a client, when there is no daemon, then it starts one and forwards messages over stdio.
2. Given the connected client, when it lists tools, then it receives the query and management tools with typed schemas.
3. Given stdio transport, when events are logged, then logs go only to stderr.
4. Given an HTTP client, when it uses the daemon's Streamable HTTP endpoint with a valid token, then it accesses the same tools.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
