---
id: DEC-015
type: decision
name: "MCP auto-layout, implicit init on first write and dry run"
status: active
evidence: declared-doc
summary: "MCP agents may trigger auto-layout of a diagram (tool lands in S9 with the shapes) but do not set coordinates; the first MCP write initializes `knowledge/` like `ai-submind init`; every MCP write accepts `dryRun`."
aliases: [auto-layout, init, dryRun, dry run]
tags: [mcp, contracts]
relations:
  affects: [API-001, FEAT-006, REQ-027]
  supersedes: []
uncertainties: []
---

# DEC-015 · MCP auto-layout, implicit init on first write and dry run

## Context
- API-001 left open whether agents may change layout (P9) [declared].
- PLAN-002 left open, for S8, whether the first write initializes `knowledge/` and whether REQ-027 (dry run)
  enters the plan [declared].
- The user chose on 2026-10-14: auto-layout, implicit init and dry run in S8 [declared].

## Alternatives considered
1. **Layout from MCP**: none (UI only); explicit coordinates; **auto-layout on demand** (chosen).
2. **No `knowledge/` on write**: typed error requiring `init`; **implicit init** (chosen).
3. **Dry run**: later increment; **in S8** (chosen).

## Decision
- **Layout**: MCP exposes an auto-layout tool for a diagram; it never takes raw coordinates. Node sizes come
  from the UI shapes, so the tool ships in PLAN-002 S9. Until then MCP writes touch layout only to keep it
  consistent (cascade on delete and rename).
- **Init**: when `knowledge/` does not exist, the first MCP write creates it exactly as `ai-submind init` does,
  then applies the write. Reads on a missing `knowledge/` return empty results, not errors.
- **Dry run**: every MCP write tool accepts `dryRun: true`; it runs the same validation and returns the same
  result and diff, writes nothing and does not trigger implicit init: the manifest is not written, although the
result reports `initialized: true` because that flag means "the write creates (in a dry run, would create)
`ai-submind.json`". REQ-027 becomes active.

## Consequences
- Positive: agents can bootstrap a project and preview changes without side effects.
- Negative / costs: auto-layout depends on S9; a dry run on a missing `knowledge/` validates against an empty
  knowledge base held in memory.

## Affected elements
API-001, FEAT-006, REQ-027; `src/mcp/` (S8), UI layout (S9).

## Verification
PLAN-002 S8 tests (implicit init, dry run); S9 tests (auto-layout tool).
