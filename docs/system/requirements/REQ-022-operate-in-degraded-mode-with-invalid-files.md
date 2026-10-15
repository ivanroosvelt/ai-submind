---
id: REQ-022
type: requirement
name: "Operate in degraded mode with invalid files"
status: active
evidence: declared-doc
summary: "ai-submind must keep operating with the valid files and block writes on the invalid ones"
aliases: ["degraded"]
tags: [engine]
relations:
  actors: [ACT-002]
  features: [FEAT-002, FEAT-004]
  constraints: [VAL-006]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-022 · Operate in degraded mode with invalid files

## Statement

ai-submind must keep operating with the valid files and block writes on the invalid ones.

## Source

Analyst assumption. Proposed in REP-003 Annex A.

## Acceptance criteria

1. Given a file with malformed JSON or conflict markers, when ACT-002 tries to modify an element that lives in it, then error `DOCUMENT_INVALID` with details.
2. Queries indicate that there are excluded documents.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

-
