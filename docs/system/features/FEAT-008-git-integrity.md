---
id: FEAT-008
type: feature
name: "Git integrity"
status: active
evidence: declared-doc
summary: "Detection of merge conflicts, duplicate IDs and broken references, exposed in CLI, MCP and UI."
aliases: ["git", "merge", "conflicts"]
tags: [integrity]
implementation: none
code: []
test_code: []
relations:
  entities: []
  functions: []
  interfaces: []
  integrations: []
  depends_on: [FEAT-002, FEAT-003]
  decisions: []
uncertainties:
  - "Assisted repair of duplicate ids: later."
---

# FEAT-008 · Git integrity

## Description
Post-merge diagnosis without silent repair; `init` adds `.ai-submind/` to `.gitignore`. PLAN-002 S10.

## Behavior
REQ-034..036.

## States and transitions
See document states in FEAT-002.

## Dependencies
FEAT-002, FEAT-003.

## Risks
More conflicts due to a single model file (DEC-002).

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
