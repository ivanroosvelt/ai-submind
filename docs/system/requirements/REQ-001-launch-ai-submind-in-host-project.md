---
id: REQ-001
type: requirement
name: "Launch ai-submind in the host project"
status: active
evidence: declared-doc
summary: "ACT-001 can run `npx ai-submind` (or `ai-submind serve`) in a project"
aliases: ["npx", "serve", "start"]
tags: [cli]
relations:
  actors: [ACT-001]
  features: [FEAT-001]
  constraints: [NFR-001, NFR-006]
  depends_on: []
  decisions: []
uncertainties:
  - "P11: default port and automatic browser opening."
---

# REQ-001 · Launch ai-submind in the host project

## Statement

ACT-001 can run `npx ai-submind` (or `ai-submind serve`) in a project to start the daemon over its `knowledge/`.

## Source

User [U]; DEC-001, DEC-005. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a cwd inside a git repo, when the command runs, then the root is `git rev-parse --show-toplevel` (without git: the cwd) and `<root>/knowledge` or `--knowledge <dir>` confined to the root is used.
2. Given startup, when loading finishes, then it reports on stderr the `knowledge/` path, loaded/invalid files and the UI URL.
3. Given Node < 22, when it runs, then it exits with code ≠ 0 and an explicit message.
4. Given a daemon already active for the project, when it runs again, then it reuses that daemon (REQ-037).

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
