---
id: ACT-002
type: actor
name: "AI agent (MCP client)"
status: active
evidence: declared-doc
summary: "Agent or tool that queries and administers the knowledge via the ai-submind MCP server."
aliases: ["agent", "mcp client", "llm", "claude code"]
tags: [external-system]
relations:
  specializes: []
uncertainties:
  - "P9: whether the agent may modify layout (e.g. request auto-layout) via MCP."
---

# ACT-002 · AI agent (MCP client)

## Description
MCP client (e.g. Claude Code) that launches `npx ai-submind mcp` over stdio or connects via Streamable HTTP
to the project daemon (DEC-005).

## Goals
Query the model (structure, relationships, impact, search) and create or modify models, elements and diagrams.

## Permissions

| Resource / operation | Allowed | Conditions |
|---------------------|-----------|-------------|
| Query tools | yes | read-only (API-001) |
| Administration tools (create/modify/delete/rename/batches/validate) | yes | prior validation, all or nothing (REQ-011, REQ-026) |
| Paths outside `knowledge/` | no | NFR-006 |
| Modify layout | to be decided | see uncertainty |
