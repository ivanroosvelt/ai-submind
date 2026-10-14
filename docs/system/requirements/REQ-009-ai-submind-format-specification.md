---
id: REQ-009
type: requirement
name: "ai-submind format specification"
status: active
evidence: declared-doc
summary: "The project must publish its own versioned specification of the format, derived from UMJ and citing it"
aliases: ["spec", "umj"]
tags: [format]
relations:
  actors: []
  features: [FEAT-003]
  constraints: [NFR-009, VAL-001]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-009 · ai-submind format specification

## Statement

The project must publish its own versioned specification of the format, derived from UMJ and citing it.

## Source

User [U]; UMJ paper; DEC-002. Proposed in REP-003 Annex A.

## Acceptance criteria

1. The spec covers the class and sequence elements of the UMJ catalog that the format adopts, and documents the deviations.
2. Written in its own words, without reproducing tables, with citation and license of the paper.
3. A versioned, executable JSON Schema 2020-12 that implements it exists.
4. Class and sequence in the first scope.

## Business rules

-

## Errors and edge cases

See criteria.

## Out of scope

Deleting `UMJ.pdf` is a closing task of PLAN-002 (S13), not product behavior.
