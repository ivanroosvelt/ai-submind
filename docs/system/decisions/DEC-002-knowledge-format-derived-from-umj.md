---
id: DEC-002
type: decision
name: "Own knowledge format derived from UMJ: one file per model + separate layout"
status: active
evidence: declared-doc
summary: "UMJ is only an initial reference; own versioned format, one canonical JSON per model and one layout file per diagram."
aliases: [umj, format, json-schema, knowledge, layout]
tags: [format, data, contracts]
relations:
  affects: [REQ-005, REQ-009, REQ-010, REQ-013, REQ-021, NFR-003, NFR-011, VAL-001, VAL-004, VAL-005, VAL-007, FEAT-003, API-004, ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  supersedes: []
uncertainties: []
---

# DEC-002 · Own knowledge format derived from UMJ

## Context
- User: "a well-defined JSON standard, starting from ./UMJ.pdf ... later it can be extended to more diagram types" [declared].
- User (2026-10-14): "One file per model" + "umj only as an initial reference, adapt it as well as possible to the need" [declared].
- UMJ (Malanowska & Pawłowski, ENASE 2026, DOI 10.5220/0014828700004015): covers classes and sequence;
  `id`/`idref`; the model is the root and owner of the relationships; `null` = unknown value;
  diagrams = sets of references, without layout [verified: reading of the paper].
- The paper is CC BY-NC-ND 4.0: its text and tables are not reproduced; the specification is rewritten in
  our own words and cites it [verified: PDF cover page].

## Alternatives considered
1. Fragmented (one file per element) — better merges; more files and assembly.
2. **One file per model + separate layout** — readable and close to UMJ; more conflicts if two branches touch the same model, mitigated with canonical serialization.
3. One file per diagram — elements shared between diagrams become complicated.

## Decision
- Own, versioned format, with a JSON Schema 2020-12 published in the package. UMJ is the conceptual
  basis, not a contract: it is adapted where convenient and deviations are documented in the spec.
- Structure:
  ```
  knowledge/
    ai-submind.json            # manifest: format version, name and documentation
    models/<model-id>.json     # one model: elements, relationships, diagrams (refs)
    layout/<diagram-id>.json   # positions, sizes, link vertices, style
    .ai-submind/               # derived data (indexes, embeddings, runtime) — in .gitignore
  ```
- Canonical serialization: fixed key order (defined by the schema), set arrays
  sorted by `id`, 2 spaces, LF, trailing newline, integer coordinates. Every write goes through it.
- Extensibility: declared diagram type (`kind`), registry of element types per diagram;
  first scope: classes and sequence.
- Each file declares `format_version` (`MAJOR.MINOR`; first version `1.0`).
- The own spec (citing UMJ) lives in `spec/format/` (API-004) and is distributed with the package; `UMJ.pdf` is not kept in the repository.

## Consequences
- Positive: readable diffs, layout does not pollute the model, git remains the source of truth.
- Negative / costs: merge conflicts at model-file level; compensated by post-merge
  validation (conflict markers, duplicate ids, broken refs) and, later, a semantic merge driver.

## Affected elements
Format, validator, engine (DEC-004), UI (DEC-006).

## Verification
`test/format/corpus.test.ts`: the `garage` corpus (re-expressing the paper's *Car* example) validates and the canonical inputs are rewritten byte for byte, idempotently.
