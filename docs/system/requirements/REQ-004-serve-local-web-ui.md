---
id: REQ-004
type: requirement
name: "Serve local web UI"
status: active
evidence: declared-doc
summary: "ACT-001 can open the UI in the browser"
aliases: ["ui", "browser"]
tags: [ui]
relations:
  actors: [ACT-001]
  features: [FEAT-001, FEAT-007]
  constraints: [NFR-004]
  depends_on: [REQ-037]
  decisions: []
uncertainties:
  - "How the browser receives the token (NFR-004)."
---

# REQ-004 · Serve local web UI

## Statement

ACT-001 can open the UI in the browser to explore diagrams served by the daemon.

## Source

User [U]; DEC-005, DEC-006. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given the daemon ready, when the reported URL is opened, then the UI is served only on 127.0.0.1 and requires the session token.
2. Given the preferred port is taken, when it starts, then it uses a free port and records it in `runtime.json`.
3. Given `ai-submind stop`, when it finishes, then nothing is left listening.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
