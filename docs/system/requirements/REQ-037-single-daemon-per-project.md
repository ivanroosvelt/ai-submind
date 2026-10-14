---
id: REQ-037
type: requirement
name: "Single daemon per project"
status: active
evidence: declared-doc
summary: "ai-submind must run a single daemon per project that serves UI and MCP, manageable with `status` and `stop`"
aliases: ["daemon", "lockfile", "runtime.json"]
tags: [process]
relations:
  actors: [ACT-001, ACT-002]
  features: [FEAT-001]
  constraints: [NFR-004, NFR-005]
  depends_on: []
  decisions: []
uncertainties:
  - "Shutdown: manual, on inactivity or when the last client closes (DEC-005)."
---

# REQ-037 · Single daemon per project

## Statement

ai-submind must run a single daemon per project that serves UI and MCP, manageable with `status` and `stop`.

## Source

User (2026-10-14); DEC-005. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given two concurrent starts in the same project, then only one creates the daemon (lockfile) and the other reuses it.
2. Given an orphan lockfile (dead pid), when starting, then it is recovered.
3. The daemon writes `knowledge/.ai-submind/runtime.json` (pid, port, token) with 0600 permissions.
4. `ai-submind status` reports the state; `ai-submind stop` stops it.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
