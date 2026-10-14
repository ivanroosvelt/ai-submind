---
id: DEC-009
type: decision
name: "Ajv 8 as the JSON Schema validator of the format and dependency-cruiser for module boundaries"
status: active
evidence: declared-doc
summary: "The format core validates with Ajv 8 (Ajv2020, strict) as a runtime dependency; cycles and boundaries between modules are checked with dependency-cruiser in npm run check."
aliases: [ajv, dependency-cruiser, depcruise, cycles, validator]
tags: [stack, format, architecture]
relations:
  affects: [FEAT-003, VAL-001, NFR-008]
  supersedes: []
uncertainties: []
---

# DEC-009 · Ajv 8 and dependency-cruiser

## Context
- DEC-002 sets the JSON Schema 2020-12 in `spec/format/schema/` as the canonical source of the structure;
  the validator runs it as is, without duplicating it in code [declared].
- The PLAN-002 S2 prototype compiled the schemas with Ajv 8.20.0 (`Ajv2020`, `strict: true`) and passed the
  full corpus [verified: S2 evidence].
- NFR-008 requires 0 cycles between modules and left the tool for S4 [declared].
- User (2026-10-14) chooses Ajv 8 and dependency-cruiser [declared].

## Alternatives considered
1. Validator: **Ajv 8** vs `@cfworker/json-schema` (no code generation, less used, less detailed
   errors) vs hand-written validation (duplicates the schema and contradicts DEC-002).
2. Cycles: **dependency-cruiser** (declarative rules: cycles and boundaries between layers) vs `madge --circular`
   (cycles only) vs ESLint's `import-x/no-cycle` (slow with type-aware lint, cycles only) vs deferring to S5.

## Decision
- `ajv@8.20.0` as a runtime dependency (exact version). One `Ajv2020` per process with `allErrors` and
  `strict`; the schemas are read from `spec/format/schema/1.0/` (published in `files`). Errors are
  reported with `instancePath` as a JSON Pointer.
- `dependency-cruiser@18.6.0` as a development dependency; rules in `.dependency-cruiser.cjs`:
  `no-circular`, `format-is-core` (`src/format` does not import other modules), `not-to-unresolvable`,
  `not-to-dev-dep` (nothing in `src/` imports development dependencies). `npm run deps` is part of
  `npm run check` (and therefore of `scripts/check` and CI).

## Consequences
- Positive: the schema is the single source of structure; boundaries between modules are enforced
  automatically as engine, MCP and UI appear (add per-layer rules when creating them).
- Negative / costs: Ajv and its 4 transitive dependencies ship with the package (license audit
  in S12; as of 2026-10-14: ajv, fast-deep-equal, json-schema-traverse and require-from-string MIT, fast-uri
  BSD-3-Clause). Ajv messages in English, consistent with those of the own validator (EDR-007).

## Affected elements
FEAT-003, VAL-001, NFR-008, `package.json`, `.dependency-cruiser.cjs`, `eslint.config.js`.

## Verification
2026-10-14: `npm run check` green (62 Vitest tests, `deps` without violations). Negative control:
a temporary cyclic import in `src/format/canonical.ts` makes `npm run deps` fail with `no-circular`
(exit 1).
