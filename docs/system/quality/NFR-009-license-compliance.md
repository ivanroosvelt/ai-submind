---
id: NFR-009
type: quality-attribute
name: "License compliance"
status: active
evidence: declared-doc
summary: "Dependencies with compatible licenses, clean-room for proprietary software and the UMJ spec rewritten and cited."
aliases: ["licenses", "clean-room", "rea"]
tags: [licenses]
relations:
  tests: []
  decisions: []
uncertainties:
  - "ai-submind's own license not yet defined (DEC-001)."
---

# NFR-009 · License compliance

## Requirement
Dependencies with compatible licenses; strong copyleft requires review; JointJS+ only clean-room from public documentation and behavior; REA only on artifacts without source when the license allows it (DEC-006). The format spec rewrites UMJ in our own words and cites it (CC BY-NC-ND 4.0, DEC-002).

## Metric and threshold

| Metric | Threshold | How it is measured |
|---------|--------|--------------|
| Dependencies with unreviewed license | 0 | S12 audit |

## Scope
Dependencies, UI, specification.

Source: REP-003 Annex A, adjusted to DEC-001..DEC-007.
