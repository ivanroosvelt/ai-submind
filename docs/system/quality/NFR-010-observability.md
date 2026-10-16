---
id: NFR-010
type: quality-attribute
name: "Observability"
status: proposed
evidence: inferred
summary: "Logs to stderr with configurable level and no knowledge/ content by default (assumption)."
aliases: ["logs", "logging"]
tags: [quality]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Configurable level and the log content policy are analyst assumptions."
---

# NFR-010 · Observability

## Requirement
Logs to stderr (mandatory in stdio, REQ-003) with configurable level; by default no content of `knowledge/` is logged.

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Writes to stdout in mcp mode | 0 outside the protocol | `test/mcp/proxy.test.ts` |

## Scope
CLI, daemon, MCP proxy.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
