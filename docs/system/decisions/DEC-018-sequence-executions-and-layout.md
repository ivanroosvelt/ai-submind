---
id: DEC-018
type: decision
name: "Sequence executions in format 1.0 and a shared sequence layout"
status: active
evidence: declared-doc
summary: "Format 1.0 is amended (unreleased) with an `executions` set on interactions; sequence diagrams use a pure layout module shared by the UI and the MCP auto-layout tool, where people adjust only lifeline x, width and height."
aliases: [execution specification, activation, sequence layout]
tags: [format, ui, contracts]
relations:
  affects: [FEAT-009, REQ-040, API-001, API-002, ENT-004, ENT-005, VAL-005]
  supersedes: []
uncertainties: []
---

# DEC-018 · Sequence executions in format 1.0 and a shared sequence layout

## Context
- REQ-040 CA1 asks to render activations; format 1.0 (spec §6.5) has no execution specifications [declared].
- Spec §11: adding optional keys is a minor version; an earlier version is read-only until migrated, and the
  migration machinery (DEC-010) is only planned [declared].
- `ai-submind` is not published (`npm view ai-submind` fails, 2026-10-15): no `knowledge/` outside this
  repository uses format 1.0 [verified].
- DEC-017: class diagrams use one pure layout module shared by the UI and the tool `auto_layout_diagram` [declared].
- The user chose on 2026-10-15: executions in the format, amend 1.0, an `executions` list, shared
  auto-layout, and manual adjustment limited to horizontal position and height [declared].

## Alternatives considered
1. **Activations**: derived from `synch_call`/`reply` pairs (no format change, but a heuristic that fails on
   calls without a reply); **in the format** (chosen; faithful to UML); none (drop from REQ-040).
2. **Version**: **amend 1.0** (chosen; nothing published, no migration needed); 1.1 (honours §11 but brings
   forward migrate, `FORMAT_VERSION_OUTDATED` and a 1.0→1.1 guide).
3. **Shape**: **`executions` set on the interaction** with `covered`, `start`, `finish` (chosen; it does not take
   part in the temporal order of `fragments`); an `execution` fragment as in UML (its array position would
   carry no meaning).
4. **Manual adjustment**: **lifeline x, width and height only** (chosen; vertical positions always follow event
   order); free lifeline movement (y as well).

## Decision
- Interaction gains optional `executions` (set sorted by `id`): `{id, covered, start, finish}`; `covered` is a
  lifeline of the same interaction, `start`/`finish` are `occurrence` fragments of the same interaction that
  cover that lifeline, and `start` is not after `finish` in temporal order. An occurrence used by an execution
  is not `OCCURRENCE_UNUSED`; it may also be a message event (it is not an event of the execution).
- Format version stays `1.0`; the amendment is recorded here and in spec §6.5.
- `src/layout/sequence-layout.ts` (pure, no Node built-ins) computes the full sequence geometry from the
  diagram view and the layout; the UI draws it and the tool `auto_layout_diagram` accepts sequence diagrams.
- Layout keys stay as spec §8: `nodes` = lifelines (`x`, `width`, `y` = header top, `height` = length, both
  minimums); `edges` = messages (`style` only). Rows, executions and fragments are never persisted.
- In the UI lifelines move only horizontally (order = x) and their length is changed by dragging the end.

## Consequences
- Positive: activations are explicit and validated; one geometry for UI, tool and tests.
- Negative / costs: format 1.0 is no longer the one described before 2026-10-15 (acceptable: unreleased);
  schema, semantic rules, ID derivation, cascade and canonical order grow with `executions`.

## Affected elements
FEAT-009, REQ-040, API-001, API-002, ENT-004, ENT-005, VAL-005.

## Verification
PLAN-002 S11: `test/format` (corpus cases `execution-coverage`, `execution-order`, `execution-start-not-occurrence`, garage and canonical `sequence` with executions, rules), `test/engine` (derivation, cascade), `test/query` (sequence group), `test/layout/sequence-layout.test.ts`, `test/mcp/tools.test.ts`, `test/daemon/ui-api.test.ts`. Browser check by the user done on 2026-10-15 (`rent-car`, `check-fuel`).
