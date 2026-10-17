---
id: REQ-041
type: requirement
name: "Cross-diagram relations: operation behavior and links"
status: active
evidence: declared-doc
summary: "ACT-002 can relate an operation to the interaction that describes it (behavior) and any element, model or diagram to any other (links), so that flows of flows can be composed. Format, validation, canonical form, rename, MIGRATION_REQUIRED, edits with cascade, queries (relation groups sequence and links, impact, paths) and MCP descriptions implemented (PLAN-005 S2–S4); UI navigation is REQ-042"
aliases: ["behavior", "links", "flows of flows", "cross-diagram", "operation method"]
tags: [format, contracts]
relations:
  actors: [ACT-002, ACT-001]
  features: [FEAT-003, FEAT-002, FEAT-004, FEAT-006]
  constraints: [VAL-003, NFR-011]
  depends_on: [REQ-009, REQ-039]
  decisions: [DEC-020, DEC-002, DEC-003]
uncertainties: []
---

# REQ-041 · Cross-diagram relations: operation behavior and links

## Statement

ACT-002 (and ACT-001 editing files) can declare that an operation's behavior is described by an interaction, and
link any element, model or diagram to any other element, model or diagram, in order to keep relations between
diagrams of different kinds and compose flows of flows.

## Source

User (2026-10-16, PLAN-005): "diagrams of different kinds keep relations to the corresponding entities; an entity
of a flow can reference another whole flow file; build flows of flows". Mechanism and version: DEC-020.

## Acceptance criteria

1. Given a 1.1 model, when an operation declares `behavior: {"idref": <interaction>}`, then it validates; when the
   target is not an interaction, then `REF_TYPE_MISMATCH`.
2. Given a 1.1 document, when an element with `id`, the model or a diagram declares `links` to an existing element,
   model or diagram (of any model), then it validates; an unknown target is `REF_UNRESOLVED`.
3. Given a link whose target is the element, model or diagram that carries it, then `LINK_SELF`.
4. `links` is written as a set sorted by `idref`; reading and rewriting produces no differences.
5. Given a `rename` of a `behavior` or `links` target, then the references are rewritten in the same transaction;
   given the deletion of a target, then the engine's `cascade` applies as for any other reference.
6. Relationship, impact and path queries traverse `behavior` and `links`.
7. Given a 1.0 document, when a write would add `behavior` or `links`, then it is rejected with
   `MIGRATION_REQUIRED` (REQ-043) and nothing is written.

## Business rules

- `behavior` is a single reference; an operation has at most one behavior.
- `links` carries no semantics beyond "see also / drills down to"; cycles between flows are valid.

## Errors and edge cases

`REF_TYPE_MISMATCH`, `REF_UNRESOLVED`, `LINK_SELF`, `MIGRATION_REQUIRED`; duplicate links are `SCHEMA_VIOLATION`.

## Out of scope

`behavior` on classifiers (covered by `links`); new diagram kinds.
